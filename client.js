/* ============================================================
   Love Arcade — Long Distance Edition · browser frontend
   ------------------------------------------------------------
   Connects to the Socket.IO backend via window.SERVER_URL
   (defined in index.html — swap it for your Render URL there).

   Protocol (matches server/index.js + server/state.js):
     emit  lobby:create { name }          -> cb { ok, code }
     emit  lobby:join   { code, name }    -> cb { ok } | { ok:false, error }
     emit  intent       { action, ... }   -> game actions
     on    state        (sanitised lobby state, broadcast to room)
     on    error        { message }
   ============================================================ */
(function () {
  'use strict';

  var SERVER_URL = window.SERVER_URL || 'http://localhost:3000';
  var app = document.getElementById('app');

  if (typeof io === 'undefined') {
    app.innerHTML = '<p>⚠️ Socket.IO client did not load. Check the CDN <code>&lt;script&gt;</code> in index.html.</p>';
    return;
  }

  /* ------------------------- styles ------------------------- */
  var style = document.createElement('style');
  style.textContent = [
    ':root{--pink:#ff4d8d;--cyan:#22e0e0;--bg:#0d0221;--panel:#1a0b35;--line:#3a1f6b;--text:#f5e9ff}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;min-height:100vh}',
    '#app{max-width:620px;margin:0 auto;padding:0 16px 70px}',
    '.banner{position:sticky;top:0;background:rgba(13,2,33,.92);padding:10px 4px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;border-bottom:1px solid var(--line);z-index:5;flex-wrap:wrap}',
    '.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}',
    '.dot.on{background:#35e07d}.dot.off{background:#ff4d4d}',
    '.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0}',
    'h1{text-align:center;font-size:26px;letter-spacing:.5px}',
    'h2{margin-top:0}',
    '.code{font-size:30px;letter-spacing:8px;color:var(--cyan);font-weight:700;text-align:center;margin:6px 0}',
    'button{background:linear-gradient(135deg,var(--pink),#b14bff);color:#fff;border:0;border-radius:12px;padding:12px 18px;font-size:15px;cursor:pointer;font-weight:600}',
    'button.cyan{background:linear-gradient(135deg,var(--cyan),#4b9dff)}',
    'button.ghost{background:transparent;border:1px solid #5a3d94;color:var(--text)}',
    'button:disabled{opacity:.45;cursor:default}',
    'button.option{display:block;width:100%;text-align:left;margin:8px 0;background:var(--bg);border:1px solid #5a3d94;color:var(--text);font-weight:400}',
    'button.option:hover{border-color:var(--pink)}',
    'input,textarea,select{width:100%;background:#0d0221;border:1px solid #3a1f6b;color:var(--text);border-radius:10px;padding:12px;font-size:15px;margin:4px 0 14px;font-family:inherit}',
    'label{font-size:13px;opacity:.8;display:block}',
    '.row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.muted{opacity:.65;font-size:13px}',
    '.big{font-size:20px;line-height:1.45}',
    'hr{border:0;border-top:1px solid var(--line);margin:16px 0}',
    '.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#3d0a1e;border:1px solid var(--pink);color:#ffd7e6;padding:12px 18px;border-radius:12px;max-width:90vw;font-size:14px;z-index:99;box-shadow:0 6px 24px rgba(0,0,0,.5)}'
  ].join('\n');
  document.head.appendChild(style);

  /* ---------------------- state ---------------------- */
  var state = null;          // latest broadcast state
  var connected = false;
  var myName = '';
  var myCode = '';
  var lastPhase = null;
  var rejoinOnConnect = false;
  var toastTimer = null;

  var META = {
    telepathy: { icon: '🧠', title: 'Partner Telepathy', tag: 'How well do you know each other?' },
    darebare:  { icon: '🎭', title: 'Dare or Bare', tag: 'Challenges & honest questions' },
    memory:    { icon: '📖', title: 'Memory Vault', tag: 'Turn memories into keepsakes' },
    escape:    { icon: '🔑', title: 'Escape Room', tag: 'Relationship puzzles' },
    story:     { icon: '🎬', title: 'Story Theatre', tag: 'Write a story together' },
    future:    { icon: '🔮', title: 'Future Builder', tag: "Imagine what's next" }
  };
  var MOODS = [
    { id: 'romantic', label: '💕 Romantic' }, { id: 'funny', label: '😂 Funny' },
    { id: 'deep', label: '🌌 Deep' }, { id: 'flirty', label: '😏 Flirty' },
    { id: 'surprise', label: '🎁 Surprise' }, { id: 'comfort', label: '🤗 Comfort' }
  ];
  var EMOTIONS = [
    { id: 'fun', icon: '😂', label: 'Laughter' }, { id: 'romantic', icon: '😍', label: 'Romance' },
    { id: 'tender', icon: '🥲', label: 'Tender' }, { id: 'wild', icon: '🔥', label: 'Wild' },
    { id: 'nostalgic', icon: '🕰️', label: 'Nostalgia' }
  ];

  /* ---------------------- helpers ---------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function me() {
    if (!state) return null;
    var bySocket = state.players.find(function (p) { return p.socketId === socket.id; });
    if (bySocket) return bySocket;
    if (myName) return state.players.find(function (p) { return p.name === myName; }) || null;
    return null;
  }
  function myIdx() { var p = me(); return p ? p.idx : -1; }
  function isHost() { return state && state.players[0] && state.players[0].socketId === socket.id; }
  function playerName(idx) {
    if (state && state.players[idx]) return state.players[idx].nickname || state.players[idx].name;
    return 'Player ' + (idx + 1);
  }
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 5000);
  }
  function headerHtml() {
    var label = (state && state.phase) || 'connecting';
    var hearts = state && state.session ? state.session.hearts : 0;
    return '<div class="banner">' +
      '<span><span class="dot ' + (connected ? 'on' : 'off') + '"></span>' +
      (connected ? 'connected' : 'offline') + '</span>' +
      '<span>❤️ <strong>' + hearts + '</strong></span>' +
      '<span class="muted">' + esc(label) + (state && state.code ? ' · ' + esc(state.code) : '') + '</span>' +
      '</div>';
  }
  function screen(html) {
    app.innerHTML = headerHtml() + '<div class="screen">' + html + '</div>';
  }
  function waitingCard(text) {
    return '<div class="card muted">⏳ ' + esc(text) + '</div>';
  }
  function answeredMark(mask, idx) {
    return mask && mask[idx] ? '✅ answered' : '… thinking';
  }

  /* ---------------------- socket ---------------------- */
  var socket = io(SERVER_URL);

  socket.on('connect', function () {
    connected = true;
    if (rejoinOnConnect && myName && myCode && lastPhase && lastPhase !== 'lobby') {
      socket.emit('lobby:join', { code: myCode, name: myName }, function (res) {
        if (!res || !res.ok) toast((res && res.error) || 'Reconnect failed — refresh to start over.');
      });
    }
    rejoinOnConnect = false;
    render();
  });
  socket.on('disconnect', function () {
    connected = false;
    if (state) rejoinOnConnect = true;
    render();
  });
  socket.on('connect_error', function () {
    connected = false;
    render();
    toast('Cannot reach the server at ' + SERVER_URL + '. Is the backend running?');
  });
  socket.on('state', function (st) {
    state = st;
    lastPhase = st.phase;
    if (st.code) myCode = st.code;
    render();
  });
  socket.on('error', function (e) {
    toast((e && e.message) || 'Something went wrong. 💔');
  });

  function send(action, payload) {
    var data = { action: action };
    if (payload) for (var k in payload) data[k] = payload[k];
    socket.emit('intent', data);
  }

  /* ------------------ action handling ------------------ */
  app.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    if (!form.dataset.action) return;
    var vals = {};
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.name) vals[el.name] = el.value.trim();
    });
    handleAction(form.dataset.action, vals);
  });

  app.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    handleAction(btn.dataset.action, btn.dataset);
  });

  function handleAction(action, d) {
    d = d || {};
    switch (action) {
      case 'create':
        myName = d.name || 'Player';
        socket.emit('lobby:create', { name: myName }, function (res) {
          if (res && res.ok) { myCode = res.code; toast('Arcade created! Share the code 💌'); }
          else toast((res && res.error) || 'Could not create an arcade.');
        });
        break;
      case 'join':
        myName = d.name || 'Player';
        myCode = String(d.code || '').trim().toUpperCase();
        socket.emit('lobby:join', { code: myCode, name: myName }, function (res) {
          if (res && res.ok) { myCode = res.code; }
          else toast((res && res.error) || 'Could not join that arcade.');
        });
        break;
      case 'reconnect': socket.connect(); break;
      case 'ready': send('lobby:ready'); break;
      case 'start': send('lobby:start'); break;
      case 'profile-nick':
        send('profile:set', { field: 'players.' + myIdx() + '.nickname', value: d.nickname });
        break;
      case 'profile-continue': send('profile:complete'); break;
      case 'welcome-continue': send('welcome:continue'); break;
      case 'mood': send('mood:pick', { mood: d.value }); break;
      case 'pick-game': send('game:pick', { game: d.value }); break;
      case 'start-game': send('game:start'); break;
      case 'answer':
        send('game:answer', { value: d.kind === 'idx' ? parseInt(d.value, 10) : d.value });
        break;
      case 'answer-text': send('game:answer', { value: d.value }); break;
      case 'pass': send('game:pass'); break;
      case 'claim': send('game:claim'); break;
      case 'react': send('game:react', { value: d.value }); break;
      case 'continue': send('game:continue'); break;
      case 'intermission': send('intermission:choice', { choice: d.value }); break;
      case 'redlight': send('red:light'); break;
      case 'closing-continue': send('closing:continue'); break;
      case 'save-memory':
        send('closing:saveMemory', { moment: d.moment, emotion: d.emotion });
        break;
    }
  }

  /* ---------------------- screens ---------------------- */
  function render() {
    if (!state) return renderHome();
    if (!connected) return renderOffline();
    switch (state.phase) {
      case 'lobby': return renderLobby();
      case 'profile': return renderProfile();
      case 'welcome': return renderWelcome();
      case 'mood': return renderMood();
      case 'gameselect': return renderGameSelect();
      case 'game': return renderGame();
      case 'intermission': return renderIntermission();
      case 'closing': return renderClosing();
      default: return renderHome();
    }
  }

  function renderHome() {
    screen(
      '<h1>❤️ Love Arcade</h1>' +
      '<p class="muted" style="text-align:center">Long Distance Edition — a two-player game night over one join code.</p>' +
      '<div class="card"><h2>Start an arcade</h2>' +
      '<form data-action="create">' +
      '<label>Your name</label>' +
      '<input name="name" maxlength="20" required placeholder="What should we call you?">' +
      '<button type="submit">❤️ Create Game</button>' +
      '</form></div>' +
      '<div class="card"><h2>Join your partner</h2>' +
      '<form data-action="join">' +
      '<label>Arcade code</label>' +
      '<input name="code" maxlength="5" required placeholder="e.g. ABC12" style="text-transform:uppercase">' +
      '<label>Your name</label>' +
      '<input name="name" maxlength="20" required placeholder="What should we call you?">' +
      '<button type="submit" class="cyan">Join Game</button>' +
      '</form></div>'
    );
  }

  function renderOffline() {
    var canRejoin = lastPhase && lastPhase !== 'lobby';
    var html = '<div class="card"><h2>😢 Connection lost</h2>';
    if (canRejoin && myCode && myName) {
      html += '<p>Reconnecting you to arcade <strong>' + esc(myCode) + '</strong>…</p>';
      html += '<div class="row"><button data-action="reconnect">Reconnect</button></div>';
    } else {
      html += '<p>Please refresh the page to get back into the arcade.</p>';
    }
    html += '</div>';
    screen(html);
  }

  function renderLobby() {
    var meP = me();
    var html = '<div class="card"><h2>🎮 Lobby</h2>';
    html += '<p class="code">' + esc(state.code) + '</p>';
    html += '<p class="muted" style="text-align:center">Share this code with your partner 💌</p>';
    html += state.players.map(function (p) {
      var you = p.socketId === socket.id ? ' (you)' : '';
      var status = p.connected ? (p.ready ? '✅ ready' : '⏳ not ready') : '💤 disconnected';
      return '<div class="card" style="margin:8px 0;padding:12px 16px">' +
        '<strong>' + esc(p.nickname || p.name) + '</strong>' + esc(you) +
        '<span class="muted"> — ' + status + '</span></div>';
    }).join('');
    html += '<div class="row">';
    html += '<button data-action="ready">' + (meP && meP.ready ? 'Not ready' : "I'm ready! ✅") + '</button>';
    if (isHost() && state.players.length === 2) {
      html += '<button data-action="start" class="cyan"' +
        (state.players.every(function (p) { return p.ready && p.connected; }) ? '' : ' disabled') +
        '>Start ❤️</button>';
    }
    html += '</div>';
    if (state.players.length < 2) html += '<p class="muted">Waiting for your partner to join…</p>';
    html += '</div>';
    screen(html);
  }

  function renderProfile() {
    var meP = me();
    var html = '<div class="card"><h2>💞 Who are we?</h2>';
    html += '<p class="muted">' + state.players.map(function (p) { return esc(p.nickname || p.name); }).join(' & ') + '</p>';
    html += '<form data-action="profile-nick">';
    html += '<label>Your nickname (optional)</label>';
    html += '<input name="nickname" maxlength="20" value="' + esc(meP ? (meP.nickname || '') : '') + '" placeholder="What should we call you?">';
    html += '<button type="submit">Save nickname</button>';
    html += '</form>';
    html += '<div class="row"><button data-action="profile-continue" class="cyan">Continue ➡️</button></div>';
    html += '</div>';
    screen(html);
  }

  function renderWelcome() {
    var html = '<div class="card"><h2>🎉 Welcome back</h2>';
    if (state.hostLine) html += '<p class="big">' + esc(state.hostLine) + '</p>';
    html += '<div class="row"><button data-action="welcome-continue" class="cyan">Continue ➡️</button></div>';
    html += '</div>';
    screen(html);
  }

  function renderMood() {
    var html = '<div class="card"><h2>🌙 Set the mood</h2>';
    html += '<div class="grid">' + MOODS.map(function (m) {
      return '<button data-action="mood" data-value="' + m.id + '">' + m.label + '</button>';
    }).join('') + '</div></div>';
    screen(html);
  }

  function renderGameSelect() {
    var html = '<div class="card"><h2>🎰 Pick a game</h2>';
    if (state.hostLine) html += '<p class="muted">' + esc(state.hostLine) + '</p>';
    html += '<div class="grid">';
    html += Object.keys(META).map(function (id) {
      var g = META[id];
      return '<button data-action="pick-game" data-value="' + id + '" style="height:auto;text-align:center;padding:14px 10px">' +
        '<span style="font-size:26px">' + g.icon + '</span><br><strong>' + esc(g.title) + '</strong><br>' +
        '<span class="muted">' + esc(g.tag) + '</span></button>';
    }).join('');
    html += '</div>';
    html += '<div class="row"><button data-action="pick-game" data-value="surprise" class="ghost" style="width:100%">🎁 Surprise me</button></div>';
    html += '</div>';
    screen(html);
  }

  function renderGame() {
    var g = state.game;
    if (!g) return renderGameSelect();
    if (g.status === 'intro') {
      var m = META[g.name];
      var html = '<div class="card"><h2>' + (m ? m.icon + ' ' + m.title : esc(g.name)) + '</h2>';
      if (m) html += '<p>' + esc(m.desc) + '</p>';
      html += '<p class="muted">' + g.totalRounds + ' round' + (g.totalRounds === 1 ? '' : 's') + '</p>';
      html += '<div class="row"><button data-action="start-game" class="cyan">Start ▶️</button></div></div>';
      return screen(html);
    }
    if (g.status === 'round') return screen(renderRound(g));
    if (g.status === 'result') return screen(renderResult(g));
    if (g.status === 'finished') return screen(renderFinished(g));
    screen('<div class="card"><p>One moment…</p></div>');
  }

  function roundTitle(g) {
    if (g.name === 'surprise') {
      var t = {
        mystery_challenge: '🎭 Mystery Challenge',
        song_challenge: '🎵 Song Challenge',
        secret_message: '💌 Secret Message',
        double_hearts: '🎁 Double Hearts!',
        memory_flashback: '🕰️ Memory Flashback'
      }[g.kind];
      return t || '🎁 Surprise';
    }
    var m = META[g.name];
    return m ? m.icon + ' ' + m.title : esc(g.name);
  }

  function renderRound(g) {
    var r = g.round;
    if (!r) return '<div class="card">Loading round…</div>';
    var html = '<div class="card"><h2>' + roundTitle(g) + '</h2>' +
      '<p class="muted">Round ' + g.roundNum + ' of ' + g.totalRounds + '</p>';

    if (r.kind === 'telepathy') {
      html += '<p class="big">' + esc(r.promptTarget || r.promptGuesser || '') + '</p>';
      if (r.mode === 'truth') {
        html += '<p class="muted">' + esc(playerName(r.target)) + ' answers the truth, ' +
          esc(playerName(r.guesser)) + ' guesses.</p>';
      }
      html += (r.options || []).map(function (opt, i) {
        return '<button class="option" data-action="answer" data-kind="idx" data-value="' + i + '">' + esc(opt) + '</button>';
      }).join('');
      html += '<p class="muted">You: ' + answeredMark(r.answeredMask, myIdx()) + '</p>';
    } else if (r.kind === 'darebare' || r.kind === 'mystery_challenge') {
      html += '<p class="big">' + esc(r.prompt) + '</p>';
      if (myIdx() === r.responder) {
        html += '<form data-action="answer-text"><textarea name="value" rows="2" maxlength="200" placeholder="Your answer…"></textarea>' +
          '<button type="submit">Submit</button></form>';
        if (r.passAllowed) html += '<div class="row"><button data-action="pass" class="ghost">Pass</button></div>';
      } else {
        html += waitingCard('Waiting for ' + playerName(r.responder) + '…');
      }
    } else if (r.kind === 'memory') {
      html += '<p class="big">' + esc(r.prompt) + '</p>';
      if (myIdx() === r.responder) {
        if (r.phase === 'share') {
          html += '<form data-action="answer-text"><textarea name="value" rows="3" maxlength="300" placeholder="Share a memory…"></textarea>' +
            '<button type="submit">Save memory</button></form>';
        } else if (r.phase === 'emotion') {
          html += '<p class="muted">What emotion should this page carry?</p>' +
            EMOTIONS.map(function (e) {
              return '<button class="option" data-action="answer" data-value="' + e.id + '">' + e.icon + ' ' + e.label + '</button>';
            }).join('');
        }
      } else {
        html += waitingCard('Waiting for ' + playerName(r.responder) + '…');
      }
    } else if (r.kind === 'escape') {
      html += '<p class="big">' + esc(r.clue.prompt) + '</p>';
      html += (r.clue.options || []).map(function (opt, i) {
        return '<button class="option" data-action="answer" data-kind="idx" data-value="' + i + '">' + esc(opt) + '</button>';
      }).join('');
      html += '<p class="muted">You: ' + answeredMark(r.answeredMask, myIdx()) +
        ' · Partner: ' + answeredMark(r.answeredMask, 1 - myIdx()) + '</p>';
    } else if (r.kind === 'story') {
      if (r.runningStory && r.runningStory.length) {
        html += '<div class="card" style="margin:8px 0"><p class="big">' + esc(r.runningStory.join(' ')) + '</p></div>';
      }
      html += '<p class="muted">' + esc(r.prompt) + '</p>';
      if (myIdx() === r.responder) {
        html += '<form data-action="answer-text"><input name="value" maxlength="140" placeholder="Add the next line…">' +
          '<button type="submit">Add line</button></form>';
      } else {
        html += waitingCard('Waiting for ' + playerName(r.responder) + '…');
      }
    } else if (r.kind === 'future') {
      html += '<p class="big">' + esc(r.prompt) + '</p>';
      if (myIdx() === r.responder) {
        html += '<form data-action="answer-text"><textarea name="value" rows="2" maxlength="200" placeholder="Your answer…"></textarea>' +
          '<button type="submit">Submit</button></form>';
      } else {
        html += waitingCard('Waiting for ' + playerName(r.responder) + '…');
      }
    } else if (r.kind === 'song_challenge' || r.kind === 'secret_message') {
      html += '<p class="big">' + esc(r.prompt) + '</p>';
      html += '<form data-action="answer-text"><input name="value" maxlength="140" placeholder="Type it here…">' +
        '<button type="submit">Send</button></form>';
      html += '<p class="muted">You: ' + answeredMark(r.answeredMask, myIdx()) + '</p>';
    } else {
      html += waitingCard('Waiting for the arcade…');
    }
    return html + '</div>';
  }

  function continueControls() {
    var g = state.game;
    var acked = !!(g.ack && g.ack[myIdx()]);
    if (acked) return waitingCard('You continued — waiting for your partner…');
    return '<div class="row"><button data-action="continue" class="cyan">Continue ➡️</button>' +
      '<button data-action="redlight" class="ghost">🔴 Red light</button></div>';
  }

  function renderResult(g) {
    var r = g.round;
    var res = (r && r.result) || {};
    var html = '<div class="card"><h2>' + roundTitle(g) + '</h2>';
    if (res.message) html += '<p class="big">' + esc(res.message) + '</p>';

    if (res.page) {
      html += '<div class="card" style="border-color:var(--pink)"><h3>📖 ' + esc(res.page.title) + '</h3>' +
        '<p>' + esc(res.page.moment) + '</p>' +
        '<p class="muted">' + esc(res.page.emotion) + ' · by ' + esc(res.page.by) + ' · ' + esc(res.page.time) + '</p></div>';
    }
    if (res.title && res.story) {
      html += '<div class="card" style="border-color:var(--cyan)"><h3>🎬 ' + esc(res.title) + '</h3><p>' + esc(res.story) + '</p></div>';
    }
    if (res.theme) {
      html += '<div class="card" style="border-color:var(--cyan)"><h3>' + esc(res.icon || '🔮') + ' ' + esc(res.theme) + '</h3>' +
        (res.answers || []).map(function (a) {
          return '<p><strong>' + esc(a.by) + ':</strong> ' + esc(a.answer) + '</p>';
        }).join('') + '</div>';
    }
    if (res.songs) {
      html += '<div class="card"><p><strong>' + esc(playerName(0)) + ':</strong> 🎵 ' + esc(res.songs[0] || '—') + '</p>' +
        '<p><strong>' + esc(playerName(1)) + ':</strong> 🎵 ' + esc(res.songs[1] || '—') + '</p></div>';
    }
    if (res.notes) {
      html += '<div class="card"><p><strong>' + esc(playerName(0)) + ':</strong> ' + esc(res.notes[0] || '—') + '</p>' +
        '<p><strong>' + esc(playerName(1)) + ':</strong> ' + esc(res.notes[1] || '—') + '</p></div>';
    }
    if (res.memory) {
      html += '<div class="card" style="border-color:var(--pink)"><h3>🕰️ ' + esc(res.memory.title) + '</h3>' +
        '<p>' + esc(res.memory.moment) + '</p><p class="muted">' + esc(res.memory.emotion) + '</p></div>';
    }
    if (res.note) html += '<p class="muted">' + esc(res.note) + '</p>';
    if (res.answer) html += '<p class="muted">The answer: <strong>' + esc(res.answer) + '</strong></p>';
    if (res.hint) html += '<p>🕯️ Hint: ' + esc(res.hint) + '</p>';

    if (res.challenge && !res.challengeClaimed) {
      html += '<div class="row"><button data-action="claim" class="ghost">🎪 Claim the challenge (+2 ❤️)</button></div>';
    }
    if (res.hearts) html += '<p class="muted">+' + res.hearts + ' ❤️</p>';
    html += continueControls();
    return html + '</div>';
  }

  function renderFinished(g) {
    var html = '<div class="card"><h2>' + roundTitle(g) + ' — Complete!</h2>';
    if (g.summary) {
      html += '<p>❤️ Hearts earned: <strong>' + g.summary.hearts + '</strong></p>';
      if (g.summary.matches !== undefined) html += '<p>Telepathy matches: <strong>' + g.summary.matches + '</strong></p>';
    }
    if (g.hostClosing) html += '<p class="big">' + esc(g.hostClosing) + '</p>';
    html += '<div class="row"><button data-action="continue" class="cyan">Continue ➡️</button></div>';
    return html + '</div>';
  }

  function renderIntermission() {
    var html = '<div class="card"><h2>🌌 Intermission</h2>';
    html += '<p>Total hearts: <strong>' + state.session.hearts + '</strong> 💕</p>';
    if (state.session.lastGameSummary) {
      var last = state.game && state.game.name;
      var lm = META[last];
      html += '<p class="muted">Last game: ' + (lm ? lm.icon + ' ' + lm.title : esc(last || 'finished')) + '</p>';
    }
    html += '<div class="row">' +
      '<button data-action="intermission" data-value="gameselect" class="cyan">More games</button>' +
      '<button data-action="intermission" data-value="surprise">🎁 Surprise</button>' +
      '<button data-action="intermission" data-value="closing" class="ghost">End the night</button>' +
      '</div></div>';
    screen(html);
  }

  function renderClosing() {
    var c = state.closing || {};
    var html = '<div class="card"><h2>🌙 Good night, lovebirds</h2>';
    if (c.message) html += '<p class="big">' + esc(c.message) + '</p>';
    html += '<p>Tonight: <strong>' + (c.hearts || 0) + ' ❤️</strong>' +
      (c.totalHearts ? ' · <span class="muted">' + c.totalHearts + ' all-time</span>' : '') + '</p>';
    html += '<p>Best moment: <strong>' + esc(c.bestMoment || 'Just being here, together') + '</strong></p>';
    if (c.memories && c.memories.length) {
      html += '<p>Memories saved tonight:</p><ul>' +
        c.memories.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    }
    if (c.gamesPlayed && c.gamesPlayed.length) {
      html += '<p class="muted">Games: ' + c.gamesPlayed.map(esc).join(', ') + '</p>';
    }
    html += '<form data-action="save-memory">';
    html += '<label>Save one more memory</label>';
    html += '<input name="moment" maxlength="300" placeholder="A moment worth keeping…">';
    html += '<select name="emotion">' + EMOTIONS.map(function (e) {
      return '<option value="' + e.id + '">' + e.icon + ' ' + e.label + '</option>';
    }).join('') + '</select>';
    html += '<button type="submit">💾 Save memory</button>';
    html += '</form>';
    html += '<div class="row"><button data-action="closing-continue" class="cyan">Play again 🔁</button></div>';
    html += '</div>';
    screen(html);
  }

  /* ---------------------- bootstrap ---------------------- */
  render();
})();








