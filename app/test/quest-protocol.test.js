import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Controller } from '../src/core.js';
import { SocketPeer, upgrade } from '../src/ws.js';
import { startServer } from '../src/server.js';

class FakeSocket extends EventEmitter {
  writes = [];
  write(value) { this.writes.push(value); }
  end() { this.emit('close'); }
  destroy() { this.emit('close'); }
}
class FakePeer extends EventEmitter {
  messages = [];
  send(value) { this.messages.push(value); }
  close() { this.emit('close'); }
}
function clientFrame(opcode, data, fin = true) {
  const payload = Buffer.from(data), mask = Buffer.from([7, 11, 19, 23]);
  const first = (fin ? 128 : 0) | opcode;
  const header = payload.length < 126 ? Buffer.from([first, 128 | payload.length]) : Buffer.from([first, 128 | 126, payload.length >> 8, payload.length & 255]);
  for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return Buffer.concat([header, mask, payload]);
}
function assertCloses(frame, expected) {
  const socket = new FakeSocket(), peer = new SocketPeer(socket);
  peer.receive(frame);
  assert.equal(peer.closed, true);
  assert.equal(socket.writes.at(-1).readUInt16BE(2), expected);
}

test('WebSocket accepts fragmented UTF-8 JSON with interleaved ping and pong', () => {
  const socket = new FakeSocket(), peer = new SocketPeer(socket), messages = [];
  peer.on('message', message => messages.push(message));
  const text = Buffer.from('{"type":"HELLO","id":"Q01","name":"Órbita"}');
  const split = text.indexOf(Buffer.from('Ó')) + 1;
  const wire = Buffer.concat([
    clientFrame(1, text.subarray(0, split), false),
    clientFrame(9, 'native-ping'), clientFrame(10, 'keepalive'),
    clientFrame(0, text.subarray(split)), clientFrame(1, '{"v":1}')
  ]);
  for (let i = 0; i < wire.length; i += 3) peer.receive(wire.subarray(i, i + 3));
  assert.deepEqual(messages, [{ type: 'HELLO', id: 'Q01', name: 'Órbita' }, { v: 1 }]);
  assert.equal(peer.closed, false);
  assert.equal(socket.writes.length, 1);
  assert.equal(socket.writes[0][0], 0x8a);
  assert.equal(socket.writes[0].subarray(2).toString(), 'native-ping');
});

test('WebSocket rejects malformed framing, invalid UTF-8 and excessive lengths', () => {
  assertCloses(clientFrame(0, '{}'), 1002);
  assertCloses(Buffer.from([0x81, 2, 123, 125]), 1002); // Client must mask.
  assertCloses(Buffer.from([0xc1, 0x80]), 1002); // No negotiated extension.
  assertCloses(clientFrame(9, '', false), 1002);
  assertCloses(clientFrame(9, Buffer.alloc(126)), 1002);
  assertCloses(clientFrame(2, '{}'), 1003);
  assertCloses(clientFrame(1, Buffer.from([0x22, 0xc0, 0xaf, 0x22])), 1007);
  assertCloses(clientFrame(8, Buffer.from([1])), 1002);
  assertCloses(clientFrame(8, Buffer.from([3, 237])), 1002); // Reserved code 1005.
  assertCloses(clientFrame(8, Buffer.from([3, 232, 255])), 1007);
  assertCloses(Buffer.from([0x81, 0xfe, 0, 1]), 1002); // Non-minimal length.
  assertCloses(Buffer.from([0x81, 0xff, 128, 0, 0, 0, 0, 0, 0, 0]), 1002);
  assertCloses(Buffer.from([0x81, 0xff, 0, 0, 0, 0, 0, 1, 0, 1]), 1009);
  assertCloses(Buffer.concat([clientFrame(1, Buffer.alloc(40000), false), clientFrame(0, Buffer.alloc(30000))]), 1009);
  assertCloses(Buffer.concat([clientFrame(1, '', false), ...Array.from({ length: 1024 }, () => clientFrame(0, '', false))]), 1009);
});

test('upgrade delivers a HELLO already included in the HTTP upgrade packet', async () => {
  const socket = new FakeSocket(), messages = [];
  const peer = upgrade({ method: 'GET', headers: { upgrade: 'websocket', connection: 'keep-alive, Upgrade', 'sec-websocket-version': '13', 'sec-websocket-key': Buffer.alloc(16, 3).toString('base64') } }, socket, clientFrame(1, '{"v":1,"type":"HELLO","id":"Q01"}'));
  peer.on('message', value => messages.push(value));
  await Promise.resolve();
  assert.equal(messages[0]?.id, 'Q01');
});

test('commands propagate video and lobby settings, and reconnections invalidate clock samples', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'otrorayo-core-'));
  try {
    const controller = new Controller(dataDir), first = new FakePeer(), replacement = new FakePeer();
    const experience = { id: 'exp', name: 'Inmersión', eventName: 'Prueba', vr: { file: 'show.mp4', size: 20, sha256: 'a'.repeat(64), projection: '180', stereo: 'side-by-side', muted: false }, lobby: { preset: 'aurora', color: '#abcdef', particleIntensity: 0.7 } };
    await controller.setExperience(experience);
    await controller.select(['Q01']);
    controller.setConnection('Q01', first, '127.0.0.1');
    controller.receive('Q01', { v: 1, type: 'HEARTBEAT', observed: { contentStatus: 'READY', contentSha256: experience.vr.sha256, playback: 'READY', battery: 80 }, clock: { offsetMs: 12, rttMs: 8 } }, first);
    await controller.action('DISTRIBUTE');
    await controller.action('PREPARE');
    for (const message of first.messages.filter(m => m.type === 'COMMAND')) {
      assert.deepEqual(message.experience, experience);
      assert.deepEqual(message.content, experience.vr);
      assert.equal(message.eventName, experience.eventName);
    }
    assert.equal(controller.preflight().ready, true);
    controller.devices.get('Q01').clock.measuredAt = 1;
    controller.receive('Q01', { v: 1, type: 'HEARTBEAT', observed: {} }, first);
    assert.equal(controller.devices.get('Q01').clock.measuredAt, 1);
    controller.receive('Q01', { v: 1, type: 'HEARTBEAT', clock: { offsetMs: 0, rttMs: -1 } }, first);
    assert.equal(controller.devices.get('Q01').clock.measuredAt, 1);
    controller.setConnection('Q01', replacement, '127.0.0.2');
    assert.equal(controller.devices.get('Q01').clock, null);
    controller.receive('Q01', { v: 1, type: 'HEARTBEAT', clock: { offsetMs: 0, rttMs: 0 } }, first);
    assert.equal(controller.devices.get('Q01').clock, null);
    assert.equal(controller.preflight().ready, false);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});

test('selected clock samples retain their age and invalid ages never renew them', () => {
  const controller = new Controller(''), peer = new FakePeer();
  controller.desired.selected = ['Q01'];
  controller.desired.experience = { vr: { sha256: 'a'.repeat(64) } };
  controller.setConnection('Q01', peer, '127.0.0.1');
  const heartbeat = {
    v: 1, type: 'HEARTBEAT',
    observed: { contentStatus: 'READY', contentSha256: 'a'.repeat(64), playback: 'READY', battery: 80 },
    clock: { offsetMs: 12, rttMs: 8, sampleAgeMs: 14000 }
  };
  controller.receive('Q01', heartbeat, peer);
  const device = controller.devices.get('Q01'), measuredAt = device.clock.measuredAt;
  assert.equal(measuredAt, device.lastSeen - 14000);
  assert.equal(controller.preflight(measuredAt + 14999).ready, true);
  assert.equal(controller.preflight(measuredAt + 15000).ready, false);
  for (const sampleAgeMs of [-1, 15001, null, NaN, Infinity, '0']) {
    controller.receive('Q01', { ...heartbeat, clock: { ...heartbeat.clock, sampleAgeMs } }, peer);
    assert.equal(device.clock.measuredAt, measuredAt);
  }
  controller.receive('Q01', { ...heartbeat, clock: { offsetMs: 12, rttMs: 8 } }, peer);
  assert.equal(device.clock.measuredAt, device.lastSeen); // Legacy simulator omits age.
  controller.receive('Q01', { ...heartbeat, clock: { ...heartbeat.clock, sampleAgeMs: 15000 } }, peer);
  assert.equal(controller.preflight(device.lastSeen).ready, false);
});

test('API validates native settings and rejects malformed device tokens without exposing secrets', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'otrorayo-api-'));
  let app;
  try {
    await mkdir(path.join(dataDir, 'content'));
    await writeFile(path.join(dataDir, 'content', 'show.mp4'), 'sample');
    app = await startServer({ host: '127.0.0.1', port: 0, dataDir });
    await assert.rejects(startServer({ host: '127.0.0.1', port: app.port, dataDir }), { code: 'EADDRINUSE' });
    const base = `http://127.0.0.1:${app.port}`;
    const post = value => fetch(base + '/api/experience', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Prueba', file: 'show.mp4', ...value }) });
    const defaults = await (await post({})).json();
    assert.deepEqual({ projection: defaults.vr.projection, stereo: defaults.vr.stereo, muted: defaults.vr.muted }, { projection: '360', stereo: 'mono', muted: true });
    assert.deepEqual(defaults.lobby, { preset: 'orbit', color: '#75dec9', particleIntensity: 0.5 });
    const settings = { projection: '180', stereo: 'top-bottom', muted: false, lobby: { preset: 'minimal', color: '#AAbb00', particleIntensity: 0 } };
    const valid = await (await post(settings)).json();
    assert.deepEqual(valid.lobby, settings.lobby);
    assert.equal(valid.vr.stereo, 'top-bottom');
    assert.equal(valid.vr.projection, '180');
    assert.equal(valid.vr.muted, false);
    for (const invalid of [{ projection: 'flat' }, { stereo: 'stereo' }, { muted: 'false' }, { lobby: { preset: 'space' } }, { lobby: { color: 'red' } }, { lobby: { particleIntensity: 1.01 } }, { lobby: { particleIntensity: -1 } }]) {
      assert.equal((await post(invalid)).status, 400);
    }
    for (const token of ['é'.repeat(app.token.length), '%FF'.repeat(app.token.length), 'wrong']) {
      const queryToken = token.startsWith('%') ? token : encodeURIComponent(token);
      const response = await fetch(base + `/device/content?token=${queryToken}`);
      assert.equal(response.status, 401);
      assert.ok(!(await response.text()).includes(app.token));
      const upgradeResponse = await new Promise((resolve, reject) => {
        const req = http.get(base + `/ws/device?token=${queryToken}`, { headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': Buffer.alloc(16, 2).toString('base64') } }, res => {
          let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
      });
      assert.equal(upgradeResponse.status, 403);
      assert.ok(!upgradeResponse.body.includes(app.token));
    }
    const state = await fetch(base + '/api/state');
    assert.equal(state.status, 200);
    assert.ok(!(await state.text()).includes(app.token));
  } finally { await app?.close(); await rm(dataDir, { recursive: true, force: true }); }
});
