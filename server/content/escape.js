// Escape Room — relationship puzzles built from the couple's profile, with
// computed-fact fallbacks so a room always has solvable clues.
const { shuffle, strip } = require('../util');
const { firstOf } = require('./host');

function mc(q, correct, decoys, hint) {
  const labels = shuffle([correct, ...decoys]);
  return { q, options: labels, correctIdx: labels.indexOf(correct), hint };
}

// --- clue builders (return clue or null if profile data missing) ------------
const clueRestaurant = (p) => {
  const r = strip(p.firstDateRestaurant);
  if (!r) return null;
  return mc(
    `Clue 1 · The name on the menu. What was the first restaurant you went to? 🍝`,
    r,
    ['The place with the nice lighting', 'Somewhere you don\'t remember', 'The one with the weird waiter', 'A drive-thru, obviously'],
    `It's written somewhere in your First Date memory.`,
  );
};

const clueAnniversary = (p) => {
  const d = strip(p.anniversary);
  if (!d) return null;
  return mc(
    `Clue 2 · The date on the lock. What is your anniversary date? 📅`,
    d,
    ['The day you met (probably?)', 'A random Tuesday', 'Yesterday', 'Your birthdays, surely'],
    'The date you celebrate, always.',
  );
};

const clueDuration = (p) => {
  const d = strip(p.duration);
  if (!d) return null;
  const nums = String(d).match(/\d+/g);
  if (!nums) return null;
  const n = parseInt(nums[0], 10);
  return mc(
    `Clue 2 · The combination. How many ${nums.length > 1 ? 'months' : 'years'} have you two been at this? 🔢`,
    String(n),
    [String(n + 1), String(Math.max(1, n - 1)), String(n + 5), '100 (accurate in spirit)'],
    'Count the time you\'ve chosen each other.',
  );
};

const clueSong = (p) => {
  const s = (p.prefs && p.prefs.songs || '').split(',').map(strip).filter(Boolean)[0];
  if (!s) return null;
  return mc(
    `Clue 3 · The final frequency. What's the song that plays in your heads at the same time? 🎵`,
    s,
    ['White noise', 'The elevator song', 'Your most hated jingle', 'Silence (suspicious)'],
    'It\'s saved under "favourites".',
  );
};

const clueNextMeet = (p) => {
  const n = strip(p.nextMeet);
  if (!n) return null;
  return mc(
    `Clue 2 · The countdown. When is the next time you get to be in the same room? ✈️`,
    n,
    ['Someday™', 'Tomorrow (keep dreaming)', 'After the holidays (maybe)', 'When the universe aligns'],
    'It\'s on your calendar and in your hearts.',
  );
};

const clueNickname = (p) => {
  const nicks = p.players.map((pl) => pl.nickname || pl.name).filter(Boolean);
  const target = nicks[0];
  if (!target) return null;
  return mc(
    `Clue 3 · The secret word. What do you call ${firstOf(p.players[1])} when no one else is around? 🤫`,
    target,
    ['"Hey you"', '"That guy/girl"', 'Their full government name', 'A random beep sound'],
    'The pet name only you two know.',
  );
};

const clueFirstLove = (p) => {
  const f = strip(p.memories && p.memories.firstILoveYou);
  if (!f) return null;
  return mc(
    `Clue 1 · The first "I love you". Where (or how) did it happen? 💌`,
    f,
    ['On a crowded bus', 'During an argument', 'In a group chat (bold)', 'In your sleep'],
    'That moment is stored in your memory bank.',
  );
};

const clueFunniest = (p) => {
  const f = strip(p.memories && p.memories.funniest);
  if (!f) return null;
  return mc(
    `Clue 2 · The laughter file. What's the funniest moment you've shared? 😂`,
    f,
    ['A very serious board game', 'A tiny misunderstanding', 'Nothing. We are professional', 'A weather report'],
    'The one that makes you both crack up on recall.',
  );
};

const clueNameLengths = (p) => {
  const total = p.players.reduce((s, pl) => s + strip(pl.name).length, 0);
  return mc(
    `Clue 3 · The final number. How many letters are in both of your names combined? 🔢`,
    String(total),
    [String(total + 1), String(total + 2), String(Math.max(2, total - 1)), 'A prime number, obviously'],
    'Write your names, count every letter.',
  );
};

const clueInitials = (p) => {
  const ini = p.players.map((pl) => strip(pl.name).charAt(0).toUpperCase() + strip(pl.name).slice(-1).toUpperCase()).join('');
  return mc(
    `Clue 3 · The inscription. What two-letter monogram does the lock bear? 🔐`,
    ini,
    ['XY', 'XX', 'YY', '??'],
    'First letters... and last letters.',
  );
};

const clueHowMet = (p) => {
  const h = strip(p.howMet);
  if (!h) return null;
  return mc(
    `Clue 1 · The origin story. How did you two actually meet? 🌠`,
    h,
    ['A deeply normal way (unlikely)', 'You\'ve been together so long you forgot', 'A blind date gone right', 'It\'s classified'],
    'The Host loves this one. Type the real story.',
  );
};

// --- rooms ---------------------------------------------------------------
const ROOMS = [
  {
    name: 'The First Date Room',
    icon: '🍝',
    story: 'You two are trapped inside the First Date Room — the decor is exactly the same as your first restaurant. To escape, you must prove you remember the beginning. The table is set. The clock is running. (No it isn\'t. This is cozy. Take your time.)',
    clues: [clueRestaurant, clueAnniversary, clueSong],
  },
  {
    name: 'The Midnight Call Room',
    icon: '🌙',
    story: 'You\'re trapped inside the Midnight Call Room, frozen at 3AM with the phone ringing. Only your own story can unlock the door — where it started, when you\'re together again, and the name you call each other when the world isn\'t listening.',
    clues: [clueHowMet, clueNextMeet, clueNickname],
  },
  {
    name: 'The First "I Love You" Room',
    icon: '💌',
    story: 'This room holds the echo of the very first time those words were said. Every clue is a memory. Solve them together and the door opens — softened by three little words.',
    clues: [clueFirstLove, clueFunniest, clueNameLengths],
  },
  {
    name: 'The Future Room',
    icon: '🔮',
    story: 'A glowing room full of calendars and countdowns. The locks here are set to dates and dreams. Prove you\'re both pointing at the same future, and the door will swing wide open.',
    clues: [clueHowMet, clueNextMeet, clueInitials],
  },
];

function buildRoom(profile, history) {
  const candidates = ROOMS.filter((r) => !history.includes(r.name));
  const pool = candidates.length ? candidates : ROOMS;
  const room = pool[Math.floor(Math.random() * pool.length)];
  const built = [];
  for (const builder of room.clues) {
    const c = builder(profile);
    if (c) built.push(c);
  }
  if (built.length < 3) {
    const fallbacks = [clueNameLengths, clueInitials];
    const usedQs = new Set(built.map((c) => c.q));
    for (const f of fallbacks) {
      if (built.length >= 3) break;
      const c = f(profile);
      if (c && !usedQs.has(c.q)) {
        built.push(c);
        usedQs.add(c.q);
      }
    }
  }
  return { name: room.name, icon: room.icon, story: room.story, clues: built.slice(0, 3) };
}

module.exports = { buildRoom, mc };
