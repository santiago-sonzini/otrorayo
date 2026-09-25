import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const MAX_MESSAGE_BYTES = 64 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });

// RFC 6455 JSON text transport. Fragmented messages and control frames support native clients.
export class SocketPeer extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.fragments = null;
    this.fragmentBytes = 0;
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
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 1024 * 1024) return this.close(1009);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fin = !!(b0 & 128), opcode = b0 & 15, masked = !!(b1 & 128);
      if ((b0 & 0x70) || !masked || ![0, 1, 2, 8, 9, 10].includes(opcode)) return this.close(1002);
      if (opcode >= 8 && (!fin || (b1 & 127) > 125)) return this.close(1002);
      let length = b1 & 127, pos = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2); pos = 4;
        if (length < 126) return this.close(1002);
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const wideLength = this.buffer.readBigUInt64BE(2);
        if (wideLength >> 63n || wideLength < 65536n) return this.close(1002);
        if (wideLength > BigInt(MAX_MESSAGE_BYTES)) return this.close(1009);
        length = Number(wideLength); pos = 10;
      }
      if (length > MAX_MESSAGE_BYTES) return this.close(1009);
      if (opcode === 0 && !this.fragments || opcode === 1 && this.fragments) return this.close(1002);
      if (opcode === 2) return this.close(1003);
      if (opcode < 8 && this.fragmentBytes + length > MAX_MESSAGE_BYTES) return this.close(1009);
      if (this.buffer.length < pos + 4 + length) return;
      const mask = this.buffer.subarray(pos, pos + 4); pos += 4;
      const payload = Buffer.from(this.buffer.subarray(pos, pos + length));
      this.buffer = this.buffer.subarray(pos + length);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 8) {
        if (length === 1) return this.close(1002);
        if (length >= 2) {
          const code = payload.readUInt16BE(0);
          if (!(code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code) || code >= 3000 && code <= 4999)) return this.close(1002);
          try { utf8.decode(payload.subarray(2)); } catch { return this.close(1007); }
        }
        this.frame(8, payload); this.socket.end(); this.closed = true; return;
      }
      if (opcode === 9) { this.frame(10, payload); continue; }
      if (opcode === 10) continue;
      if (opcode === 1 && !fin) { this.fragments = [payload]; this.fragmentBytes = length; continue; }
      let complete = payload;
      if (opcode === 0) {
        if (this.fragments.length >= 1024) return this.close(1009);
        this.fragments.push(payload); this.fragmentBytes += length;
        if (!fin) continue;
        complete = Buffer.concat(this.fragments, this.fragmentBytes);
        this.fragments = null; this.fragmentBytes = 0;
      }
      let message;
      try { message = JSON.parse(utf8.decode(complete)); }
      catch { return this.close(1007); }
      this.emit('message', message);
      if (this.closed) return;
    }
  }
}

export function upgrade(request, socket, head) {
  const key = request.headers['sec-websocket-key'];
  if (request.method !== 'GET' || request.headers.upgrade?.toLowerCase() !== 'websocket' ||
      !request.headers.connection?.split(',').some(value => value.trim().toLowerCase() === 'upgrade') ||
      request.headers['sec-websocket-version'] !== '13' ||
      typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || Buffer.from(key, 'base64').length !== 16) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return null;
  }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const peer = new SocketPeer(socket);
  // HELLO may share the upgrade packet: install server listeners before consuming it.
  if (head.length) queueMicrotask(() => peer.receive(head));
  return peer;
}
