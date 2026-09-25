import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, parseDevices } from '../../scripts/quest.mjs';

test('provisión valida identidad y servidor, sin aceptar localhost ni URLs con secretos', () => {
  const token = 'test-only-token-123456789';
  assert.deepEqual(validateConfig('Q04', 'http://192.168.0.22:8787/', token), { id: 'Q04', serverUrl: 'http://192.168.0.22:8787', token });
  for (const id of ['Q00', 'Q11', '', 'Q1', 'Q01\n']) assert.throws(() => validateConfig(id, 'http://192.168.0.22:8787', token));
  for (const url of ['http://localhost:8787', 'http://127.0.0.1', 'http://[::1]', 'http://0.0.0.0', 'https://user:pass@192.168.0.22', 'file:///tmp/config', 'http://192.168.0.22/path', 'http://192.168.0.22?token=x']) assert.throws(() => validateConfig('Q01', url, token));
  assert.throws(() => validateConfig('Q01', 'http://192.168.0.22', ''));
});

test('distingue visores autorizados, offline y pendientes de permiso USB', () => {
  assert.deepEqual(parseDevices('List of devices attached\nA123\tdevice\nB456\tunauthorized\nC789\toffline\n'), [
    { serial: 'A123', state: 'device' }, { serial: 'B456', state: 'unauthorized' }, { serial: 'C789', state: 'offline' }
  ]);
  assert.deepEqual(parseDevices('List of devices attached\n\n'), []);
});
