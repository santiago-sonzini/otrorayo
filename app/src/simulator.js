import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, stat, rename } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(x => x.replace(/^--/, '').split('=')));
const id = args.id || 'Q01';
const host = args.host || '127.0.0.1';
const port = Number(args.port || 8787);
const token = args.token || process.env.OTRORAYO_DEVICE_TOKEN;
const dir = path.resolve(args.dir || `data/sim/${id}`);
const skewMs = Number(args['clock-skew-ms'] || 0);
const playbackDriftPpm = Number(args['playback-drift-ppm'] || 0);
if (!/^Q(0[1-9]|10)$/.test(id) || !token) { console.error('Uso: node src/simulator.js --id=Q01 --token=TOKEN [--host=IP]'); process.exit(1); }
await mkdir(dir, { recursive: true });

const localNow = () => Date.now() + skewMs;
let ws, online = false, forcedOffline = false, clock = null, desired = null, contentSha256 = null, contentStatus = 'MISSING';
let transferPercent = 0, playback = 'LOBBY', startLocalAt = null, resumeLocalAt = null, pausedAtMs = 0, error = null;
const seen = new Map();
const send = message => { if (online && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ v: 1, ...message })); };
const position = () => ['PAUSED', 'SCHEDULED'].includes(playback) ? pausedAtMs :
  playback === 'PLAYING' && startLocalAt != null ? Math.max(0, (localNow() - startLocalAt) * (1 + playbackDriftPpm / 1e6)) : 0;
const observed = () => ({ appVersion: 'sim-0.1.0', battery: 85, charging: false, freeBytes: 50 * 1024 ** 3,
  contentSha256, contentStatus, transferPercent, playback, positionMs: Math.round(position()), error });
const heartbeat = () => send({ type: 'HEARTBEAT', observed: observed(), clock });
const probe = () => send({ type: 'CLOCK_PROBE', clientSentAt: localNow() });
const ack = (commandId, status, detail = '') => { const result = { type: 'ACK', commandId, status, detail }; seen.set(commandId, result); while (seen.size > 100) seen.delete(seen.keys().next().value); send(result); };

async function checksum(file) {
  const h = createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex');
}
async function distribute(content) {
  const target = path.join(dir, content.sha256 + path.extname(content.file));
  const partial = target + '.part';
  try { if ((await stat(target)).size === content.size && await checksum(target) === content.sha256) { contentSha256 = content.sha256; contentStatus = 'READY'; transferPercent = 100; return; } } catch {}
  contentStatus = 'LOADING'; error = null;
  let offset = 0;
  try { offset = (await stat(partial)).size; if (offset >= content.size) offset = 0; } catch {}
  const headers = offset ? { Range: `bytes=${offset}-` } : {};
  const url = `http://${host}:${port}/device/content?sha256=${content.sha256}&token=${token}`;
  const response = await fetch(url, { headers });
  if (!(response.status === 200 || response.status === 206)) throw new Error(`HTTP ${response.status}`);
  if (offset && response.status !== 206) offset = 0;
  const out = await open(partial, offset ? 'a' : 'w');
  try {
    for await (const chunk of response.body) { await out.write(chunk); offset += chunk.length; transferPercent = Math.floor(offset / content.size * 100); heartbeat(); }
  } finally { await out.close(); }
  if ((await stat(partial)).size !== content.size || await checksum(partial) !== content.sha256) throw new Error('Checksum SHA-256 inválido');
  await rename(partial, target);
  contentSha256 = content.sha256; contentStatus = 'READY'; transferPercent = 100;
}
async function command(message) {
  if (seen.has(message.commandId)) return send(seen.get(message.commandId));
  try {
    switch (message.action) {
      case 'DISTRIBUTE': await distribute(message.content); break;
      case 'PREPARE':
        if (contentSha256 !== message.content.sha256 || contentStatus !== 'READY') throw new Error('Contenido no validado');
        playback = 'READY'; break;
      case 'PLAY_AT':
        if (playback !== 'READY' || !clock) throw new Error('Quest no preparado o reloj no medido');
        pausedAtMs = 0; startLocalAt = message.startAt - clock.offsetMs; resumeLocalAt = startLocalAt; playback = 'SCHEDULED'; break;
      case 'PAUSE': pausedAtMs = position(); playback = 'PAUSED'; break;
      case 'RESUME': startLocalAt = message.startAt - (clock?.offsetMs || 0); resumeLocalAt = message.scheduledAt - (clock?.offsetMs || 0); playback = 'SCHEDULED'; break;
      case 'STOP': playback = 'STANDBY'; startLocalAt = null; break;
      case 'LOBBY': playback = 'LOBBY'; startLocalAt = null; break;
      case 'RESYNC':
        if (message.startAt != null) {
          startLocalAt = message.startAt - (clock?.offsetMs || 0);
          resumeLocalAt = (message.scheduledAt || message.startAt) - (clock?.offsetMs || 0);
          playback = localNow() >= resumeLocalAt ? 'PLAYING' : 'SCHEDULED';
        }
        break;
      case 'RELOAD': playback = contentStatus === 'READY' ? 'READY' : 'STANDBY'; break;
      case 'IDENTIFY': console.log(`${id}: IDENTIFY durante 5 s (simulación)`); break;
      default: throw new Error('Acción desconocida');
    }
    error = null; ack(message.commandId, 'OK'); heartbeat();
  } catch (e) { error = e.message; if (message.action === 'DISTRIBUTE') contentStatus = 'ERROR'; ack(message.commandId, 'ERROR', e.message); heartbeat(); }
}
function reconcile(snapshot) {
  desired = snapshot;
  // Playback already underway is never stopped merely because the network dropped.
  if (snapshot.phase === 'PLAYING' && contentSha256 === snapshot.experience?.vr?.sha256 && playback !== 'PLAYING') {
    startLocalAt = snapshot.startAt - (clock?.offsetMs || 0); playback = 'PLAYING';
  }
  if (snapshot.phase === 'IDLE' && ['PLAYING', 'SCHEDULED'].includes(playback)) { playback = 'LOBBY'; startLocalAt = null; }
  heartbeat();
}
function connect() {
  if (forcedOffline) return;
  ws = new WebSocket(`ws://${host}:${port}/ws/device?token=${token}`);
  ws.onopen = () => { online = true; send({ type: 'HELLO', id }); probe(); heartbeat(); console.log(`${id}: conectado`); };
  ws.onmessage = event => {
    let m; try { m = JSON.parse(event.data); } catch { return; }
    if (m.v !== 1) return;
    if (m.type === 'SNAPSHOT') reconcile(m.desired);
    if (m.type === 'COMMAND') command(m);
    if (m.type === 'CLOCK_REPLY') {
      const received = localNow();
      const rttMs = received - m.clientSentAt - (m.serverSentAt - m.serverReceivedAt);
      const offsetMs = ((m.serverReceivedAt - m.clientSentAt) + (m.serverSentAt - received)) / 2;
      clock = { rttMs, offsetMs }; heartbeat();
    }
  };
  ws.onclose = () => { online = false; if (!forcedOffline) setTimeout(connect, 1000); console.log(`${id}: desconectado; reproducción local=${playback}`); };
  ws.onerror = () => {};
}
setInterval(() => { if (playback === 'SCHEDULED' && resumeLocalAt != null && localNow() >= resumeLocalAt) playback = 'PLAYING'; heartbeat(); }, 500);
setInterval(probe, 3000);
connect();
const outageAfter = Number(args['outage-after-ms']);
const outageDuration = Number(args['outage-duration-ms'] || 8000);
if (Number.isFinite(outageAfter)) setTimeout(() => {
  forcedOffline = true; ws?.close(); console.log(`${id}: corte Wi-Fi simulado ${outageDuration} ms`);
  setTimeout(() => { forcedOffline = false; connect(); }, outageDuration);
}, outageAfter);
