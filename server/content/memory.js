// Memory Vault — prompts for sharing memories + emotion chips for memory pages.
const { pick } = require('../util');

const MEMORY_PROMPTS = [
  `Tell me about your funniest trip together. Where were you? What went wrong? What still makes you laugh? 🧳`,
  `Tell me about a moment you really, really missed them. What did it feel like? 🥺`,
  `Tell me about a small gesture you remember. Something tiny they did that meant everything. 🕯️`,
  `Tell me about the first time you thought "this is actually real". What happened? ✨`,
  `Tell me about a rainy day (or bad day) that turned warm because of them. ☔`,
  `Tell me about a moment when you two were laughing so hard you couldn't breathe. 😂`,
  `Tell me about the first time you said "I love you" — or the first time you almost did. 💌`,
  `Tell me about a silly inside joke that still makes you smile. 🤫`,
];

const EMOTIONS = [
  { id: 'fun', icon: '😂', label: 'Laughter' },
  { id: 'romantic', icon: '😍', label: 'Romance' },
  { id: 'tender', icon: '🥲', label: 'Tender' },
  { id: 'wild', icon: '🔥', label: 'Wild' },
  { id: 'nostalgic', icon: '🕰️', label: 'Nostalgia' },
];

const MEMORY_FRAME = {
  intro: '📖 The Memory Machine whirs to life. A new page is being stamped into the vault...',
  saved: '💾 Memory Saved.',
};

module.exports = { MEMORY_PROMPTS, EMOTIONS, MEMORY_FRAME };
