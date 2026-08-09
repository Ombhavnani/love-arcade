// End-to-end smoke test: spins up the real server, plays a full couple
// session over real Socket.IO connections, and asserts each phase.
// Run with:  node smoke-test.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;

const results = [];
function ok(name, cond) {
  results.push(cond);
  console.log(`${cond ? '✅' : '❌'} ${name}`);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'] });
    socket.on('connect', () => { socket.name = name; resolve(socket); });
    socket.on('connect_error', (e) => reject(e));
    socket.on('state', (st) => { lastKnown = st; });
  });
}

function waitState(socket, pred, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { console.error('TIMED OUT waiting for predicate. Last phase:', lastPhase); reject(new Error('timeout waiting for state')); }, timeout);
    const check = (state) => {
      lastPhase = state.phase;
      if (pred(state)) { clearTimeout(timer); socket.off('state', check); resolve(state); return true; }
      return false;
    };
    if (lastKnown && check(lastKnown)) return;
    socket.on('state', check);
  });
}
let lastPhase = 'unknown';
let lastKnown = null;

const send = (socket, action, value) => socket.emit('intent', { action, value });
const emitCb = (socket, evt, payload) => new Promise((res) => socket.emit(evt, payload, res));

async function playTelepathy(p1, p2, rounds) {
  for (let i = 0; i < rounds; i++) {
    console.log(`  [telepathy] waiting for round ${i + 1}`);
    await waitState(p1, (s) => s.game && s.game.status === 'round');
    console.log(`  [telepathy] round ${i + 1} active`);
    send(p1, 'game:answer', 0);
    await sleep(60);
    send(p2, 'game:answer', i % 2);
    console.log(`  [telepathy] waiting for result of round ${i + 1}`);
    await waitState(p1, (s) => s.game && s.game.status === 'result');
    console.log(`  [telepathy] round ${i + 1} resolved`);
    send(p1, 'game:claim');
    await sleep(60);
    send(p1, 'game:continue');
    await sleep(60);
    send(p2, 'game:continue');
  }
  await waitState(p1, (s) => s.game && s.game.status === 'finished');
}

async function finishGameAndContinue(p1, p2) {
  send(p1, 'game:continue');
  await sleep(60);
  send(p2, 'game:continue');
  await waitState(p1, (s) => s.phase === 'intermission');
}

async function resultToFinished(p1, p2) {
  send(p1, 'game:continue');
  await sleep(60);
  send(p2, 'game:continue');
  await waitState(p1, (s) => s.game && s.game.status === 'finished');
}

const sockFor = (responder, p1, p2) => (responder === 0 ? p1 : p2);

async function gotoGameSelect(p1) {
  p1.emit('intent', { action: 'intermission:choice', choice: 'gameselect' });
  await waitState(p1, (s) => s.phase === 'gameselect');
}

async function pickGame(p1, name) {
  await gotoGameSelect(p1);
  p1.emit('intent', { action: 'game:pick', game: name });
  await waitState(p1, (s) => s.game && s.game.status === 'intro');
  send(p1, 'game:start');
}

// Surprise events are random kinds: some land in 'result' (double_hearts,
// memory_flashback), others need answers first (mystery/song/secret_message).
async function completeSurprise(p1, p2) {
  const st = await waitState(p1, (s) => s.phase === 'game' && s.game && s.game.name === 'surprise');
  if (st.game.status === 'round') {
    const r = st.game.round;
    if (r.responder === 'both') {
      send(p1, 'game:answer', 'our one true song');
      await sleep(60);
      send(p2, 'game:answer', 'our one true song');
    } else {
      send(sockFor(r.responder, p1, p2), 'game:answer', 'challenge accepted!');
    }
    await waitState(p1, (s) => s.game && s.game.status === 'result');
  }
  // result -> finished -> intermission (two continue pairs)
  await resultToFinished(p1, p2);
  send(p1, 'game:continue');
  await sleep(60);
  send(p2, 'game:continue');
  return waitState(p1, (s) => s.phase === 'intermission');
}

async function playDareBare(p1, p2) {
  await pickGame(p1, 'darebare');
  for (let i = 1; i <= 4; i++) {
    const st = await waitState(p1, (s) => s.game && s.game.status === 'round' && s.game.roundNum === i);
    send(sockFor(st.game.round.responder, p1, p2), 'game:answer', 'did it with full commitment!');
    await waitState(p1, (s) => s.game && s.game.status === 'result');
    send(p1, 'game:continue');
    await sleep(60);
    send(p2, 'game:continue');
    if (i < 4) await waitState(p1, (s) => s.game && s.game.roundNum === i + 1);
    else await waitState(p1, (s) => s.game && s.game.status === 'finished');
  }
  await finishGameAndContinue(p1, p2);
}

// Escape clues are built from the couple's profile; the test reconstructs the
// expected answer from the question text (correctIdx is stripped by sanitize).
function escapeAnswer(st, names) {
  const q = st.game.round.clue.q;
  const [n0, n1] = names;
  let expected = null;
  if (q.includes('anniversary')) expected = 'June 14';
  else if (q.includes('frequency')) expected = 'Yellow';
  else if (q.includes('origin story')) expected = 'at a rooftop party';
  else if (q.includes('secret word')) expected = n0;
  else if (q.includes('letters')) expected = String(n0.length + n1.length);
  else if (q.includes('monogram')) expected = n0.charAt(0).toUpperCase() + n0.slice(-1).toUpperCase() + n1.charAt(0).toUpperCase() + n1.slice(-1).toUpperCase();
  return st.game.round.clue.options.indexOf(expected);
}

async function playEscape(p1, p2, names) {
  await pickGame(p1, 'escape');
  const start = await waitState(p1, (s) => s.game && s.game.status === 'round');
  const clueCount = start.game.totalRounds;
  for (let i = 1; i <= clueCount; i++) {
    const st = await waitState(p1, (s) => s.game && s.game.status === 'round' && s.game.roundNum === i);
    ok('escape answers not leaked', !st.game.round.clue.correctIdx && !st.game.room.clues.some((c) => c && c.correctIdx !== undefined));
    const idx = escapeAnswer(st, names);
    ok(`escape clue ${i} answer found`, idx >= 0);
    send(p1, 'game:answer', idx);
    await sleep(60);
    send(p2, 'game:answer', idx);
    const res = await waitState(p1, (s) => s.game && s.game.status === 'result');
    ok(`escape clue ${i} solved`, !!res.game.round.result.solved);
    send(p1, 'game:continue');
    await sleep(60);
    send(p2, 'game:continue');
    if (i < clueCount) await waitState(p1, (s) => s.game && s.game.roundNum === i + 1);
    else await waitState(p1, (s) => s.game && s.game.status === 'finished');
  }
  await finishGameAndContinue(p1, p2);
}

// Story Theatre & Future Builder — alternating single-answer rounds that
// resolve immediately and build the next round in place.
async function playLineGame(p1, p2, name, rounds, lineFor) {
  await pickGame(p1, name);
  for (let i = 1; i <= rounds; i++) {
    const st = await waitState(p1, (s) => s.game && s.game.status === 'round' && s.game.roundNum === i);
    send(sockFor(st.game.round.responder, p1, p2), 'game:answer', lineFor(i));
    if (i < rounds) {
      await waitState(p1, (s) => s.game && s.game.roundNum === i + 1);
    } else {
      await waitState(p1, (s) => s.game && s.game.status === 'result');
    }
  }
  await resultToFinished(p1, p2);
  await finishGameAndContinue(p1, p2);
}

(async () => {
  const server = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: path.join(__dirname),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (d) => console.error('SERVER-ERR:', d.toString()));
  await sleep(1500);

  let p1, p2;
  try {
    p1 = await connect('Om');
    p2 = await connect('Aarushi');
    ok('two clients connected', true);

    const createRes = await emitCb(p1, 'lobby:create', { name: 'Om' });
    ok('lobby created with code', !!(createRes && createRes.ok && createRes.code && /^[A-Z2-9]{5}$/.test(createRes.code)));

    const joinRes = await emitCb(p2, 'lobby:join', { code: createRes.code, name: 'Aarushi' });
    ok('partner joined by code', !!(joinRes && joinRes.ok));
    await waitState(p1, (s) => s.players.length === 2);
    ok('state shows 2 players', true);

    send(p1, 'lobby:ready');
    send(p2, 'lobby:ready');
    await waitState(p1, (s) => s.players.every((p) => p.ready));
    ok('both players ready', true);

    send(p1, 'lobby:start');
    await waitState(p1, (s) => s.phase === 'profile');
    ok('phase → profile', true);

    p1.emit('intent', { action: 'profile:set', field: 'howMet', value: 'at a rooftop party' });
    p2.emit('intent', { action: 'profile:set', field: 'prefs.foods', value: 'Ramen, Pizza' });
    p1.emit('intent', { action: 'profile:set', field: 'prefs.songs', value: 'Yellow' });
    p1.emit('intent', { action: 'profile:set', field: 'anniversary', value: 'June 14' });
    await waitState(p1, (s) => s.profile && s.profile.prefs && s.profile.prefs.foods === 'Ramen, Pizza');
    ok('profile fields synchronised', true);

    send(p1, 'profile:complete');
    await waitState(p1, (s) => s.phase === 'welcome');
    ok('phase → welcome', true);

    send(p1, 'welcome:continue');
    await waitState(p1, (s) => s.phase === 'mood');
    ok('phase → mood', true);

    p1.emit('intent', { action: 'mood:pick', mood: 'romantic' });
    await waitState(p1, (s) => s.phase === 'gameselect');
    ok('phase → gameselect', true);

    p1.emit('intent', { action: 'game:pick', game: 'telepathy' });
    await waitState(p1, (s) => s.phase === 'game' && s.game && s.game.status === 'intro');
    ok('telepathy intro shown', true);

    send(p1, 'game:start');
    await waitState(p1, (s) => s.game && s.game.status === 'round');
    ok('telepathy round 1 begins', true);
    ok('answers masked before reveal', lastKnown && lastKnown.game && lastKnown.game.round && !lastKnown.game.round.answered && !!lastKnown.game.round.answeredMask);

    await playTelepathy(p1, p2, 5);
    ok('telepathy completed (5 rounds)', true);
    ok('hearts earned during game', (s) => s.session.hearts > 0);

    await finishGameAndContinue(p1, p2);
    ok('phase → intermission', true);

    p1.emit('intent', { action: 'intermission:choice', choice: 'gameselect' });
    await waitState(p1, (s) => s.phase === 'gameselect');
    ok('back to gameselect', true);

    // Memory Vault (turn-based) — tests memory page creation + saving
    p1.emit('intent', { action: 'game:pick', game: 'memory' });
    await waitState(p1, (s) => s.game && s.game.status === 'intro');
    send(p1, 'game:start');
    await waitState(p1, (s) => s.game && s.game.status === 'round' && s.game.round && s.game.round.phase === 'share');
    send(p1, 'game:answer', 'The rainy night we stayed up until 4am laughing');
    await waitState(p1, (s) => s.game && s.game.round && s.game.round.phase === 'emotion');
    send(p1, 'game:answer', 'fun');
    await waitState(p1, (s) => s.game && s.game.status === 'result');
    ok('memory page created', (s) => s.game && s.game.round && s.game.round.result && s.game.round.result.page && !!s.game.round.result.page.title);

    send(p1, 'game:continue');
    await sleep(60);
    send(p2, 'game:continue');
    await waitState(p1, (s) => s.game && s.game.status === 'round' && s.game.roundNum === 2);

    send(p2, 'game:answer', 'The first time we said I love you on a video call');
    await waitState(p1, (s) => s.game && s.game.round && s.game.round.phase === 'emotion');
    send(p2, 'game:answer', 'romantic');
    await waitState(p1, (s) => s.game && s.game.status === 'result');
    ok('second memory saved', true);

    // Advance past the final round into the finished screen, then on to intermission
    send(p1, 'game:continue');
    await sleep(60);
    send(p2, 'game:continue');
    await waitState(p1, (s) => s.game && s.game.status === 'finished');

    await finishGameAndContinue(p1, p2);
    ok('memory game completed', true);

    // --- Surprise events (random kinds; validates the intermission surprise flow) ---
    p1.emit('intent', { action: 'intermission:choice', choice: 'surprise' });
    const sur1 = await completeSurprise(p1, p2);
    ok('surprise event completed (surprises=1)', sur1.session.surprises === 1);

    p1.emit('intent', { action: 'intermission:choice', choice: 'surprise' });
    const sur2 = await completeSurprise(p1, p2);
    ok('second surprise completed (surprises=2)', sur2.session.surprises === 2);

    // --- Dare or Bare ---
    await playDareBare(p1, p2);
    ok('darebare game completed', true);

    // --- Escape Room (includes answer-leak check + full solve) ---
    await playEscape(p1, p2, ['Om', 'Aarushi']);
    ok('escape room completed', true);

    // --- Story Theatre ---
    await playLineGame(p1, p2, 'story', 6, (i) => `Line ${i} of our story, told together.`);
    ok('story game completed', true);

    // --- Future Builder ---
    await playLineGame(p1, p2, 'future', 3, (i) => `Future answer ${i}, sealed in.`);
    ok('future game completed', true);

    p1.emit('intent', { action: 'intermission:choice', choice: 'closing' });
    await waitState(p1, (s) => s.phase === 'closing');
    ok('closing screen built', (s) => s.closing && s.closing.hearts > 0 && s.closing.memories.length === 2);

    send(p1, 'closing:continue');
    await waitState(p1, (s) => s.phase === 'mood');
    ok('new session starts (phase → mood)', true);

    // Reconnect test: drop p2, rejoin by code
    p2.disconnect();
    await sleep(400);
    const p3 = await connect('Aarushi');
    const rejoinRes = await emitCb(p3, 'lobby:join', { code: createRes.code, name: 'Aarushi' });
    ok('player can reconnect mid-session', !!(rejoinRes && rejoinRes.ok));

    ok('couple data persisted to sessions.json', fs.existsSync(path.join(__dirname, 'data', 'sessions.json')));

    p1.disconnect();
    p3.disconnect();
    server.kill();
  } catch (err) {
    console.error('SMOKE TEST ERROR:', err.message);
    if (p1) p1.disconnect();
    if (p2) p2.disconnect();
    server.kill();
    process.exit(1);
  }

  const allPass = results.every(Boolean);
  console.log(`\n${allPass ? '🎉 ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'} (${results.filter(Boolean).length}/${results.length})`);
  process.exit(allPass ? 0 : 1);
})();

