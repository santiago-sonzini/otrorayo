import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IDS = Array.from({ length: 10 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`);
const FRESH_MS = 5000;
const CLOCK_FRESH_MS = 15000;
const COMMANDS = new Set(['STOP', 'LOBBY', 'PAUSE', 'RESUME', 'RESYNC', 'IDENTIFY', 'RELOAD']);

export class Controller {
  constructor(dataDir, publish = () => {}) {
    this.dataDir = dataDir;
    this.publish = publish;
    this.devices = new Map();
    this.connections = new Map();
    this.pending = new Map();
    this.desired = { eventName: 'SIN EVENTO', experience: null, selected: ['Q01', 'Q02'], phase: 'IDLE', startAt: null, scheduledAt: null, pausedAtMs: 0, generation: 0 };
    this.saveChain = Promise.resolve();
  }
  async load() {
    await mkdir(this.dataDir, { recursive: true });
    try {
      const stored = JSON.parse(await readFile(path.join(this.dataDir, 'state.json'), 'utf8'));
      this.desired = { ...this.desired, ...stored, selected: this.validIds(stored.selected) };
      if (this.desired.phase === 'SCHEDULED' && Date.now() >= (this.desired.scheduledAt || this.desired.startAt)) this.desired.phase = 'PLAYING';
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  validIds(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !IDS.includes(id))) throw new Error('Seleccioná entre Q01 y Q10');
    return [...new Set(ids)];
  }
  save() {
    const snapshot = JSON.stringify(this.desired, null, 2);
    this.saveChain = this.saveChain.then(async () => {
      const tmp = path.join(this.dataDir, 'state.json.tmp');
      await writeFile(tmp, snapshot); await rename(tmp, path.join(this.dataDir, 'state.json'));
    });
    return this.saveChain;
  }
  notify() { this.publish(this.snapshot()); }
  setConnection(id, peer, ip) {
    if (!IDS.includes(id)) throw new Error('ID de Quest inválido');
    this.connections.get(id)?.close();
    this.connections.set(id, peer);
    const previous = this.devices.get(id) || {};
    this.devices.set(id, { ...previous, id, ip, lastSeen: Date.now(), connected: true });
    peer.on('close', () => {
      if (this.connections.get(id) !== peer) return;
      this.connections.delete(id);
      const device = this.devices.get(id); if (device) device.connected = false;
      this.notify();
    });
    peer.send({ v: 1, type: 'SNAPSHOT', desired: this.desired, serverTime: Date.now() });
    this.notify();
  }
  receive(id, message) {
    if (message?.v !== 1 || typeof message.type !== 'string') return;
    const device = this.devices.get(id);
    if (!device) return;
    device.lastSeen = Date.now();
    if (message.type === 'HEARTBEAT') {
      const o = message.observed || {};
      device.observed = {
        appVersion: String(o.appVersion || 'unknown').slice(0, 40),
        battery: Number.isFinite(o.battery) ? Math.max(0, Math.min(100, o.battery)) : null,
        charging: !!o.charging,
        freeBytes: Number.isFinite(o.freeBytes) ? o.freeBytes : null,
        contentSha256: typeof o.contentSha256 === 'string' ? o.contentSha256 : null,
        contentStatus: ['MISSING', 'LOADING', 'READY', 'ERROR'].includes(o.contentStatus) ? o.contentStatus : 'MISSING',
        transferPercent: Number.isFinite(o.transferPercent) ? Math.max(0, Math.min(100, o.transferPercent)) : 0,
        playback: ['LOBBY', 'STANDBY', 'READY', 'SCHEDULED', 'PLAYING', 'PAUSED', 'ERROR'].includes(o.playback) ? o.playback : 'ERROR',
        positionMs: Number.isFinite(o.positionMs) ? o.positionMs : 0,
        error: o.error ? String(o.error).slice(0, 200) : null
      };
      if (Number.isFinite(message.clock?.offsetMs) && Number.isFinite(message.clock?.rttMs)) {
        device.clock = { offsetMs: message.clock.offsetMs, rttMs: message.clock.rttMs, measuredAt: Date.now() };
      }
    } else if (message.type === 'CLOCK_PROBE' && Number.isFinite(message.clientSentAt)) {
      this.connections.get(id)?.send({ v: 1, type: 'CLOCK_REPLY', clientSentAt: message.clientSentAt, serverReceivedAt: Date.now(), serverSentAt: Date.now() });
    } else if (message.type === 'ACK' && typeof message.commandId === 'string') {
      const p = this.pending.get(message.commandId);
      if (p && p.id === id) {
        p.status = message.status === 'OK' ? 'OK' : 'ERROR';
        p.detail = String(message.detail || '').slice(0, 200);
        p.at = Date.now();
      }
    }
    this.notify();
  }
  online(id, now = Date.now()) {
    const d = this.devices.get(id);
    return !!(d?.connected && now - d.lastSeen <= FRESH_MS);
  }
  expectedPosition(now = Date.now()) {
    if (this.desired.phase === 'PAUSED') return this.desired.pausedAtMs;
    if (this.desired.phase === 'SCHEDULED' && now < (this.desired.scheduledAt || this.desired.startAt)) return this.desired.pausedAtMs;
    if (!['SCHEDULED', 'PLAYING'].includes(this.desired.phase) || !this.desired.startAt) return 0;
    return Math.max(0, now - this.desired.startAt);
  }
  preflight(now = Date.now()) {
    const checks = [];
    const add = (label, status, detail) => checks.push({ label, status, detail });
    add('Controlador local', 'OK', 'Servicio activo');
    const exp = this.desired.experience;
    add('Archivo VR', exp?.vr?.sha256 ? 'OK' : 'BLOCK', exp?.vr?.file || 'Sin experiencia');
    add('Red de evento', 'WARN', 'Verificar router, Ethernet y Wi-Fi físicamente');
    for (const id of this.desired.selected) {
      const d = this.devices.get(id), o = d?.observed || {};
      const fresh = this.online(id, now);
      add(`${id} conexión`, fresh ? 'OK' : 'BLOCK', fresh ? `Último reporte ${Math.round((now - d.lastSeen) / 1000)} s` : 'Sin telemetría reciente');
      add(`${id} contenido`, fresh && o.contentStatus === 'READY' && o.contentSha256 === exp?.vr?.sha256 ? 'OK' : 'BLOCK', o.contentStatus || 'MISSING');
      add(`${id} preparado`, fresh && o.playback === 'READY' ? 'OK' : 'BLOCK', o.playback || 'Sin dato');
      add(`${id} batería`, o.battery == null ? 'BLOCK' : o.battery < 20 ? 'BLOCK' : o.battery < 40 ? 'WARN' : 'OK', o.battery == null ? 'Sin dato' : `${o.battery}%`);
      add(`${id} reloj`, fresh && d?.clock && now - d.clock.measuredAt < CLOCK_FRESH_MS && d.clock.rttMs < 100 ? 'OK' : 'BLOCK', d?.clock ? `offset ${Math.round(d.clock.offsetMs)} ms · RTT ${Math.round(d.clock.rttMs)} ms` : 'Sin medición');
    }
    return { ready: !checks.some(c => c.status === 'BLOCK'), checks };
  }
  snapshot() {
    const now = Date.now();
    const devices = IDS.map(id => {
      const d = this.devices.get(id);
      const observed = d?.observed || null;
      const online = this.online(id, now);
      const driftMs = online && observed?.playback === 'PLAYING' && this.desired.selected.includes(id) && this.desired.phase === 'PLAYING'
        ? Math.round(observed.positionMs - this.expectedPosition(d.lastSeen)) : null;
      return { id, online, lastSeen: d?.lastSeen || null, ip: d?.ip || null, observed: online ? observed : null,
        lastObserved: observed, clock: online ? d.clock || null : null, driftMs,
        command: [...this.pending.values()].filter(p => p.id === id).at(-1) || null };
    });
    return { v: 1, type: 'STATE', now, desired: this.desired, devices, preflight: this.preflight(now), expectedPositionMs: this.expectedPosition(now) };
  }
  sendCommand(id, action, args = {}) {
    const peer = this.connections.get(id);
    if (!peer || !this.online(id)) return false;
    const commandId = randomUUID();
    const message = { v: 1, type: 'COMMAND', commandId, action, generation: this.desired.generation, ...args };
    this.pending.set(commandId, { id, action, status: 'SENT', at: Date.now(), attempts: 1, message });
    peer.send(message);
    while (this.pending.size > 100) this.pending.delete(this.pending.keys().next().value);
    return true;
  }
  async setExperience(experience) {
    if (['SCHEDULED', 'PLAYING', 'PAUSED'].includes(this.desired.phase)) throw new Error('Detené la reproducción antes de cambiar la experiencia');
    this.desired.experience = experience;
    this.desired.eventName = experience.eventName;
    this.desired.phase = 'IDLE'; this.desired.startAt = null; this.desired.scheduledAt = null; this.desired.generation++;
    await this.save(); this.notify();
  }
  async select(ids) {
    if (['SCHEDULED', 'PLAYING', 'PAUSED'].includes(this.desired.phase)) throw new Error('Detené la reproducción antes de cambiar la selección');
    this.desired.selected = this.validIds(ids);
    await this.save(); this.notify();
  }
  async action(action, ids = this.desired.selected) {
    ids = this.validIds(ids);
    const exp = this.desired.experience;
    const commands = [];
    if (action === 'DISTRIBUTE' || action === 'PREPARE') {
      if (!exp?.vr) throw new Error('Cargá una experiencia primero');
      if (['SCHEDULED', 'PLAYING', 'PAUSED'].includes(this.desired.phase)) throw new Error('Detené la reproducción antes de distribuir o preparar');
      for (const id of ids) if (!this.online(id)) throw new Error(`${id} sin conexión reciente`);
      if (action === 'PREPARE') {
        const bad = ids.find(id => this.devices.get(id)?.observed?.contentSha256 !== exp.vr.sha256 || this.devices.get(id)?.observed?.contentStatus !== 'READY');
        if (bad) throw new Error(`${bad} no validó el archivo VR`);
        this.desired.phase = 'PREPARING';
      } else {
        const short = ids.find(id => this.devices.get(id)?.observed?.freeBytes != null && this.devices.get(id).observed.freeBytes < exp.vr.size + 500 * 1024 * 1024);
        if (short) throw new Error(`${short} sin espacio suficiente`);
      }
      for (const id of ids) commands.push([id, action, { content: exp.vr, experienceId: exp.id }]);
    } else if (action === 'PLAY') {
      if (ids.length !== this.desired.selected.length || ids.some(id => !this.desired.selected.includes(id))) throw new Error('PLAY requiere todos los visores seleccionados');
      if (this.desired.phase !== 'PREPARING' && this.desired.phase !== 'READY') throw new Error('Ejecutá PREPARE primero');
      const check = this.preflight();
      if (!check.ready) throw new Error('Pre-flight bloqueado');
      for (const id of ids) {
        const o = this.devices.get(id)?.observed;
        if (o?.playback !== 'READY') throw new Error(`${id} todavía no confirmó READY`);
      }
      this.desired.phase = 'SCHEDULED';
      this.desired.startAt = Date.now() + 4000;
      this.desired.scheduledAt = this.desired.startAt;
      this.desired.pausedAtMs = 0;
      for (const id of ids) commands.push([id, 'PLAY_AT', { startAt: this.desired.startAt, experienceId: exp.id }]);
    } else if (COMMANDS.has(action)) {
      if (['PAUSE', 'RESUME', 'STOP', 'LOBBY'].includes(action) && this.desired.selected.some(id => !ids.includes(id))) throw new Error(`${action} requiere todos los visores seleccionados`);
      if (action === 'PAUSE' && this.desired.phase !== 'PLAYING') throw new Error('PAUSE requiere PLAYING');
      if (action === 'RESUME' && this.desired.phase !== 'PAUSED') throw new Error('RESUME requiere PAUSED');
      if (action === 'RESYNC' && !['PLAYING', 'SCHEDULED'].includes(this.desired.phase)) throw new Error('RESYNC requiere reproducción activa');
      if (action === 'PAUSE') { this.desired.pausedAtMs = this.expectedPosition(); this.desired.phase = 'PAUSED'; }
      if (action === 'RESUME') { this.desired.scheduledAt = Date.now() + 3000; this.desired.startAt = this.desired.scheduledAt - this.desired.pausedAtMs; this.desired.phase = 'SCHEDULED'; }
      if (action === 'STOP' || action === 'LOBBY') { this.desired.phase = 'IDLE'; this.desired.startAt = null; this.desired.scheduledAt = null; }
      for (const id of ids) commands.push([id, action, { targetPositionMs: this.expectedPosition(), startAt: this.desired.startAt, scheduledAt: this.desired.scheduledAt }]);
    } else throw new Error('Acción desconocida');
    await this.save();
    for (const [id, command, args] of commands) this.sendCommand(id, command, args);
    this.notify();
    return this.snapshot();
  }
  tick() {
    const now = Date.now();
    for (const pending of this.pending.values()) {
      if (pending.status !== 'SENT' || now - pending.at < 2000) continue;
      if (pending.attempts >= 3 || !this.online(pending.id, now)) { pending.status = 'TIMEOUT'; pending.at = now; continue; }
      this.connections.get(pending.id)?.send(pending.message);
      pending.attempts++; pending.at = now;
    }
    if (this.desired.phase === 'PREPARING' && this.desired.selected.every(id => this.online(id) && this.devices.get(id)?.observed?.playback === 'READY')) {
      this.desired.phase = 'READY'; this.save();
    }
    if (this.desired.phase === 'SCHEDULED' && Date.now() >= (this.desired.scheduledAt || this.desired.startAt)) {
      this.desired.phase = 'PLAYING'; this.save();
    }
    this.notify();
  }
}
