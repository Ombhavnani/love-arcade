// Small shared helpers.
const r = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[r(arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(r(copy.length), 1)[0]);
  return out;
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const strip = (s = '') => String(s).trim();

module.exports = { r, pick, pickN, shuffle, chance, clamp, strip };
