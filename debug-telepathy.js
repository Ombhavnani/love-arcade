// Debug script: trace a telepathy round end-to-end.
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: String(PORT) }, cwd: path.join(__dirname), stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => console.log('SERVER-ERR:', d.toString()));

function connect(name) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

(async () => {
  await sleep(1300);
  const p1 = await connect('Om');
  const p2 = await connect('Aarushi');
  p1.on('state', (st) => console.log('P1 state:', JSON.stringify({ phase: st.phase, status: st.game && st.game.status, roundNum: st.game && st.game.roundNum, roundResolved: st.game && st.game.round && st.game.round.resolved, answeredMask: st.game && st.game.round && st.game.round.answeredMask, result: st.game && st.game.round && st.game.round.result && st.game.round.result.match })));
  p2.on('error', (e) => console.log('P2 ERR:', e));

  const code = await new Promise((res) => p1.emit('lobby:create', { name: 'Om' }, res));
  await new Promise((res) => p2.emit('lobby:join', { code: code.code, name: 'Aarushi' }, res));
  p1.emit('intent', { action: 'lobby:ready' });
  p2.emit('intent', { action: 'lobby:ready' });
  await sleep(200);
  p1.emit('intent', { action: 'lobby:start' });
  await sleep(200);
  p1.emit('intent', { action: 'profile:complete' });
  await sleep(200);
  p1.emit('intent', { action: 'welcome:continue' });
  await sleep(200);
  p1.emit('intent', { action: 'mood:pick', mood: 'romantic' });
  await sleep(200);
  p1.emit('intent', { action: 'game:pick', game: 'telepathy' });
  await sleep(200);
  p1.emit('intent', { action: 'game:start' });
  await sleep(200);

  console.log('--- p1 answers option 0 ---');
  p1.emit('intent', { action: 'game:answer', value: 0 });
  await sleep(200);
  console.log('--- p2 answers option 1 ---');
  p2.emit('intent', { action: 'game:answer', value: 1 });
  await sleep(300);
  console.log('--- claim + continue x2 ---');
  p1.emit('intent', { action: 'game:claim' });
  await sleep(100);
  p1.emit('intent', { action: 'game:continue' });
  await sleep(100);
  p2.emit('intent', { action: 'game:continue' });
  await sleep(300);
  console.log('--- round 2: answer again ---');
  p1.emit('intent', { action: 'game:answer', value: 0 });
  await sleep(100);
  p2.emit('intent', { action: 'game:answer', value: 1 });
  await sleep(300);
  console.log('--- done ---');
  p1.disconnect();
  p2.disconnect();
  server.kill();
  process.exit(0);
})();
