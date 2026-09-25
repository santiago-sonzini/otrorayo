import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../src/server.js';

// Usage: node app/quest/Tests/Core/integration.mjs [path/to/dotnet]
const dotnet = process.argv[2] || 'dotnet';
const directory = await mkdtemp(path.join(tmpdir(), 'otrorayo-quest-integration-'));
let server;
let faultInjection;
try {
  await mkdir(path.join(directory, 'content'));
  const content = Buffer.alloc(300000);
  for (let i = 0; i < content.length; i++) content[i] = i % 251;
  await writeFile(path.join(directory, 'content', 'test.mp4'), content);
  server = await startServer({ host: '127.0.0.1', port: 0, dataDir: directory });
  await server.controller.setExperience({ id: 'core-test', name: 'Core test', eventName: 'Test', vr: {
    file: 'test.mp4', size: content.length, sha256: createHash('sha256').update(content).digest('hex')
  } });
  let sessions = 0;
  const setConnection = server.controller.setConnection.bind(server.controller);
  server.controller.setConnection = (...args) => { sessions++; return setConnection(...args); };
  const receive = server.controller.receive.bind(server.controller);
  server.controller.receive = (id, message) => {
    // The second TCP session stays open but sends no probe replies, simulating a network blackhole.
    if (sessions === 2 && message.type === 'CLOCK_PROBE') return;
    return receive(id, message);
  };
  faultInjection = setInterval(() => {
    const peer = server.controller.connections.get('Q01');
    if (!peer) return;
    clearInterval(faultInjection);
    const payload = Buffer.from(JSON.stringify({ v: 1, type: 'FRAGMENT_TEST', eventName: 'órbita ✨' }));
    const split = payload.indexOf(Buffer.from('ó')) + 1;
    peer.socket.write(Buffer.concat([Buffer.from([0x01, split]), payload.subarray(0, split)]));
    peer.socket.write(Buffer.concat([Buffer.from([0x80, payload.length - split]), payload.subarray(split)]));
    setTimeout(() => peer.close(), 400).unref();
  }, 20);
  const project = fileURLToPath(new URL('./CoreTests.csproj', import.meta.url));
  const child = spawn(dotnet, ['run', '--project', project, '--', `http://127.0.0.1:${server.port}`, server.token], { stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw new Error(`Quest core harness exited ${code}`);
} finally {
  clearInterval(faultInjection);
  if (server) await server.close();
  await rm(directory, { recursive: true, force: true });
}
