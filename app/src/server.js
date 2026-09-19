import http from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Controller } from './core.js';
import { upgrade } from './ws.js';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const isLocal = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };

async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 65536) throw new Error('Solicitud demasiado grande'); }
  return JSON.parse(text || '{}');
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function validFile(name) { return typeof name === 'string' && /^[\w .()-]+\.(mp4|m4v|mov|wav)$/i.test(name) && name === path.basename(name); }

export async function startServer({ host = process.env.OTRORAYO_HOST || '0.0.0.0', port = Number(process.env.OTRORAYO_PORT || 8787), dataDir = path.join(APP_DIR, 'data') } = {}) {
  const contentDir = path.join(dataDir, 'content');
  await mkdir(contentDir, { recursive: true });
  const tokenFile = path.join(dataDir, 'device-token.txt');
  let token;
  try { token = (await readFile(tokenFile, 'utf8')).trim(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; token = randomBytes(24).toString('hex'); await writeFile(tokenFile, token, { mode: 0o600 }); }
  const dashboards = new Set();
  const controller = new Controller(dataDir, state => { for (const peer of dashboards) peer.send(state); });
  await controller.load();
  const authed = candidate => typeof candidate === 'string' && candidate.length === token.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(token));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/device/content' && req.method === 'GET') {
        if (!authed(url.searchParams.get('token'))) return json(res, 401, { error: 'Token inválido' });
        const vr = controller.desired.experience?.vr;
        if (!vr || url.searchParams.get('sha256') !== vr.sha256) return json(res, 404, { error: 'Contenido no disponible' });
        const file = path.join(contentDir, vr.file);
        const info = await stat(file);
        if (info.size !== vr.size) return json(res, 409, { error: 'El archivo cambió desde el registro' });
        const range = req.headers.range?.match(/^bytes=(\d+)-$/);
        if (req.headers.range && !range) return json(res, 416, { error: 'Range inválido' });
        const offset = range ? Number(range[1]) : 0;
        if (!Number.isSafeInteger(offset) || offset >= info.size) return json(res, 416, { error: 'Range fuera de archivo' });
        const headers = { 'content-type': 'application/octet-stream', 'content-length': info.size - offset, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
        if (range) headers['content-range'] = `bytes ${offset}-${info.size - 1}/${info.size}`;
        res.writeHead(range ? 206 : 200, headers);
        createReadStream(file, { start: offset }).pipe(res);
        return;
      }
      if (!isLocal(req.socket.remoteAddress)) return json(res, 403, { error: 'Dashboard solo en la Mac' });
      if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, controller.snapshot());
      if (url.pathname === '/api/files' && req.method === 'GET') return json(res, 200, (await readdir(contentDir)).filter(validFile));
      if (url.pathname === '/api/experience' && req.method === 'POST') {
        const input = await body(req);
        if (!validFile(input.file) || !String(input.name || '').trim()) throw new Error('Nombre y archivo VR válidos requeridos');
        const file = path.join(contentDir, input.file);
        const info = await stat(file);
        if (!info.isFile() || !info.size) throw new Error('Archivo vacío o inválido');
        const experience = { id: randomUUID(), eventName: String(input.eventName || 'EVENTO').trim().slice(0, 80), name: String(input.name).trim().slice(0, 80), vr: { file: input.file, size: info.size, sha256: await sha256(file) }, durationMs: Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : 0, createdAt: Date.now() };
        await controller.setExperience(experience);
        return json(res, 200, experience);
      }
      if (url.pathname === '/api/select' && req.method === 'POST') { await controller.select((await body(req)).ids); return json(res, 200, controller.snapshot()); }
      if (url.pathname === '/api/action' && req.method === 'POST') { const input = await body(req); return json(res, 200, await controller.action(input.action, input.ids)); }
      if (req.method !== 'GET') return json(res, 405, { error: 'Método inválido' });
      const page = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html', 'app.js', 'style.css'].includes(page)) return json(res, 404, { error: 'No encontrado' });
      const file = path.join(APP_DIR, 'public', page);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)], 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
    } catch (error) { if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); else res.destroy(error); }
  });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const dashboard = url.pathname === '/ws/dashboard' && isLocal(req.socket.remoteAddress) && req.headers.origin === `http://${req.headers.host}`;
    const device = url.pathname === '/ws/device' && authed(url.searchParams.get('token'));
    if (!dashboard && !device) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    const peer = upgrade(req, socket, head);
    if (!peer) return;
    peer.on('error', () => {});
    if (dashboard) { dashboards.add(peer); peer.on('close', () => dashboards.delete(peer)); peer.send(controller.snapshot()); return; }
    let id = null;
    const helloTimer = setTimeout(() => peer.close(1008), 5000);
    peer.on('close', () => clearTimeout(helloTimer));
    peer.on('message', message => {
      if (!id) {
        if (message?.v !== 1 || message.type !== 'HELLO') return peer.close(1008);
        id = message.id;
        try { controller.setConnection(id, peer, req.socket.remoteAddress); clearTimeout(helloTimer); }
        catch { peer.close(1008); }
      } else controller.receive(id, message);
    });
  });
  await new Promise(resolve => server.listen(port, host, resolve));
  const timer = setInterval(() => controller.tick(), 1000);
  const address = server.address();
  console.log(`OTRORAYO VR CONTROL: http://localhost:${address.port}`);
  console.log(`Token de dispositivo: ${tokenFile}`);
  return { server, controller, token, port: address.port, close: async () => { clearInterval(timer); for (const peer of dashboards) peer.close(); for (const peer of controller.connections.values()) peer.close(); await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer().catch(error => { console.error(error); process.exitCode = 1; });
