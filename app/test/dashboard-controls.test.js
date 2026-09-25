import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../src/core.js';
import { blockReason, nextStep } from '../public/controls.js';

const stale = () => ({ desired: { phase: 'PAUSED', selected: ['Q01'], experience: { vr: { sha256: 'abc' } } }, devices: [{ id: 'Q01', online: true, observed: { playback: 'LOBBY', contentStatus: 'MISSING' } }], preflight: { ready: false, checks: [] } });

test('a stale paused session has a one-click recovery and explains blocked controls', () => {
  const state = stale();
  assert.equal(blockReason(state, 'LOBBY'), '');
  for (const action of ['DISTRIBUTE', 'PREPARE', 'SELECT', 'RESUME', 'PLAY']) assert.match(blockReason(state, action), /Volver al inicio/);
  assert.match(nextStep(state), /no coincide/);
  state.desired.phase = 'IDLE';
  assert.equal(blockReason(state, 'DISTRIBUTE'), '');
  assert.equal(blockReason(state, 'SELECT'), '');
  assert.match(nextStep(state), /Distribuir/);
});

test('Play waits for every selected headset and the preflight clock gate', () => {
  const state = stale(); state.desired.phase = 'READY';
  state.devices[0].observed = { playback: 'READY', contentStatus: 'READY', contentSha256: 'abc' };
  state.preflight = { ready: false, checks: [{label: 'Q01 reloj', status: 'BLOCK', detail: 'Sin medición'}] };
  assert.match(blockReason(state, 'PLAY'), /reloj/);
  state.preflight = { ready: true, checks: [] };
  assert.equal(blockReason(state, 'PLAY'), '');
  state.desired.selected.push('Q02');
  assert.match(blockReason(state, 'PLAY'), /todos los visores/);
});

test('server rejects resume after a headset returned to lobby, then resets the old timeline', async () => {
  const c = new Controller('/unused'); c.save = async () => {};
  c.desired = { ...c.desired, phase: 'PAUSED', selected: ['Q01'], pausedAtMs: 30824541, startAt: 1, scheduledAt: 2 };
  c.devices.set('Q01', { connected: true, lastSeen: Date.now(), observed: { playback: 'LOBBY' } });
  await assert.rejects(c.action('RESUME'), /ya no está pausado/);
  assert.equal(c.desired.phase, 'PAUSED');
  await c.action('LOBBY');
  assert.equal(c.desired.phase, 'IDLE');
  assert.equal(c.desired.pausedAtMs, 0);
  assert.equal(c.desired.startAt, null);
  assert.equal(c.desired.scheduledAt, null);
});
