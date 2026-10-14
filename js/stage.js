// Eén gedeelde WebGL-laag (licht en mist) voor alle schermen. Elk scherm zet zijn eigen belichting.
import { createLightFog } from './fx/lightfog.js';

const BASE = { fogH: .3, fog: .8, tint: [1, .75, .45], haze: [.5, .38, .6], beams: [], pool: [.5, 0], poolI: 0, pool2: [.5, .5], pool2I: 0 };
let fx = null, season = {};

export function now() {
  const q = new URLSearchParams(location.search).get('nu'); // testhaak: ?nu=2026-10-31T23:30
  return q ? new Date(q) : new Date();
}
export function isHalloween(d = now()) { const m = d.getMonth(), day = d.getDate(); return (m === 9 && day >= 24) || (m === 10 && day <= 2); }
export function isClosed(d = now()) { const h = d.getHours(); return h >= 23 || h < 6; }

export function initStage() {
  const canvas = document.getElementById('fx');
  const small = Math.min(innerWidth, innerHeight) < 700;
  fx = createLightFog(canvas, { ...BASE, scale: small ? .4 : .45 });
  if (isHalloween()) { season = { tint: [.62, .78, 1], haze: [.36, .44, .62], fogMul: 1.5 }; document.documentElement.classList.add('halloween'); }
  return fx;
}

/** Zet de belichting van een scherm (volledige set, ontbrekende waarden worden standaard). */
export function light(opts = {}) {
  if (!fx) return;
  const o = { ...BASE, ...opts };
  if (season.tint) { o.tint = season.tint; o.haze = season.haze; o.fog = o.fog * season.fogMul; o.fogH = Math.min(.7, o.fogH * 1.25); }
  fx.set(o);
}
/** Alleen de bundels aanpassen (snel, tijdens ranken). */
export function beams(list) { fx?.set({ beams: list }); }
export function lightNow() { return fx?.o; }

/** Spot van boven op een element: x in 0..1, y=0 onderaan. */
export function spotOver(rect, i = .42, w = .10) {
  const W = innerWidth, H = innerHeight;
  return { x: (rect.left + rect.width / 2) / W, y: 1 + 90 / H, a: Math.PI, w, i };
}
