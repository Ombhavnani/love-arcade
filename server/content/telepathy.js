// Partner Telepathy — question bank. Truth-mode questions are built from the
// couple's profile when available; otherwise we fall back to "agree" mode.
const { pick, shuffle } = require('../util');
const { firstOf } = require('./host');

function listOf(profile, field) {
  const raw = profile.prefs && profile.prefs[field] ? profile.prefs[field] : '';
  return String(raw).split(',').map((s) => s.trim()).filter((s) => s.length > 1);
}

function withTruth(truthLabel, decoys, extra) {
  const options = shuffle([
    { label: truthLabel, truth: true },
    ...decoys.map((d) => ({ label: d, truth: false })),
  ]);
  const seen = new Set();
  const out = [];
  for (const o of options) {
    const key = o.label.toLowerCase();
    if (seen.has(key) || o.label.length < 2) continue;
    seen.add(key);
    out.push(o);
  }
  let i = 0;
  while (out.length < 3 && extra.length) {
    const o = { label: extra[i % extra.length], truth: false };
    i++;
    if (!seen.has(o.label.toLowerCase())) {
      seen.add(o.label.toLowerCase());
      out.push(o);
    }
  }
  return out.slice(0, 4);
}

// Builders: each returns { promptTarget, promptGuesser, options } or null.
function comfortFoodQ(profile, t) {
  const f = listOf(profile, 'foods')[0];
  if (!f) return null;
  return {
    promptTarget: `Pick YOUR comfort food — the one that fixes a bad day instantly. 🍜`,
    promptGuesser: `Pick ${firstOf(t)}'s comfort food — the one that fixes their bad day. 🍜`,
    options: withTruth(f, ['Pizza', 'Ramen', 'A giant bowl of ice cream', 'Toast with weird toppings', 'A whole cake', 'Instant noodles at 2am'], ['Anything they\'re craving', 'Soup', 'Tacos', 'Leftover pasta']),
  };
}

function karaokeQ(profile, t) {
  const s = listOf(profile, 'songs')[0];
  if (!s) return null;
  return {
    promptTarget: `Pick the song YOU would absolutely destroy at karaoke. 🎤`,
    promptGuesser: `Pick the song ${firstOf(t)} would absolutely destroy at karaoke. 🎤`,
    options: withTruth(s, ['Bohemian Rhapsody', 'Toxic', 'Mr. Brightside', 'Love Story', 'All Star', 'I Will Always Love You'], ['Any 90s power ballad', 'A Disney anthem', 'Something from the shower']),
  };
}

function movieNightQ(profile, t) {
  const m = listOf(profile, 'movies')[0];
  if (!m) return null;
  return {
    promptTarget: `Pick the movie YOU choose on movie night, every time. 🍿`,
    promptGuesser: `Pick the movie ${firstOf(t)} chooses on movie night, every time. 🍿`,
    options: withTruth(m, ['The Notebook', 'A thriller they swear they\'ve seen', 'Any animated classic', 'A 2-hour action film', 'The same comfort movie for the 50th time'], ['Whatever\'s new', 'A documentary', 'Something we can talk over']),
  };
}

function lazySundayQ(profile, t) {
  const a = [...listOf(profile, 'activities'), ...listOf(profile, 'hobbies')][0];
  if (!a) return null;
  return {
    promptTarget: `Pick YOUR perfect lazy Sunday activity. ☀️`,
    promptGuesser: `Pick ${firstOf(t)}'s perfect lazy Sunday activity. ☀️`,
    options: withTruth(a, ['Sleeping until noon', 'A 5-hour call with you', 'Binge-watching everything', 'A long walk with zero plan', 'Gaming', 'Cooking something complicated'], ['Absolutely nothing', 'A spontaneous adventure', 'Cleaning and loving it']),
  };
}

const AGREE_POOL = [
  {
    prompt: 'If you two could time-travel, which era do you BOTH pick? 🕰️',
    options: ['The 90s', 'Victorian mansions', '2050', 'The dinosaur era', '1920s jazz', 'The future where you finally live together'],
  },
  {
    prompt: 'Pick the snack you two would absolutely split right now. 🍿',
    options: ['Loaded nachos', 'A whole cake, no shame', 'Sushi', 'Popcorn with too much butter', 'Ice cream for two', 'Ramen at 2am'],
  },
  {
    prompt: 'Choose your couple hashtag, together. #️⃣',
    options: ['#TwoPeasInAnAntenna', '#LongDistanceLegends', '#ChaosButCute', '#ThePowerCouple', '#SoftLaunchNoMore', '#PlotTwist:Us'],
  },
  {
    prompt: 'Which 3-hour call activity do you BOTH secretly prefer? 📞',
    options: ['Just talking till we fall asleep', 'Watching the same movie and gasping', 'Online shopping, showing each other things', 'Playing silly games', 'Cooking "together" through the screen', 'Taking turns reading out loud'],
  },
  {
    prompt: 'Which house would you two choose for forever? 🏡',
    options: ['A tiny cabin in the woods', 'A bright city loft', 'A beach house with too many windows', 'A bookshop with a flat upstairs', 'A farmhouse with a big table', 'A van, actually. Just a van'],
  },
  {
    prompt: 'What would your couple theme song be about? 🎵',
    options: ['Sneaking a nap during a call', 'Being annoying but devoted', 'Two parallel lines that finally crossed', 'Laughing through bad Wi-Fi', 'Stealing hoodies across borders', 'A slow song with one fast verse'],
  },
];

const FUNNY_CHALLENGES = [
  'Dramatically reenact BOTH answers with full theatrical commitment. The Host is watching. 🎭',
  'Give the other player a slow-motion dramatic compliment for 10 full seconds. 😌',
  'Do your best impression of the other player\'s face when they read the wrong answer. 😐',
  'Narrate your next 30 seconds of life in a movie-trailer voice. Yes, out loud. 🎬',
  'Hold a 20-second serious staring contest. No blinking. Winner gets a secret heart. 👀',
  'Sing the wrong answer to the tune of "Happy Birthday". Everyone involved apologises. 🎶',
];

module.exports = { comfortFoodQ, karaokeQ, movieNightQ, lazySundayQ, AGREE_POOL, FUNNY_CHALLENGES, listOf };
