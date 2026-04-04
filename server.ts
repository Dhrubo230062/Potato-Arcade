import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Next from 'next';
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dev  = process.env.NODE_ENV !== 'production';
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// @ts-ignore
const app    = (Next.default || Next)({ dev });
const handle = app.getRequestHandler();
const server = express();
const httpServer = createServer(server);
server.use(express.json({ limit: '1mb' }));

const io = new Server(httpServer, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, pingInterval: 25000,
});

// ── Types ────────────────────────────────────────────────────────────────────
interface Player { id: string; name: string; isOp: boolean; }
interface Room   { host: string; players: Player[]; game: any; }

const rooms = new Map<string, Room>();

// ── Admin auth (no DB — simple credentials) ──────────────────────────────────
const ADMIN_USER    = process.env.ADMIN_USER || 'Dhrubo';
const ADMIN_PASS    = process.env.ADMIN_PASS || '230095*#';
const adminSessions = new Set<string>();
const makeToken     = () => crypto.randomBytes(32).toString('hex');

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, max = 5, ms = 60_000): boolean {
  const now = Date.now(), e = loginAttempts.get(ip);
  if (!e || now > e.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + ms }); return true; }
  if (e.count >= max) return false;
  e.count++; return true;
}
setInterval(() => { const now = Date.now(); for (const [k,v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k); }, 300_000);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!adminSessions.has(req.headers['x-admin-token'] as string))
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const FILE_DIRS: Record<string, string> = {
  roms:   path.join(process.cwd(), 'public', 'roms', 'neogeo'),
  images: path.join(process.cwd(), 'public', 'image'),
};

// ── Health ────────────────────────────────────────────────────────────────────
server.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Local IP detection ───────────────────────────────────────────────────────
import os from 'os';
function getLocalIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

server.get('/api/local-ip', (_req, res) => {
  const ip = getLocalIp();
  const port = process.env.PORT || 3000;
  res.json({ ip, url: ip ? `http://${ip}:${port}` : null });
});


// ── Admin API ─────────────────────────────────────────────────────────────────
server.post('/api/admin/login', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
  if (!rateLimit(ip)) return res.status(429).json({ error: 'Too many attempts' });
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const t = makeToken(); adminSessions.add(t); return res.json({ token: t });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

server.post('/api/admin/logout', requireAdmin, (req, res) => {
  adminSessions.delete(req.headers['x-admin-token'] as string); res.json({ ok: true });
});

server.get('/api/admin/files', requireAdmin, (req, res) => {
  const folder = FILE_DIRS[req.query.dir as string];
  if (!folder) return res.status(400).json({ error: 'Invalid dir' });
  if (!fs.existsSync(folder)) return res.json([]);
  res.json(fs.readdirSync(folder)
    .filter(n => !fs.statSync(path.join(folder,n)).isDirectory())
    .map(name => { const s = fs.statSync(path.join(folder,name)); return { name, size: s.size, modified: s.mtime.toISOString() }; }));
});

server.post('/api/admin/upload', requireAdmin, (req, res) => {
  const folder = FILE_DIRS[req.query.dir as string];
  if (!folder) return res.status(400).json({ error: 'Invalid dir' });
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
  if (!boundary) return res.status(400).json({ error: 'No boundary' });
  const MAX = 100 * 1024 * 1024; let total = 0; const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => {
    total += c.length;
    if (total > MAX) { req.destroy(); return res.status(413).json({ error: 'Max 100 MB' }); }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks), sep = Buffer.from('--' + boundary);
      const saved: string[] = []; let pos = 0;
      while (true) {
        const idx = body.indexOf(sep, pos); if (idx === -1) break;
        const ps = idx + sep.length + 2, ni = body.indexOf(sep, ps); if (ni === -1) break;
        const part = body.slice(ps, ni-2), he = part.indexOf('\r\n\r\n'); if (he === -1) { pos = ni; continue; }
        const m = part.slice(0, he).toString().match(/filename="([^"]+)"/);
        const data = part.slice(he + 4);
        if (m && data.length > 0) { fs.writeFileSync(path.join(folder, path.basename(m[1])), data); saved.push(path.basename(m[1])); }
        pos = ni;
      }
      if (!saved.length) return res.status(400).json({ error: 'No files' }); res.json({ saved });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
});

server.delete('/api/admin/file', requireAdmin, (req, res) => {
  const folder = FILE_DIRS[req.query.dir as string], name = path.basename(req.query.name as string);
  if (!folder || !name) return res.status(400).json({ error: 'Missing params' });
  const t = path.join(folder, name); if (!fs.existsSync(t)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(t); res.json({ ok: true });
});

server.patch('/api/admin/rename', requireAdmin, (req, res) => {
  const { dir, oldName, newName } = req.body, folder = FILE_DIRS[dir];
  if (!folder || !oldName || !newName) return res.status(400).json({ error: 'Missing params' });
  const src = path.join(folder, path.basename(oldName)), dst = path.join(folder, path.basename(newName));
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Not found' });
  fs.renameSync(src, dst); res.json({ ok: true });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create-room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms.set(roomId, { host: socket.id, players: [], game: null });
    socket.join(roomId);
    callback({ roomId });
  });

  socket.on('join-room', ({ roomId, name }: { roomId: string; name: string }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false, message: 'Room not found' });
    if (room.players.length >= 4) return callback({ success: false, message: 'Room is full' });
    const isOp = room.players.length === 0;
    const player: Player = { id: socket.id, name: name?.trim() || `Player ${room.players.length + 1}`, isOp };
    room.players.push(player);
    socket.join(roomId);
    io.to(roomId).emit('player-joined', room.players);
    callback({ success: true, players: room.players, isOp });
  });

  socket.on('get-room-info', (roomId: string, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false });
    callback({ success: true, players: room.players, game: room.game });
  });

  socket.on('select-game', ({ roomId, game }: { roomId: string; game: any }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (!room.players.find(p => p.id === socket.id)?.isOp && room.host !== socket.id) return;
    room.game = game; io.to(roomId).emit('game-selected', game);
  });

  socket.on('start-game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId); if (!room || !room.game) return;
    if (!room.players.find(p => p.id === socket.id)?.isOp && room.host !== socket.id) return;
    // Notify each player individually with their playerIdx so WebRTC can use it
    room.players.forEach((player, idx) => {
      io.to(player.id).emit('game-started', { ...room.game, playerIdx: idx });
    });
    io.to(room.host).emit('game-started', room.game);
  });

  socket.on('kick-player', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (!room.players.find(p => p.id === socket.id)?.isOp && room.host !== socket.id) return;
    const idx = room.players.findIndex(p => p.id === playerId); if (idx === -1) return;
    const [kicked] = room.players.splice(idx, 1);
    if (kicked.isOp && room.players.length > 0) room.players[0].isOp = true;
    io.to(playerId).emit('kicked');
    io.to(roomId).emit('player-left', room.players);
  });

  socket.on('transfer-op', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (!room.players.find(p => p.id === socket.id)?.isOp && room.host !== socket.id) return;
    room.players.forEach(p => { p.isOp = p.id === playerId; });
    io.to(roomId).emit('player-joined', room.players);
  });

  socket.on('webrtc-offer', ({ roomId, offer }: { roomId: string; offer: any }) => {
    const room = rooms.get(roomId); if (!room) return;
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    io.to(room.host).emit('webrtc-offer', { offer, from: socket.id, playerIdx });
  });

  socket.on('webrtc-answer', ({ roomId, answer, to }: { roomId: string; answer: any; to: string }) => {
    io.to(to).emit('webrtc-answer', { answer });
  });

  socket.on('webrtc-ice', ({ roomId, candidate, to }: { roomId: string; candidate: any; to: string }) => {
    const room = rooms.get(roomId); if (!room) return;
    const target = to === 'host' ? room.host : to;
    io.to(target).emit('webrtc-ice', { candidate, from: socket.id });
  });

  socket.on('rejoin-as-host', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId); if (!room) return;
    // Update host to the current socket (handles socket reconnect after page navigation)
    room.host = socket.id;
    socket.join(roomId);
  });

  socket.on('controller-input', ({ roomId, input, state }: { roomId: string; input: string; state: 'down' | 'up' }) => {
    const room = rooms.get(roomId); if (!room) return;
    const hostSocket = io.sockets.sockets.get(room.host);
    if (!hostSocket) { io.to(roomId).emit('room-closed'); rooms.delete(roomId); return; }
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi !== -1) hostSocket.emit('player-input', { playerIndex: pi, input, state });
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.host === socket.id) {
        io.to(roomId).emit('room-closed'); rooms.delete(roomId);
      } else {
        const pi = room.players.findIndex(p => p.id === socket.id);
        if (pi !== -1) {
          const [r] = room.players.splice(pi, 1);
          if (r.isOp && room.players.length > 0) room.players[0].isOp = true;
          io.to(roomId).emit('player-left', room.players);
        }
      }
    }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function main() {
  await app.prepare();
  server.all('*', (req, res) => handle(req, res, parse(req.url!, true)));
  httpServer.listen(port, '0.0.0.0', () =>
    console.log(`[SERVER] ✅ Ready — http://localhost:${port}`)
  );
}

main().catch((err: Error) => { console.error('[SERVER] ❌', err); process.exit(1); });
