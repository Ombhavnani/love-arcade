// ============================================================================
// state.js — server-authoritative session state machine. Every player action
// flows through here; the full (sanitised) state is broadcast to the room.
// ============================================================================
const { getLobbyBySocket, roomName } = require('./lobby');
const games = require('./games');
const progress = require('./progress');
const content = require('./content');
const { pick, strip } = require('./util');

function initProfile(room) {
  const [p0, p1] = room.state.players;
  room.state.profile = {
    players: [
      { name: p0.name, nickname: '' },
      { name: p1.name, nickname: '' },
    ],
    howMet: '', duration: '', distance: '', nextMeet: '', anniversary: '', firstDateRestaurant: '',
    memories: {},
    prefs: {},
    style: {},
    boundaries: {},
  };
}

function setPath(state, field, value) {
  if (!state.profile) return;
  const parts = String(field).split('.');
  let obj = state.profile;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
}

function syncProfile(state) {
  if (!state.profile) return;
  state.players.forEach((p, i) => {
    if (state.profile.players[i]) p.nickname = state.profile.players[i].nickname || '';
  });
}

// Strip anything the other player must not see (simultaneous answers, truth flags).
function sanitize(state) {
  const clone = JSON.parse(JSON.stringify(state));
  const g = clone.game;
  if (g && g.round) {
    const r = g.round;
    if (r.kind === 'telepathy') delete r.truthIdx;
    if (r.kind === 'escape' && r.clue) delete r.clue.correctIdx;
    if (g.room && Array.isArray(g.room.clues)) {
      for (const c of g.room.clues) if (c) delete c.correctIdx;
    }
    if (!r.resolved && r.answered && typeof r.answered === 'object') {
      r.answeredMask = { 0: r.answered[0] !== undefined, 1: r.answered[1] !== undefined };
      delete r.answered;
    }
  }
  return clone;
}

function broadcast(io, lobby) {
  if (!lobby) return;
  io.to(roomName(lobby.code)).emit('state', sanitize(lobby.state));
}

function buildClosing(room) {
  const state = room.state;
  state.closing = {
    hearts: state.session.hearts,
    totalHearts: state.couple ? state.couple.stats.heartsTotal : state.session.hearts,
    bestMoment: state.session.bestMoment || 'Just being here, together',
    memories: state.session.memorySavedTonight.map((m) => m.title),
    gamesPlayed: state.session.gamesPlayed.map((g) => (games.GAMES_META[g] ? games.GAMES_META[g].title : g)),
    mood: state.session.mood,
    achievements: state.achievementsUnlocked,
    message: pick(content.host.CLOSING_QUOTES),
    date: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  };
  if (state.couple && !state.sessionRecorded) {
    state.sessionRecorded = true;
    progress.recordSession(state.couple, {
      hearts: state.session.hearts,
      gamesPlayed: [...state.session.gamesPlayed],
      bestMoment: state.closing.bestMoment,
      memories: state.closing.memories,
      mood: state.session.mood,
    });
  }
}

function restartSession(room) {
  const state = room.state;
  state.session = {
    hearts: 0, gamesPlayed: [], bestMoment: null, memorySavedTonight: [],
    mood: null, doubleHearts: false, surprises: 0, lastGameSummary: null,
  };
  state.sessionRecorded = false;
  state.achievementsUnlocked = [];
  state.game = null;
  state.closing = null;
  state.hostLine = null;
  state.phase = 'mood';
}

function saveMemoryAtClosing(room, moment, emotion) {
  const state = room.state;
  if (!strip(moment)) return;
  const page = {
    title: content.host.memoryTitle(moment, emotion),
    moment: strip(moment),
    emotion,
    by: 'The Arcade',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  if (state.couple) {
    progress.addMemory(state.couple, page);
    progress.bump(state.couple, 'memoriesSaved');
  }
  state.session.memorySavedTonight.push(page);
  state.closing.memories.push(page.title);
}

// ---------------------------------------------------------------------------
function handleIntent(io, socket, intent) {
  const lobby = getLobbyBySocket(socket.id);
  if (!lobby) {
    socket.emit('error', { message: 'You are not in an arcade yet. Create or join one first! 🎮' });
    return;
  }
  const state = lobby.state;
  const player = state.players.find((p) => p.socketId === socket.id);
  if (!player) return;
  state.redLight = null; // transient — cleared on every action
  const action = intent.action;

  if (action === 'lobby:start') {
    if (state.phase !== 'lobby') return;
    if (state.players.length < 2) {
      socket.emit('error', { message: 'Your partner needs to join first — share the code! 💌' });
      return;
    }
    if (!state.players.every((p) => p.ready)) {
      socket.emit('error', { message: 'Both players need to tap READY first! 🎮' });
      return;
    }
    state.phase = 'profile';
    initProfile(lobby);
    state.hostLine = pick(content.host.GREETINGS(state.players[0], state.players[1]));
    broadcast(io, lobby);
    return;
  }

  if (action === 'lobby:ready') {
    if (state.phase !== 'lobby') return;
    player.ready = !player.ready;
    broadcast(io, lobby);
    return;
  }

  if (action === 'profile:set') {
    if (state.phase !== 'profile') return;
    const { field, value } = intent;
    if (!field) return;
    const personal = /^players\.\d+\.nickname$/.test(field);
    if (personal && !field.startsWith(`players.${player.idx}.`)) return;
    setPath(state, field, strip(value));
    syncProfile(state);
    if (state.profile && state.profile.players.every((p) => strip(p.name))) {
      state.returning = !!progress.findCouple(state.profile.players[0].name, state.profile.players[1].name);
    }
    broadcast(io, lobby);
    return;
  }

  if (action === 'profile:complete') {
    if (state.phase !== 'profile') return;
    const [n0, n1] = state.profile.players.map((p) => strip(p.name));
    if (!n0 || !n1) {
      socket.emit('error', { message: 'Both of you need a name first! 💕' });
      return;
    }
    const couple = progress.loadOrCreateCouple(n0, n1);
    state.coupleId = couple.id;
    state.couple = couple;
    if (couple.profile) {
      const prevNicks = [state.profile.players[0].nickname, state.profile.players[1].nickname];
      state.profile = { ...state.profile, ...couple.profile };
      state.profile.players = [
        { name: n0, nickname: prevNicks[0] || (couple.profile.players && couple.profile.players[0].nickname) || '' },
        { name: n1, nickname: prevNicks[1] || (couple.profile.players && couple.profile.players[1].nickname) || '' },
      ];
      syncProfile(state);
    }
    state.phase = 'welcome';
    state.hostLine = couple.sessions && couple.sessions.length
      ? pick(content.host.RETURNING_GREETINGS(n0, n1))
      : pick(content.host.GREETINGS(state.players[0], state.players[1]));
    progress.bump(couple, 'sessionsPlayed');
    for (const a of progress.unlockIfAny(couple)) {
      if (!state.achievementsUnlocked.some((x) => x.id === a.id)) state.achievementsUnlocked.push(a);
    }
    broadcast(io, lobby);
    return;
  }

  if (action === 'welcome:continue') {
    if (state.phase !== 'welcome') return;
    state.phase = 'mood';
    broadcast(io, lobby);
    return;
  }

  if (action === 'mood:pick') {
    if (state.phase !== 'mood') return;
    const mood = intent.mood;
    if (!['romantic', 'funny', 'deep', 'flirty', 'surprise', 'comfort'].includes(mood)) return;
    state.session.mood = mood;
    state.phase = 'gameselect';
    const names = state.players.map((p) => p.nickname || p.name).join(' & ');
    state.hostLine = content.host.MOOD_WELCOME[mood](names);
    broadcast(io, lobby);
    return;
  }

  if (action === 'game:pick') {
    if (state.phase !== 'gameselect') return;
    let gameName = intent.game;
    if (gameName === 'surprise') gameName = pick(['telepathy', 'darebare', 'memory', 'escape', 'story', 'future']);
    if (!games.GAMES_META[gameName]) return;
    state.phase = 'game';
    games.startGame(lobby, gameName);
    broadcast(io, lobby);
    return;
  }

  if (['game:start', 'game:answer', 'game:pass', 'game:react', 'game:claim', 'game:continue'].includes(action)) {
    const res = games.gameIntent(lobby, player, action.slice('game:'.length), intent.value);
    if (res && res.finished && state.phase === 'game') {
      state.phase = 'intermission';
      state.session.lastGameSummary = state.game ? state.game.summary : null;
    }
    broadcast(io, lobby);
    return;
  }

  if (action === 'intermission:choice') {
    if (state.phase !== 'intermission') return;
    const choice = intent.choice;
    if (choice === 'closing') {
      state.phase = 'closing';
      buildClosing(lobby);
    } else if (choice === 'surprise') {
      const kind = pick(games.SURPRISE_POOL);
      games.startSurprise(lobby, kind);
      state.phase = 'game';
    } else {
      state.phase = 'gameselect';
    }
    broadcast(io, lobby);
    return;
  }

  if (action === 'red:light') {
    if (state.phase === 'game' && state.game && state.game.status === 'round' && state.game.round && !state.game.round.resolved) {
      const round = state.game.round;
      round.answered = {};
      round.result = { skipped: true, hearts: 0, message: content.host.redLightReply(player.name) };
      round.resolved = true;
      state.game.status = 'result';
      state.game.ack = {};
    }
    state.redLight = { by: player.name, reply: content.host.redLightReply(player.name), at: Date.now() };
    broadcast(io, lobby);
    return;
  }

  if (action === 'session:end') {
    if (['gameselect', 'intermission', 'game'].includes(state.phase)) {
      state.phase = 'closing';
      buildClosing(lobby);
      broadcast(io, lobby);
    }
    return;
  }

  if (action === 'closing:continue') {
    if (state.phase !== 'closing') return;
    restartSession(lobby);
    broadcast(io, lobby);
    return;
  }

  if (action === 'closing:saveMemory') {
    if (state.phase !== 'closing') return;
    saveMemoryAtClosing(lobby, intent.moment, intent.emotion);
    broadcast(io, lobby);
    return;
  }
}

module.exports = { handleIntent, broadcast, sanitize };
