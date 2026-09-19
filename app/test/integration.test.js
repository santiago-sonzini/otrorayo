import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await fn(); if (result) return result; await sleep(100); }
  throw new Error(`Timeout: ${label}`);
}

test('flujo offline de dos visores simulados, desconexión y reconexión', { timeout: 40000 }, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'otrorayo-test-'));
  const children = [];
  let server;
  try {
    await mkdir(path.join(dataDir, 'content'));
    await writeFile(path.join(dataDir, 'content', 'test.mp4'), Buffer.alloc(1024 * 1024, 0xa5));
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
    const base = `http://127.0.0.1:${server.port}`;
    const post = async (route, value) => {
      const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      return result;
    };
    const state = async () => (await (await fetch(base + '/api/state')).json());
    const exp = await post('/api/experience', { eventName: 'TEST', name: 'SIMULACIÓN', file: 'test.mp4', durationMs: 30000 });
    assert.match(exp.vr.sha256, /^[a-f0-9]{64}$/);
    for (const [id, extra] of [['Q01', ['--clock-skew-ms=120', '--outage-after-ms=9000', '--outage-duration-ms=5000']], ['Q02', ['--clock-skew-ms=-80']]]) {
      const child = spawn(process.execPath, ['src/simulator.js', `--id=${id}`, `--port=${server.port}`, `--token=${server.token}`, `--dir=${path.join(dataDir, id)}`, ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stderr.on('data', d => process.stderr.write(d));
      children.push(child);
    }
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.online && d.clock).length === 2, 'conexión y reloj');
    await post('/api/action', { action: 'DISTRIBUTE' });
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.observed?.contentSha256 === exp.vr.sha256 && d.observed?.contentStatus === 'READY').length === 2, 'distribución con SHA-256');
    await post('/api/action', { action: 'PREPARE' });
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.observed?.playback === 'READY').length === 2, 'READY');
    const scheduled = await post('/api/action', { action: 'PLAY' });
    assert.ok(scheduled.desired.startAt > Date.now());
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.observed?.playback === 'PLAYING').length === 2, 'PLAYING');
    await until(async () => !(await state()).devices.find(d => d.id === 'Q01').online, 'Q01 offline', 13000);
    const during = await state();
    assert.equal(during.devices.find(d => d.id === 'Q01').observed, null);
    assert.equal(during.devices.find(d => d.id === 'Q02').observed.playback, 'PLAYING');
    await until(async () => (await state()).devices.find(d => d.id === 'Q01').online, 'Q01 reconecta', 10000);
    const recovered = await until(async () => {
      const current = await state(), d = current.devices.find(x => x.id === 'Q01');
      return d.observed?.playback === 'PLAYING' && d.observed?.positionMs > during.expectedPositionMs ? current : null;
    }, 'Q01 continúa localmente');
    assert.ok(Math.abs(recovered.devices.find(d => d.id === 'Q01').clock.offsetMs + 120) < 150);
    assert.ok(Math.abs(recovered.devices.find(d => d.id === 'Q02').clock.offsetMs - 80) < 150);
    await post('/api/action', { action: 'RESYNC', ids: ['Q01'] });
    await until(async () => (await state()).devices.find(d => d.id === 'Q01').command?.status === 'OK', 'RESYNC individual');
    assert.equal((await state()).devices.find(d => d.id === 'Q02').observed.playback, 'PLAYING');
    await post('/api/action', { action: 'PAUSE' });
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.observed?.playback === 'PAUSED').length === 2, 'PAUSED');
    const resumed = await post('/api/action', { action: 'RESUME' });
    assert.ok(resumed.desired.scheduledAt >= Date.now() + 2500);
    await sleep(800);
    assert.equal((await state()).desired.phase, 'SCHEDULED');
    await until(async () => (await state()).devices.filter(d => ['Q01', 'Q02'].includes(d.id) && d.observed?.playback === 'PLAYING').length === 2, 'RESUME PLAYING');
    await post('/api/action', { action: 'STOP', ids: ['Q01', 'Q02'] });
    console.log('PASS: distribución, READY, inicio futuro, corte, reconexión y pausa/reanudación simulados');
  } finally {
    for (const child of children) child.kill('SIGTERM');
    await server?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
