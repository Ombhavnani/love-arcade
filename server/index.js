// Love Arcade — Express + Socket.IO server. Serves the frontend and runs the
// realtime lobby + game state for every connected couple.
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const os = require('os');
const { createLobby, joinLobby, getLobbyBySocket, roomName, sweep } = require('./lobby');
const { handleIntent, broadcast } = require('./state');
const { load } = require('./progress');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (req, res) => res.json({ ok: true, lobbies: io.engine.clientsCount }));

load();
setInterval(sweep, 60 * 60 * 1000);

io.on('connection', (socket) => {
  socket.on('lobby:create', ({ name } = {}, cb) => {
    const lobby = createLobby(socket, String(name || 'Player').slice(0, 20));
    if (cb) cb({ ok: true, code: lobby.code });
    broadcast(io, lobby);
  });

  socket.on('lobby:join', ({ code, name } = {}, cb) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const cleanName = String(name || 'Player').slice(0, 20);
    const result = joinLobby(socket, cleanCode, cleanName);
    if (cb) cb(result.ok ? { ok: true, code: cleanCode } : { ok: false, error: result.error });
    if (result.ok) broadcast(io, result.lobby);
  });

  socket.on('intent', (intent) => {
    try {
      handleIntent(io, socket, intent || {});
    } catch (err) {
      console.error('intent error:', err);
      socket.emit('error', { message: 'Something glitched in the machine — please try that again. 🛠️' });
    }
  });

  socket.on('disconnect', () => {
    const lobby = getLobbyBySocket(socket.id);
    if (!lobby) return;
    const p = lobby.state.players.find((pl) => pl.socketId === socket.id);
    if (p) p.connected = false;
    broadcast(io, lobby);
  });
});

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ❤️   LOVE ARCADE — Long Distance Edition  ❤️');
  console.log('  ─────────────────────────────────────────────');
  console.log(`   Play on THIS device:      http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`   Other device (same Wi-Fi): http://${ip}:${PORT}`);
  }
  console.log('  ─────────────────────────────────────────────');
  console.log('   Player 1: tap CREATE GAME   ·   Player 2: JOIN with the code\n');
});
