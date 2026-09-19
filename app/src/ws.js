import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

// Small RFC 6455 text-only server for the offline prototype. Binary and extensions are rejected.
export class SocketPeer extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    socket.on('data', chunk => this.receive(chunk));
    socket.on('close', () => { this.closed = true; this.emit('close'); });
    socket.on('error', error => this.emit('error', error));
  }
  send(value) { this.frame(1, Buffer.from(JSON.stringify(value))); }
  frame(opcode, payload = Buffer.alloc(0)) {
    if (this.closed) return;
    const length = payload.length;
    const header = length < 126 ? Buffer.from([0x80 | opcode, length]) :
      length < 65536 ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 255]) : null;
    if (!header) throw new Error('WebSocket frame too large');
    this.socket.write(Buffer.concat([header, payload]));
  }
  close(code = 1000) {
    if (this.closed) return;
    this.frame(8, Buffer.from([code >> 8, code & 255]));
    this.socket.end();
    this.closed = true;
  }
  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 1024 * 1024) return this.close(1009);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fin = !!(b0 & 128), opcode = b0 & 15, masked = !!(b1 & 128);
      let length = b1 & 127, pos = 2;
      if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); pos = 4; }
      if (length === 127 || length > 65536 || !masked || !fin) return this.close(1002);
      if (this.buffer.length < pos + 4 + length) return;
      const mask = this.buffer.subarray(pos, pos + 4); pos += 4;
      const payload = Buffer.from(this.buffer.subarray(pos, pos + length));
      this.buffer = this.buffer.subarray(pos + length);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 8) return this.close();
      if (opcode === 9) { this.frame(10, payload); continue; }
      if (opcode !== 1) return this.close(1003);
      try { this.emit('message', JSON.parse(payload.toString('utf8'))); }
      catch { this.close(1007); return; }
    }
  }
}

export function upgrade(request, socket, head) {
  const key = request.headers['sec-websocket-key'];
  if (request.headers.upgrade?.toLowerCase() !== 'websocket' ||
      request.headers['sec-websocket-version'] !== '13' ||
      typeof key !== 'string' || Buffer.from(key, 'base64').length !== 16) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return null;
  }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const peer = new SocketPeer(socket);
  if (head.length) peer.receive(head);
  return peer;
}
