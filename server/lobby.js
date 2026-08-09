// Lobby manager — create a room, get a code, a second device joins by code.
const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L ambiguity
const MAX_PLAYERS = 2;
const COLORS = ['neon-pink', 'neon-cyan'];

const lobbies = new Map(); // code -> lobby

function genCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  } while (lobbies.has(code));
  return code;
}

const roomName = (code) => 'lobby:' + code;

function initialState(code) {
  return {
    code,
    phase: 'lobby', // lobby | profile | welcome | mood | gameselect | game | intermission | closing | closed
    players: [],
    profile: null,
    coupleId: null,
    returning: false,
    session: {
      hearts: 0,
      gamesPlayed: [],
      bestMoment: null,
      memorySavedTonight: [],
      mood: null,
      doubleHearts: false,
      surprises: 0,
      lastGameSummary: null,
    },
    couple: null,
    achievementsUnlocked: [],
    game: null,
    closing: null,
    history: [],
  };
}

function player(socket, name, idx) {
  return {
    socketId: socket.id,
    name: String(name).slice(0, 20),
    nickname: '',
    idx,
    connected: true,
    ready: false,
    color: COLORS[idx],
  };
}

function createLobby(socket, name) {
  const code = genCode();
  const lobby = { code, hostSocketId: socket.id, createdAt: Date.now(), state: initialState(code) };
  lobby.state.players.push(player(socket, name, 0));
  lobbies.set(code, lobby);
  socket.join(roomName(code));
  return lobby;
}

function joinLobby(socket, code, name) {
  const lobby = lobbies.get(code);
  if (!lobby) return { ok: false, error: 'Hmm, no arcade found with that code. Double-check the letters! 💌' };

  // A player who dropped mid-session can reconnect to their own seat.
  if (lobby.state.phase !== 'lobby') {
    const slot = lobby.state.players.find((p) => !p.connected && String(p.name).toLowerCase() === String(name).trim().toLowerCase());
    if (slot) {
      slot.socketId = socket.id;
      slot.connected = true;
      socket.join(roomName(code));
      return { ok: true, lobby };
    }
    return { ok: false, error: 'That arcade already started its session. Ask for a fresh code! 🕹️' };
  }

  if (lobby.state.players.length >= MAX_PLAYERS) return { ok: false, error: 'That arcade is full — it only seats two lovebirds. 🎟️' };
  if (lobby.state.players.some((p) => p.socketId === socket.id)) return { ok: false, error: 'You are already in this arcade. 🎮' };
  lobby.state.players.push(player(socket, name, 1));
  socket.join(roomName(code));
  return { ok: true, lobby };
}

function getLobby(code) {
  return lobbies.get(code);
}

function getLobbyBySocket(socketId) {
  for (const l of lobbies.values()) if (l.state.players.some((p) => p.socketId === socketId)) return l;
  return null;
}

// Cleanup abandoned lobbies (older than 24h).
function sweep() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [code, l] of lobbies) if (l.createdAt < cutoff) lobbies.delete(code);
}

module.exports = { createLobby, joinLobby, getLobby, getLobbyBySocket, roomName, sweep };
