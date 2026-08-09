// Story Theatre — locations, emotions and objects to spark co-created stories.
const { pick, pickN } = require('../util');

const LOCATIONS = [
  'Paris', 'a midnight train', 'a rooftop in the rain', 'a tiny diner at 3am',
  'the moon', 'a beach at 2am', 'a quiet library after closing', 'a road-trip gas station',
  'a museum after hours', 'an airport in the wrong time zone', 'a tiny flat with one lamp',
  'a carnival that only exists at night',
];

const EMOTIONS = [
  'missing each other', 'giddy happiness', 'nervous butterflies', 'cozy safety',
  'mischief', 'longing', 'quiet awe', 'playful competition',
];

const OBJECTS = [
  'a forgotten letter', 'a single coin', 'a faded polaroid', 'a frayed scarf',
  'a ringing payphone', 'a suitcase with one sock inside', 'a glowing keychain',
  'a half-eaten croissant', 'an old mixtape', 'a map with a circled dot', 'a locked diary',
];

function rollStoryElements(history) {
  const loc = pickN(LOCATIONS.filter((l) => !history.includes(l)), 1)[0] || pick(LOCATIONS);
  const emo = pickN(EMOTIONS.filter((e) => !history.includes(e)), 1)[0] || pick(EMOTIONS);
  const obj = pickN(OBJECTS.filter((o) => !history.includes(o)), 1)[0] || pick(OBJECTS);
  return { location: loc, emotion: emo, object: obj };
}

const STORY_TITLES = [
  (el, lines) => `The ${cap(el.location)} Letters`,
  (el, lines) => `A Coin for ${cap(el.object)}`,
  (el, lines) => `Where the ${cap(el.emotion)} Lived`,
  (el, lines) => `${cap(el.location)} in Our Bones`,
  (el, lines) => `The Night of the ${cap(el.object)}`,
  (el, lines) => `Two Players, One Story`,
];

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { LOCATIONS, EMOTIONS, OBJECTS, rollStoryElements, STORY_TITLES, cap };
