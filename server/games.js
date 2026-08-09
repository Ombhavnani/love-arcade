// ============================================================================
// LOVE ARCADE game engine — server-authoritative logic for all 6 games +
// the surprise system. Every game is a sequence of synchronous rounds.
// ============================================================================
const content = require('./content');
const progress = require('./progress');
const { pick, shuffle, chance, strip } = require('./util');

const GAMES_META = {
  telepathy: { icon: '🧠', title: 'Partner Telepathy', tag: 'How well do you know each other?',
    desc: 'The machine asks a question about one of you. Both answer at the same time. Match = hearts. Mismatch = a very silly tax.' },
  darebare: { icon: '🎭', title: 'Dare or Bare', tag: 'Challenges & honest questions',
    desc: 'Fun challenges and heartfelt questions. Passing is always allowed. No pressure, ever.' },
  memory: { icon: '📖', title: 'Memory Vault', tag: 'Turn memories into keepsakes',
    desc: 'Share a memory, pick its emotion, and watch the Host stamp it into a Memory Page.' },
  escape: { icon: '🔑', title: 'Escape Room', tag: 'Relationship puzzles',
    desc: 'You are trapped inside a room made of your own story. Solve the clues together to escape.' },
  story: { icon: '🎬', title: 'Story Theatre', tag: 'Write a story together',
    desc: 'The Host hands you a place, a feeling and an object. You two write the rest, one line each.' },
  future: { icon: '🔮', title: 'Future Builder', tag: 'Imagine what\'s next',
    desc: 'Design your perfect weekend, first home or dream vacation — together, in real time.' },
};

const SURPRISE_NAMES = {
  double_hearts: { icon: '🎁', title: 'Double Hearts!' },
  mystery_challenge: { icon: '🎭', title: 'Mystery Challenge' },
  memory_flashback: { icon: '🕰️', title: 'Memory Flashback' },
  song_challenge: { icon: '🎵', title: 'Song Challenge' },
  secret_message: { icon: '💌', title: 'Secret Messages' },
};

function heartMult(room) {
  return room.state.session.doubleHearts ? 2 : 1;
}

function earn(room, n) {
  const gained = n * heartMult(room);
  room.state.session.hearts += gained;
  if (room.state.couple) {
    progress.addHearts(room.state.couple, gained);
    for (const a of progress.unlockIfAny(room.state.couple)) {
      if (!room.state.achievementsUnlocked.some((x) => x.id === a.id)) room.state.achievementsUnlocked.push(a);
    }
  }
  return gained;
}

const bothAnswered = (round, required) => required.every((i) => round.answered[i] !== undefined);

// ---------------------------------------------------------------------------
// startGame — initialise a game (or surprise) and remember chosen content.
// ---------------------------------------------------------------------------
function startGame(room, name) {
  room.state.session.doubleHearts = false; // the flag is consumed when a game starts
  const game = {
    name,
    mood: room.state.session.mood || 'romantic',
    status: 'intro',
    roundNum: 0,
    totalRounds: 0,
    hearts: 0,
    round: null,
    ack: {},
    history: [],
    summary: null,
    startedAt: Date.now(),
  };
  room.state.game = game;

  if (name === 'telepathy') game.totalRounds = 5;
  if (name === 'darebare') game.totalRounds = 4;
  if (name === 'memory') game.totalRounds = 2;
  if (name === 'escape') {
    const built = content.escape.buildRoom(room.state.profile, room.state.history.map((h) => h.room).filter(Boolean));
    game.room = built;
    game.solvedClues = 0;
    game.totalRounds = built.clues.length;
    game.history.push(built.name);
    room.state.history.push({ t: Date.now(), room: built.name, type: 'escape_room' });
  }
  if (name === 'story') {
    game.element = content.story.rollStoryElements([]);
    game.lines = [];
    game.title = null;
    game.totalRounds = 6;
  }
  if (name === 'future') {
    game.theme = content.future.buildTheme(room.state.profile, []);
    game.answers = [];
    game.totalRounds = game.theme.subPrompts.length;
  }
  game.hostLine = pick(content.host.JOKES);
  room.state.history.push({ t: Date.now(), type: 'game_start', game: name });
  return { changed: true };
}

function buildRound(room, game) {
  if (game.name === 'telepathy') return buildTelepathyRound(room, game);
  if (game.name === 'darebare') return buildDareBareRound(room, game);
  if (game.name === 'memory') return buildMemoryRound(room, game);
  if (game.name === 'escape') return buildEscapeRound(room, game);
  if (game.name === 'story') return buildStoryRound(room, game);
  if (game.name === 'future') return buildFutureRound(room, game);
  return null;
}

// ---------------------------------------------------------------------------
// PARTNER TELEPATHY
// ---------------------------------------------------------------------------
function buildTelepathyRound(room, game) {
  const profile = room.state.profile;
  const targetIdx = game.roundNum % 2;
  const guesserIdx = 1 - targetIdx;
  const target = room.state.players[targetIdx];
  const builders = [
    content.telepathy.comfortFoodQ, content.telepathy.karaokeQ,
    content.telepathy.movieNightQ, content.telepathy.lazySundayQ,
  ];
  let truthQ = null;
  for (const b of shuffle(builders)) {
    const q = b(profile, target);
    if (q) { truthQ = q; break; }
  }
  let mode = 'agree';
  let promptTarget, promptGuesser, options, truthIdx = -1;
  if (truthQ && chance(0.7)) {
    mode = 'truth';
    promptTarget = truthQ.promptTarget;
    promptGuesser = truthQ.promptGuesser;
    options = truthQ.options.map((o) => o.label);
    truthIdx = truthQ.options.findIndex((o) => o.truth);
  } else {
    const aq = pick(content.telepathy.AGREE_POOL);
    mode = 'agree';
    promptTarget = aq.prompt;
    promptGuesser = aq.prompt;
    options = aq.options;
  }
  return {
    kind: 'telepathy', mode, target: targetIdx, guesser: guesserIdx,
    promptTarget, promptGuesser, options, truthIdx,
    responder: 'both', answered: {}, resolved: false, result: null,
  };
}

function resolveTelepathy(room, game) {
  const round = game.round;
  const a = round.answered[round.target];
  const b = round.answered[round.guesser];
  const match = a === b;
  let hearts = 0;
  if (match) {
    hearts = earn(room, 4);
    if (room.state.couple) progress.bump(room.state.couple, 'telepathyMatches');
    round.result = {
      match: true, hearts,
      message: pick([
        `Telepathy UNLOCKED! 🧠💞 You two share one brain, and it's adorable.`,
        `SNAP. Exactly the same answer. The machine is impressed. 💘`,
        `A match! The neon heart glows so bright it alarms the neighbors. 🧠❤️`,
      ]),
      challenge: null,
    };
    room.state.session.bestMoment = `The telepathy match on "${round.options[a]}"`;
  } else {
    hearts = earn(room, 1);
    round.result = {
      match: false, hearts,
      message: pick([
        `So close! The machine giggles. Time for the silly tax. 😂`,
        `Different brains today! That's okay — the tax is very fun. 🎪`,
      ]),
      challenge: pick(content.telepathy.FUNNY_CHALLENGES),
    };
  }
  round.resolved = true;
  game.ack = {};
  game.hearts += hearts;
  if (!game.rounds) game.rounds = [];
  game.rounds.push({ roundNum: game.roundNum, match, options: round.options, answers: { ...round.answered } });
  game.status = 'result';
  return { changed: true };
}

// ---------------------------------------------------------------------------
// DARE OR BARE
// ---------------------------------------------------------------------------
function buildDareBareRound(room, game) {
  const mood = room.state.session.mood || 'romantic';
  const responder = game.roundNum % 2 === 1 ? 1 : 0;
  const other = 1 - responder;
  const moodBias = { funny: 0.75, flirty: 0.55, romantic: 0.45, deep: 0.3, comfort: 0.35, surprise: 0.5 }[mood] ?? 0.5;
  const wantDare = chance(moodBias);
  let item;
  if (wantDare) {
    item = content.darebare.pickDare(room.state.profile, room.state.players[responder], room.state.players[other], mood, game.history);
  } else {
    item = content.darebare.pickBare(room.state.profile, room.state.players[responder], room.state.players[other], mood, game.history);
  }
  game.history.push(item.key);
  return {
    kind: 'darebare', type: item.type, prompt: item.prompt,
    responder, other, passAllowed: true,
    answered: {}, resolved: false, result: null,
  };
}

function resolveDareBare(room, game) {
  const round = game.round;
  const passed = round.answered[round.responder] === '__PASS__';
  if (passed) {
    round.result = { passed: true, hearts: 0, message: 'Pass respected. Zero pressure, full respect. 💛', reaction: null };
  } else {
    const hearts = earn(room, round.type === 'dare' ? 4 : 5);
    game.hearts += hearts;
    if (round.type === 'dare') {
      if (room.state.couple) {
        progress.bump(room.state.couple, 'funnyChallenges');
        progress.bump(room.state.couple, 'daresDone');
      }
      room.state.session.bestMoment = `The "${round.prompt.slice(0, 30)}..." challenge`;
    }
    round.result = { passed: false, answer: round.answered[round.responder], hearts, reaction: null, message: pick(content.host.CHEERS) };
  }
  round.resolved = true;
  game.ack = {};
  game.status = 'result';
  return { changed: true };
}

// ---------------------------------------------------------------------------
// MEMORY VAULT
// ---------------------------------------------------------------------------
function buildMemoryRound(room, game) {
  const responder = game.roundNum === 1 ? 0 : 1;
  const used = game.history;
  const candidates = content.memory.MEMORY_PROMPTS.filter((p) => !used.includes(p.slice(0, 30)));
  const prompt = pick(candidates.length ? candidates : content.memory.MEMORY_PROMPTS);
  game.history.push(prompt.slice(0, 30));
  return {
    kind: 'memory', prompt, responder,
    phase: 'share', moment: null, emotion: null,
    answered: {}, resolved: false, result: null,
  };
}

function resolveMemory(room, game) {
  const round = game.round;
  const emotion = content.memory.EMOTIONS.find((e) => e.id === round.emotion) || content.memory.EMOTIONS[2];
  const title = content.host.memoryTitle(round.moment, round.emotion);
  const page = {
    title,
    moment: round.moment,
    emotion: emotion.icon + ' ' + emotion.label,
    by: room.state.players[round.responder].name,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  const saved = room.state.couple ? progress.addMemory(room.state.couple, page) : { ...page, id: 'local' };
  if (saved) {
    if (room.state.couple) progress.bump(room.state.couple, 'memoriesSaved');
    room.state.session.memorySavedTonight.push(page);
  }
  const hearts = earn(room, 5);
  game.hearts += hearts;
  round.result = {
    page, hearts,
    message: pick([
      '📖 The Memory Machine stamps a fresh page into the vault.',
      '💾 Memory saved. That one is ours forever now.',
    ]),
  };
  round.resolved = true;
  game.ack = {};
  game.status = 'result';
  room.state.session.bestMoment = `The memory "${title}"`;
  return { changed: true };
}

// ---------------------------------------------------------------------------
// ESCAPE ROOM
// ---------------------------------------------------------------------------
function buildEscapeRound(room, game) {
  const clue = game.room.clues[game.roundNum - 1];
  return {
    kind: 'escape', clueNum: game.roundNum, clue,
    responder: 'both', answered: {}, attempts: 0, hintShown: false,
    resolved: false, result: null,
  };
}

function resolveEscape(room, game) {
  const round = game.round;
  const clue = round.clue;
  const c0 = round.answered[0] === clue.correctIdx;
  const c1 = round.answered[1] === clue.correctIdx;
  if (c0 || c1) {
    const both = c0 && c1;
    const hearts = earn(room, both ? 4 : 2);
    game.hearts += hearts;
    game.solvedClues = (game.solvedClues || 0) + 1;
    round.result = {
      solved: true, both, hearts,
      answer: clue.options[clue.correctIdx],
      message: both
        ? 'BOTH of you cracked it. The door bolt slides back. 🔓'
        : 'Solved! One of you had the key. The bolt slides back. 🔓',
    };
    round.resolved = true;
    game.ack = {};
    game.status = 'result';
    room.state.session.bestMoment = `Escaping clue ${game.roundNum} of ${game.room.name}`;
  } else if (round.attempts > 0) {
    round.result = {
      solved: false, hearts: 0,
      answer: clue.options[clue.correctIdx],
      message: 'The lock hums and shows the answer: it\'s okay. You two are the code, not the clues. 🔑',
    };
    round.resolved = true;
    game.ack = {};
    game.status = 'result';
  } else {
    round.attempts = 1;
    round.hintShown = true;
    round.answered = {};
    round.result = { hint: clue.hint, message: 'Almost! The room whispers a hint... 🕯️' };
    round.resolved = false;
    game.status = 'result';
    game.ack = {};
  }
  return { changed: true };
}

function nextRound(room) {
  const game = room.state.game;
  game.roundNum += 1;
  game.ack = {};
  if (game.roundNum > game.totalRounds) return finishGame(room);
  game.round = buildRound(room, game);
  game.status = 'round';
  return { changed: true };
}

function finishGame(room) {
  const game = room.state.game;
  game.status = 'finished';
  game.summary = buildSummary(room, game);
  if (room.state.couple) {
    progress.bump(room.state.couple, 'gamesPlayed');
    if (game.name === 'escape' && game.solvedClues >= (game.totalRounds || 0)) {
      progress.bump(room.state.couple, 'escapes');
    }
  }
  room.state.session.gamesPlayed.push(game.name);
  game.hostClosing = pick(content.host.CHEERS) + ' ' + pick(content.host.TRANSITIONS);
  return { changed: true };
}

function buildSummary(room, game) {
  const base = { hearts: game.hearts, gamesPlayed: room.state.session.gamesPlayed.length };
  if (game.name === 'telepathy') {
    const matches = game.rounds ? game.rounds.filter((r) => r && r.match).length : 0;
    return { ...base, matches };
  }
  return base;
}

// ---------------------------------------------------------------------------
// STORY THEATRE — alternating lines, live-shared.
// ---------------------------------------------------------------------------
function buildStoryRound(room, game) {
  const responder = game.roundNum % 2 === 1 ? 1 : 0;
  return {
    kind: 'story', lineNum: game.roundNum, responder,
    runningStory: [...game.lines],
    prompt: 'Add the next line to our story...',
    answered: {}, resolved: true,
  };
}

function resolveStory(room, game) {
  const round = game.round;
  const line = round.answered[round.responder];
  game.lines.push(line);
  game.roundNum += 1;
  if (game.roundNum > game.totalRounds) {
    const storyText = game.lines.join(' ');
    const title = pick(content.story.STORY_TITLES).call(null, game.element, game.lines);
    game.title = title;
    const hearts = earn(room, 5);
    game.hearts += hearts;
    if (room.state.couple) progress.bump(room.state.couple, 'storiesCompleted');
    game.status = 'result';
    game.ack = {};
    game.result = {
      title, story: storyText, hearts,
      element: game.element,
      message: '📖 The curtain falls. Applause from the Host!',
    };
    room.state.session.bestMoment = `The story "${title}"`;
    return { changed: true };
  }
  game.ack = {};
  game.round = buildStoryRound(room, game);
  return { changed: true };
}

// ---------------------------------------------------------------------------
// FUTURE BUILDER — alternating answers into a shared vision card.
// ---------------------------------------------------------------------------
function buildFutureRound(room, game) {
  const responder = game.roundNum % 2 === 1 ? 1 : 0;
  const sub = game.theme.subPrompts[game.roundNum - 1];
  return {
    kind: 'future', prompt: sub(room.state.profile, room.state.players[1 - responder]),
    responder, answered: {}, resolved: true,
  };
}

function resolveFuture(room, game) {
  const round = game.round;
  game.answers.push({ by: room.state.players[round.responder].name, answer: round.answered[round.responder] });
  game.roundNum += 1;
  if (game.roundNum > game.totalRounds) {
    const hearts = earn(room, 4);
    game.hearts += hearts;
    game.status = 'result';
    game.ack = {};
    game.result = {
      theme: game.theme.name, icon: game.theme.icon, answers: game.answers, hearts,
      message: pick([
        '🔮 The Vision Card glows. This future is officially on record.',
        '✨ Your Future Machine just issued its first prophecy.',
      ]),
    };
    room.state.session.bestMoment = `The vision: ${game.theme.name}`;
    return { changed: true };
  }
  game.ack = {};
  game.round = buildFutureRound(room, game);
  return { changed: true };
}

// ---------------------------------------------------------------------------
// SURPRISE SYSTEM — five surprise events rolled between games.
// ---------------------------------------------------------------------------
function startSurprise(room, kind) {
  room.state.session.surprises += 1;
  const game = {
    name: 'surprise', kind, mood: room.state.session.mood,
    status: 'round', roundNum: 1, totalRounds: 1,
    hearts: 0, round: null, ack: {}, history: [], summary: null,
    startedAt: Date.now(),
  };
  room.state.game = game;
  room.state.history.push({ t: Date.now(), type: 'surprise', kind });

  if (kind === 'double_hearts') {
    room.state.session.doubleHearts = true;
    game.status = 'result';
    game.round = { kind, result: { note: 'The next game pays DOUBLE hearts! 💥', hearts: 0 }, resolved: true };
  } else if (kind === 'mystery_challenge') {
    const responder = Math.random() < 0.5 ? 0 : 1;
    const other = 1 - responder;
    const item = content.darebare.pickDare(room.state.profile, room.state.players[responder], room.state.players[other], 'funny', []);
    game.round = {
      kind, prompt: item.prompt, responder, other, passAllowed: true,
      answered: {}, resolved: false, result: null,
    };
  } else if (kind === 'memory_flashback') {
    const pool = [
      ...(room.state.couple ? room.state.couple.memories : []),
      ...room.state.session.memorySavedTonight,
    ];
    const mem = pool.length ? pool[pool.length - 1] : null;
    if (mem) {
      const hearts = earn(room, 2);
      game.hearts += hearts;
      game.status = 'result';
      game.round = { kind, result: { memory: { title: mem.title, moment: mem.moment, emotion: mem.emotion }, hearts }, resolved: true };
      room.state.session.bestMoment = `The flashback to "${mem.title}"`;
    } else {
      game.status = 'result';
      game.round = { kind, result: { memory: null, note: 'No memories vaulted yet — go make one tonight!', hearts: 0 }, resolved: true };
    }
  } else if (kind === 'song_challenge') {
    game.round = {
      kind, prompt: 'Type the first song that makes you think of them. Right now, no thinking. 🎵',
      responder: 'both', answered: {}, resolved: false, result: null,
    };
  } else if (kind === 'secret_message') {
    game.round = {
      kind, prompt: 'Write a secret message for them — it stays sealed until you both press send. 💌',
      responder: 'both', answered: {}, resolved: false, result: null,
    };
  }
  return { changed: true };
}

function resolveSurprise(room, game) {
  const round = game.round;
  if (game.kind === 'mystery_challenge') {
    if (round.answered[round.responder] === '__PASS__') {
      round.result = { passed: true, hearts: 0, message: 'Pass respected. The mystery dissolves into sparkles. ✨' };
    } else {
      const hearts = earn(room, 3);
      game.hearts += hearts;
      if (room.state.couple) progress.bump(room.state.couple, 'funnyChallenges');
      round.result = { passed: false, answer: round.answered[round.responder], hearts, reaction: null, message: 'A mystery conquered! The arcade approves. 🎭' };
      room.state.session.bestMoment = 'The mystery challenge';
    }
    round.resolved = true;
    game.ack = {};
    game.status = 'result';
    return { changed: true };
  }
  if (game.kind === 'song_challenge') {
    const s0 = strip(round.answered[0]).toLowerCase();
    const s1 = strip(round.answered[1]).toLowerCase();
    const same = s0 && s1 && s0 === s1;
    const hearts = earn(room, same ? 5 : 3);
    game.hearts += hearts;
    round.result = {
      same, hearts, songs: { 0: round.answered[0], 1: round.answered[1] },
      message: same ? 'SAME SONG?! The jukebox weeps with joy. 🎵💞' : 'Different songs, same heart. The jukebox hums approvingly. 🎶',
    };
    round.resolved = true;
    game.ack = {};
    game.status = 'result';
    return { changed: true };
  }
  if (game.kind === 'secret_message') {
    const hearts = earn(room, 4);
    game.hearts += hearts;
    round.result = {
      hearts, notes: { 0: round.answered[0], 1: round.answered[1] },
      message: 'The seals break. Read them slow. 💌',
    };
    round.resolved = true;
    game.ack = {};
    game.status = 'result';
    room.state.session.bestMoment = 'The secret messages';
    return { changed: true };
  }
  return { changed: false };
}

// ---------------------------------------------------------------------------
// Dispatcher + exports
// ---------------------------------------------------------------------------
function gameIntent(room, player, action, value) {
  const game = room.state.game;
  if (!game) return { changed: false };

  if (game.status === 'intro' && action === 'start') return nextRound(room);

  if (game.status === 'round') {
    const round = game.round;
    if (!round) return { changed: false };
    // Story & Future rounds are built pre-resolved so the running story /
    // answers stay unmasked in the broadcast; their single-answer flow must
    // still be accepted here.
    if (round.resolved && game.name !== 'story' && game.name !== 'future') return { changed: false };
    if (action === 'answer') {
      const required = round.responder === 'both' ? [0, 1] : [round.responder];
      if (!required.includes(player.idx)) return { changed: false };
      if (game.name === 'memory') {
        // Memory Vault is a two-step flow: share a moment, then pick an emotion.
        if (round.phase === 'share') {
          round.moment = value;
          round.phase = 'emotion';
          return { changed: true };
        }
        if (round.phase === 'emotion') {
          round.emotion = value;
          return resolve(room, game);
        }
        return { changed: false };
      }
      if (round.answered[player.idx] !== undefined) return { changed: false };
      round.answered[player.idx] = value;
      if (game.name === 'story' || game.name === 'future') return resolve(room, game);
      if (bothAnswered(round, required)) return resolve(room, game);
      return { changed: true };
    }
    if (action === 'pass' && round.passAllowed && requiredPlayer(round) === player.idx) {
      round.answered[player.idx] = '__PASS__';
      return resolve(room, game);
    }
    return { changed: false };
  }

  if (game.status === 'result') {
    const round = game.round;
    if (action === 'react' && round && round.result && !round.result.reaction && player.idx !== round.responder) {
      round.result.reaction = { by: player.idx, emoji: value };
      const hearts = earn(room, 1);
      round.result.reactionHearts = hearts;
      game.hearts += hearts;
      return { changed: true };
    }
    if (action === 'claim' && round && round.result && round.result.challenge && !round.result.challengeClaimed) {
      round.result.challengeClaimed = true;
      const hearts = earn(room, 2);
      round.result.challengeBonus = hearts;
      game.hearts += hearts;
      if (room.state.couple) progress.bump(room.state.couple, 'funnyChallenges');
      room.state.session.bestMoment = 'The silly telepathy tax';
      return { changed: true };
    }
    if (action === 'continue') {
      if (game.name === 'escape' && round && round.result && round.result.hint && !round.result.solved) {
        round.result = null;
        round.answered = {};
        game.status = 'round';
        game.ack = {};
        return { changed: true };
      }
      game.ack[player.idx] = true;
      if (game.ack[0] && game.ack[1]) {
        if (game.name === 'surprise') {
          game.status = 'finished';
          game.summary = { hearts: game.hearts, kind: game.kind };
          return { changed: true };
        }
        if (game.roundNum >= game.totalRounds) return finishGame(room);
        return nextRound(room);
      }
      return { changed: true };
    }
    return { changed: false };
  }

  if (game.status === 'finished' && action === 'continue') {
    return { changed: true, finished: true };
  }
  return { changed: false };
}

function requiredPlayer(round) {
  return round.responder === 'both' ? -1 : round.responder;
}

function resolve(room, game) {
  if (game.name === 'telepathy') return resolveTelepathy(room, game);
  if (game.name === 'darebare') return resolveDareBare(room, game);
  if (game.name === 'memory') return resolveMemory(room, game);
  if (game.name === 'escape') return resolveEscape(room, game);
  if (game.name === 'story') return resolveStory(room, game);
  if (game.name === 'future') return resolveFuture(room, game);
  if (game.name === 'surprise') return resolveSurprise(room, game);
  return { changed: false };
}

module.exports = {
  startGame, startSurprise, gameIntent, GAMES_META, SURPRISE_NAMES,
  SURPRISE_POOL: ['double_hearts', 'mystery_challenge', 'memory_flashback', 'song_challenge', 'secret_message'],
};

