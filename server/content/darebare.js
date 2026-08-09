// Dare or Bare — challenge + question banks, mood-flavoured.
const { pick } = require('../util');
const { firstOf } = require('./host');

const DARES = [
  { mood: 'funny', text: (p, o) => `Give ${firstOf(o)} a dramatic compliment using ONLY your best movie-trailer voice. 🎬` },
  { mood: 'funny', text: (p, o) => `Recreate your first call expression right now, in real time, no context. 📞` },
  { mood: 'funny', text: (p, o) => `Sing 10 seconds of the first song that pops into your head. No picking. 🎶` },
  { mood: 'funny', text: (p, o) => `Describe your dream date in exactly 3 words, then act it out silently. 🕺` },
  { mood: 'funny', text: (p, o) => `Do your best impression of ${firstOf(o)} saying "I'm not mad, I'm just disappointed." 😐` },
  { mood: 'funny', text: (p, o) => `Send a voice note of you laughing as evil as you can. The Host will grade it. 😈` },
  { mood: 'funny', text: (p, o) => `Tell a 10-second story that includes: a pigeon, a toaster, and a wedding. Go. 🐦` },
  { mood: 'funny', text: (p, o) => `Try to make ${firstOf(o)} laugh with your face only. 15 seconds. No sounds. 🥸` },
  { mood: 'funny', text: (p, o) => `Act out how you think ${firstOf(o)} dances when no one is watching. 💃` },
  { mood: 'funny', text: (p, o) => `Say "I love you" in the most dramatic soap-opera voice possible. 🌹` },
  { mood: 'flirty', text: (p, o) => `Describe something you love about ${firstOf(o)}... in the style of a slow-motion perfume ad. 🔥` },
  { mood: 'flirty', text: (p, o) => `Whisper (or type) one thing you'd do if you were in the same room right now. 💋` },
  { mood: 'flirty', text: (p, o) => `Compliment the part of ${firstOf(o)}'s personality that always makes your heart skip. 💓` },
  { mood: 'flirty', text: (p, o) => `Tell ${firstOf(o)} the exact spot you'd want to be the first to kiss. Shy but honest. 😳` },
  { mood: 'flirty', text: (p, o) => `Rate your last kiss (or the last time you hugged) on a scale of 1-10 with a dramatic explanation. 💯` },
  { mood: 'romantic', text: (p, o) => `Recount the moment you knew you liked ${firstOf(o)} — in the style of a nature documentary. 🦋` },
  { mood: 'romantic', text: (p, o) => `Write a 2-line poem about ${firstOf(o)} and read it like you mean it. 📜` },
  { mood: 'romantic', text: (p, o) => `Describe your ideal way to fall asleep together (words only). 🛏️` },
  { mood: 'deep', text: (p, o) => `Share the song you'd want played at your wedding (or at your "us" anniversary). 💒` },
  { mood: 'deep', text: (p, o) => `Tell ${firstOf(o)} one thing you're proud of them for — that you don't say often. 🫶` },
  { mood: 'deep', text: (p, o) => `What's a promise you want to make to ${firstOf(o)} right now, out loud? 🤝` },
];

const BARE = [
  { mood: 'deep', text: (p, o) => `When did you feel most loved by ${firstOf(o)}? Take your time. 💛` },
  { mood: 'deep', text: (p, o) => `What is something you wish ${firstOf(o)} understood about you better?` },
  { mood: 'deep', text: (p, o) => `What small thing does ${firstOf(o)} do that you never want them to stop doing?` },
  { mood: 'deep', text: (p, o) => `What's a moment with ${firstOf(o)} you replay in your head on hard days?` },
  { mood: 'deep', text: (p, o) => `Is there a fear you have about your relationship you've never quite said out loud?` },
  { mood: 'deep', text: (p, o) => `What makes you feel closest to ${firstOf(o)} even when you're apart?` },
  { mood: 'deep', text: (p, o) => `What did you learn about love from being with ${firstOf(o)}?` },
  { mood: 'deep', text: (p, o) => `When do you miss ${firstOf(o)} the most — what triggers it?` },
  { mood: 'deep', text: (p, o) => `What's something you've forgiven ${firstOf(o)} for that strengthened you two?` },
  { mood: 'romantic', text: (p, o) => `Tell ${firstOf(o)} about the first time you thought "this is real."` },
  { mood: 'romantic', text: (p, o) => `What was your favourite "just us" moment in the last month?` },
  { mood: 'flirty', text: (p, o) => `What's something about ${firstOf(o)} that still gives you butterflies?` },
  { mood: 'funny', text: (p, o) => `What's the most embarrassing thing ${firstOf(o)} has ever caught you doing?` },
  { mood: 'funny', text: (p, o) => `What's a habit ${firstOf(o)} has that annoys you... but you find secretly cute?` },
  { mood: 'comfort', text: (p, o) => `What's the safest you've ever felt with ${firstOf(o)}?` },
  { mood: 'comfort', text: (p, o) => `What does ${firstOf(o)} do that instantly calms you down?` },
];

const EMOJI_REACTIONS = ['😂', '🥺', '❤️', '🔥', '👏', '😮'];

function pickDare(profile, responder, other, mood, history) {
  const pool = DARES.filter((d) => d.mood === mood || mood === 'surprise' || mood === 'comfort');
  const usable = pool.length ? pool : DARES;
  const candidates = usable.filter((d) => !history.includes(d.text.toString().slice(0, 40)));
  const d = pick(candidates.length ? candidates : usable);
  return { type: 'dare', prompt: d.text(profile, other), key: d.text.toString().slice(0, 40) };
}

function pickBare(profile, responder, other, mood, history) {
  const pool = BARE.filter((b) => b.mood === mood || mood === 'surprise' || mood === 'comfort');
  const usable = pool.length ? pool : BARE;
  const candidates = usable.filter((b) => !history.includes(b.text.toString().slice(0, 40)));
  const b = pick(candidates.length ? candidates : usable);
  return { type: 'bare', prompt: b.text(profile, other), key: b.text.toString().slice(0, 40) };
}

module.exports = { DARES, BARE, EMOJI_REACTIONS, pickDare, pickBare };
