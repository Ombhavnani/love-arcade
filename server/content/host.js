// The Arcade Host's voice — greetings, transitions, jokes, encouragement, closing lines.
const { pick } = require('../util');

const firstOf = (p) => (p ? (p.nickname || p.name || 'Player') : 'Player');

const GREETINGS = (p0, p1) => [
  `Ayyy, look who walked into the Love Arcade — ${firstOf(p0)} & ${firstOf(p1)}! 🎟️✨ The Host has been expecting you both.`,
  `Lights on, neon buzzing, and in walk the two most famous lovebirds in the building — ${firstOf(p0)} and ${firstOf(p1)}! 💖`,
  `Welcome, welcome, WELCOME to the Love Arcade! ${firstOf(p0)} and ${firstOf(p1)} in the house! Let's make tonight weird and wonderful. 🕹️`,
  `The arcade glows a little brighter whenever ${firstOf(p0)} and ${firstOf(p1)} walk in. Tonight's tokens are on the house. ❤️‍🔥`,
];

const RETURNING_GREETINGS = (p0, p1) => [
  `${firstOf(p0)} & ${firstOf(p1)} — my favourite repeat customers! I saved you a seat by the neon heart machine. ♥️`,
  `Well, well, well. The legends return! I kept the lights on for you two, ${firstOf(p0)}. 😌`,
  `Welcome BACK, ${firstOf(p0)} & ${firstOf(p1)}! I remembered everything. Yes, even that one thing. 🤫`,
];

const MOOD_WELCOME = {
  romantic: (n) => pick([
    `Ooh, romance mode. 🥀 Good choice. Hearts are loading...`,
    `Romantic night! I'll dial the neon to rose gold for ${n}. 🌹`,
    `Swoon mode activated for ${n}. Expect sparks. 🔥💘`,
  ]),
  funny: (n) => pick([
    `Comedy night for ${n}! My laugh track is fake but my jokes are real. 😂`,
    `Funny mode! Warning: I do not apologise for my puns. 🃏`,
    `Time to be ridiculous, ${n}. I'll be the silliest host in this building. 🤡`,
  ]),
  deep: (n) => pick([
    `Deep conversation mode. Dimming the lights, tuning out the world for ${n}. 🧠`,
    `Let's go beneath the surface, ${n}. The good stuff lives down there. 🌊`,
    `No small talk tonight. Only the real conversations, ${n}. 🌌`,
  ]),
  flirty: (n) => pick([
    `Flirty mode! Careful, ${n}, the neon just got warmer. 🔥`,
    `Ooh la la. Wink mode: ON for ${n}. 😉`,
    `The Host is switching to flirt protocol. Stay hydrated, ${n}. 💋`,
  ]),
  surprise: (n) => pick([
    `Surprise Me! Ooh, I love chaos. Let's roll the dice for ${n}. 🎲`,
    `Random mode! Even I don't know what's coming, ${n}. That's the fun part. 🎰`,
  ]),
  comfort: (n) => pick([
    `Comfort mode. Soft lights, soft questions, soft hearts for ${n}. 🧸`,
    `A gentle night, ${n}. Nothing scary, nothing pressuring. Just us. 🕯️`,
    `Comfort night. You two are safe here. I've got the blankets. 🛋️`,
  ]),
};

const JOKES = [
  'How does the Love Arcade keep its romances working? Lots of current. ⚡',
  'I told my circuit board a joke once. It short-circuited from laughter. 🔌',
  'You two are the reason I keep the "wink" neon sign powered. 😉',
  'I would tell you a heart joke, but it might get too sentimental. ❤️',
  'Why did the couple cross the road? To get to the other side... of each other. Sorry, that one was terrible. 😅',
  'My emotional support is a disco ball. It lights up every time you two laugh. 🪩',
];

const TRANSITIONS = [
  'Alright, next up!',
  'Switching gears...',
  'The neon flickers, the next round begins!',
  'Okay okay, that was fun. More incoming!',
  'Buzzer! Moving on. The arcade never sleeps.',
  'And the crowd goes wild! Next round!',
];

const CHEERS = [
  'YES! That is the content I run this arcade for! 🎉',
  'Beautiful. Absolutely beautiful. I\'m tearing up, and I don\'t even have eyes. 😭',
  'Heart level: overloaded. Excellent work, you two. ❤️‍🔥',
  'Phenomenal. The arcade cameras are obsessed with you both. 📸',
  'Now THAT deserves the confetti cannon. 🎊',
  'I\'m literally glowing with pride. And I\'m always glowing. So, very. ✨',
];

const ENCOURAGE = [
  'No pressure, no judgement. Whatever you say is exactly right. 💛',
  'Take your time — the arcade waits for no one but it absolutely waits for you. ⏳',
  'Remember: honesty here is always worth double hearts. 🤝',
  'You can pass whenever you like. Red Light is always an option. 🚦',
  'I\'m rooting for you two. Obviously. I\'m programmed to. 💖',
];

function redLightReply(name) {
  return pick([
    `Red Light respected, ${name}. 💗 Skipping that one — no questions asked. The arcade is a safe place.`,
    `💗 Understood, ${name}. We glide right past that. Your comfort is the house rule.`,
    `Red Light honored instantly, ${name}. That one never happened. Moving right along. 🚦`,
    `Got it, ${name}. No pressure, ever. That's the whole point of this place. 🤍`,
  ]);
}

const PICK_GAME_LINES = [
  'Take a spin around the arcade floor. Pick your poison. 🕹️',
  'The machines are humming. Which one calls to you tonight? 🎮',
  'Choose your adventure — the Host recommends them all, obviously. ✨',
  'Six machines, one couple, endless love. Your pick! 💘',
];

const SURPRISE_INTROS = {
  double_hearts: '🎁 SURPRISE! Mystery prize drawn from the vault... DOUBLE HEARTS on the next game! The arcade is feeling generous tonight!',
  mystery_challenge: '🎁 SURPRISE! A mystery challenge just dropped from the ceiling! Face it bravely, lovebirds!',
  memory_flashback: '🎁 SURPRISE! The Memory Machine is glowing. It wants to replay one of your moments...',
  song_challenge: '🎁 SURPRISE! The jukebox of the soul just came alive. Song challenge time!',
  secret_message: '🎁 SURPRISE! A pair of sealed love notes just materialised. Write yours — they\'ll be revealed together.',
};

// Memory page title generation from text keywords.
function memoryTitle(text, emotion) {
  const t = (text || '').toLowerCase();
  const kw = [];
  if (/rain|storm|thunder/.test(t)) kw.push('Rainy');
  if (/night|midnight|3 ?am|3am|late/.test(t)) kw.push('Midnight');
  if (/call|phone|video|facetime|zoom/.test(t)) kw.push('Call');
  if (/song|sing|music|playlist/.test(t)) kw.push('Song');
  if (/food|dinner|cook|restaurant|cafe|eat/.test(t)) kw.push('Kitchen');
  if (/trip|travel|flight|drive|road/.test(t)) kw.push('Travel');
  if (/first|beginning|start/.test(t)) kw.push('First');
  if (/miss|distance|away|apart/.test(t)) kw.push('Distance');
  if (/laugh|joke|funny|cried laughing/.test(t)) kw.push('Laughter');
  if (/cry|tears/.test(t)) kw.push('Tender');
  if (!kw.length) kw.push(pick(['Rainbow', 'Neon', 'Quiet', 'Golden', 'Secret', 'Little']));
  const noun = pick(['Chapter', 'Page', 'Frame', 'Scene', 'Hour', 'Memory']);
  return `The ${kw[0]} ${noun}`;
}

const CLOSING_QUOTES = [
  'The distance was big, but tonight the arcade was bigger.',
  'Miles apart, hearts next door.',
  'Some nights are for screens. Tonight was for us.',
  'Two players. One machine. Zero distance.',
  'The neon dims, but the feeling stays.',
];

module.exports = {
  firstOf, GREETINGS, RETURNING_GREETINGS, MOOD_WELCOME, JOKES, TRANSITIONS,
  CHEERS, ENCOURAGE, redLightReply, PICK_GAME_LINES, SURPRISE_INTROS, memoryTitle, CLOSING_QUOTES,
};

