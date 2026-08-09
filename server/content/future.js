// Future Builder — themes and prompts for imagining the future together.
const { pick } = require('../util');
const { firstOf } = require('./host');

const THEMES = [
  {
    name: 'The Perfect Weekend',
    icon: '🌤️',
    prompt: 'Design your perfect weekend together. Every detail is allowed.',
    subPrompts: [
      (p, o) => `You wake up together. Where are you, ${firstOf(o)}? 🛏️`,
      (p, o) => `${firstOf(o)}, what does the middle of the day look like? The best hours. 🌇`,
      (p, o) => `And the final evening — how does it end? Perfectly. 🌙`,
    ],
  },
  {
    name: 'Our First Home',
    icon: '🏡',
    prompt: 'Describe your first home together. Make it real enough to smell.',
    subPrompts: [
      (p, o) => `Where is this place, ${firstOf(o)}? City, street, view... 🌆`,
      (p, o) => `What's the one room you'd both fight over? Describe it. 🛋️`,
      (p, o) => `What ritual would you have here every single day? ☕`,
    ],
  },
  {
    name: 'The Dream Vacation',
    icon: '✈️',
    prompt: 'Plan your dream vacation together. Budget not required.',
    subPrompts: [
      (p, o) => `You've just landed. Where in the world are you, ${firstOf(o)}? 🗺️`,
      (p, o) => `What's the one thing you MUST do before you leave? 🏔️`,
      (p, o) => `And the one thing that goes wrong that you'll laugh about forever? 😅`,
    ],
  },
  {
    name: 'Five Years From Now',
    icon: '⏳',
    prompt: 'Fast-forward five years. Where are you two?',
    subPrompts: [
      (p, o) => `What does your average Wednesday look like, ${firstOf(o)}? 📆`,
      (p, o) => `What have you learned about each other that you don't know yet? 🔮`,
      (p, o) => `What's the small silly thing that's still exactly the same? 🥰`,
    ],
  },
  {
    name: 'The Anniversary Party',
    icon: '🎉',
    prompt: "Throw your anniversary party. Who's there? What happens?",
    subPrompts: [
      (p, o) => `Who's on the guest list, ${firstOf(o)}? 👥`,
      (p, o) => `What song plays when you two have your moment? 🎵`,
      (p, o) => `What does someone toast that makes everyone cry (happy tears)? 🥂`,
    ],
  },
];

function buildTheme(profile, history) {
  const candidates = THEMES.filter((t) => !history.includes(t.name));
  const pool = candidates.length ? candidates : THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { THEMES, buildTheme };
