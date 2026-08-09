// Persistence + progress system: hearts, achievements, memories, couple storage.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'sessions.json');

let store = { couples: {} };

function load() {
  try {
    store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    store = { couples: {} };
  }
  if (!store.couples) store.couples = {};
}
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

const nameKey = (n0, n1) => [String(n0), String(n1)].map((s) => s.trim().toLowerCase()).sort().join('|');

const ACHIEVEMENTS = [
  { id: 'mind_reader', icon: '🧠', name: 'Mind Reader', desc: 'Get 5 Telepathy matches', check: (s) => (s.telepathyMatches || 0) >= 5 },
  { id: 'story_lovers', icon: '📖', name: 'Story Lovers', desc: 'Complete 10 stories together', check: (s) => (s.storiesCompleted || 0) >= 10 },
  { id: 'distance_warriors', icon: '🌍', name: 'Distance Warriors', desc: 'Play 10 sessions apart', check: (s) => (s.sessionsPlayed || 0) >= 10 },
  { id: 'memory_collector', icon: '💾', name: 'Memory Collector', desc: 'Save 20 memories', check: (s) => (s.memoriesSaved || 0) >= 20 },
  { id: 'chaos_couple', icon: '🎭', name: 'Chaos Couple', desc: 'Complete 10 funny challenges', check: (s) => (s.funnyChallenges || 0) >= 10 },
  { id: 'escape_artists', icon: '🔑', name: 'Escape Artists', desc: 'Escape 3 rooms together', check: (s) => (s.escapes || 0) >= 3 },
  { id: 'heart_thieves', icon: '❤️', name: 'Heart Thieves', desc: 'Earn 100 hearts together', check: (s) => (s.heartsTotal || 0) >= 100 },
];

function freshCouple(key, names) {
  return {
    id: crypto.randomUUID(),
    nameKey: key,
    names,
    profile: null,
    stats: {
      heartsTotal: 0, sessionsPlayed: 0, gamesPlayed: 0, telepathyMatches: 0,
      memoriesSaved: 0, storiesCompleted: 0, funnyChallenges: 0, escapes: 0, daresDone: 0,
    },
    achievements: [],
    memories: [],
    sessions: [],
    lastSeen: Date.now(),
  };
}

function findCouple(n0, n1) {
  const key = nameKey(n0, n1);
  for (const c of Object.values(store.couples)) if (c.nameKey === key) return c;
  return null;
}

function getCouple(id) {
  return store.couples[id] || null;
}

// Load the couple's record; create fresh if none exists yet for these names.
function loadOrCreateCouple(n0, n1) {
  const key = nameKey(n0, n1);
  let couple = findCouple(n0, n1);
  if (!couple) {
    couple = freshCouple(key, [n0, n1]);
    store.couples[couple.id] = couple;
    save();
  }
  return couple;
}

function addHearts(couple, n) {
  if (!couple) return;
  couple.stats.heartsTotal = (couple.stats.heartsTotal || 0) + n;
  save();
}

function bump(couple, key, n = 1) {
  if (!couple) return;
  couple.stats[key] = (couple.stats[key] || 0) + n;
  save();
}

function addMemory(couple, mem) {
  if (!couple) return null;
  const m = { id: crypto.randomUUID(), date: Date.now(), ...mem };
  couple.memories.push(m);
  save();
  return m;
}

function unlockIfAny(couple) {
  if (!couple) return [];
  const news = [];
  for (const a of ACHIEVEMENTS) {
    if (!couple.achievements.includes(a.id) && a.check(couple.stats)) {
      couple.achievements.push(a.id);
      news.push(a);
    }
  }
  if (news.length) save();
  return news;
}

function recordSession(couple, summary) {
  if (!couple) return;
  couple.sessions.push({ date: Date.now(), ...summary });
  couple.lastSeen = Date.now();
  save();
}

module.exports = {
  load, save, ACHIEVEMENTS, findCouple, getCouple, loadOrCreateCouple,
  addHearts, bump, addMemory, unlockIfAny, recordSession, nameKey,
};
