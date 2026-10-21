// Kiest de volgende duels en rijen. Meestal via het model (nextDuel/nextRow: onzekere banen tegen buren),
// maar soms bewust verder uit elkaar, zodat het niet steeds voorspelbaar voelt. model.js blijft ongewijzigd.
import { nextDuel, nextRow } from './model.js';

export const FAR_SHARE = .3;   // aandeel duels "verder uit elkaar" (kost in de simulatie niets)
export const FAR_SHARE_ROW = .15;   // bij rijen minder vaak: daar kost spreiden wat zekerheid
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// Kleine voorrang voor banen met weinig eigen battles: geen perfecte balans, maar geen baan blijft echt achter.
// Werkt via de onzekerheid waarmee het model kiest: 0 battles weegt zo'n 2x zwaarder, 3 battles 1,2x, 10 of meer nauwelijks.
export const FEW_BONUS = .6;
export function withBonus(m) {
  if (!m?.battles) return m;
  return { ...m, variance: m.variance.map((v, i) => v * (1 + FEW_BONUS / (1 + (m.battles.get(m.ids[i]) || 0)))) };
}

function recentSet(comps, n = 60) { const s = new Set(); for (let k = Math.max(0, comps.length - n); k < comps.length; k++) s.add(key(comps[k].a, comps[k].b)); return s; }
function weighted(items, w, rand) { let t = 0; for (const x of w) t += x; let r = rand() * t; for (let k = 0; k < items.length; k++) { r -= w[k]; if (r <= 0) return items[k]; } return items[items.length - 1]; }
function rankedOf(m, filter) { return filter ? m.order.filter(i => filter(m.ids[i])) : m.order; }

/** Een onzekere baan tegen een baan 8 tot 40 plekken verderop. */
export function farPair(m, comps, filter, rand = Math.random) {
  const ranked = rankedOf(m, filter); const n = ranked.length; if (n < 8) return null;
  const recent = recentSet(comps);
  const lo = Math.max(4, Math.round(n * .05)), hi = Math.max(lo + 4, Math.min(40, Math.round(n * .3)));
  for (let t = 0; t < 8; t++) {
    const i = weighted(ranked, ranked.map(x => Math.pow(m.variance[x], 1.5)), rand);
    const pi = ranked.indexOf(i);
    const cands = ranked.filter((j, pj) => { const d = Math.abs(pj - pi); return d >= lo && d <= hi && !recent.has(key(m.ids[i], m.ids[j])); });
    if (!cands.length) continue;
    const j = cands[Math.floor(rand() * cands.length)];
    return rand() < .5 ? [m.ids[i], m.ids[j]] : [m.ids[j], m.ids[i]];
  }
  return null;
}

export function pickDuel(m, comps, { filter = null, mode = 'normal', rand = Math.random } = {}) {
  m = withBonus(m);
  if (mode !== 'twijfel' && rand() < FAR_SHARE) { const p = farPair(m, comps, filter, rand); if (p) return p; }
  return nextDuel(m, comps, { filter, mode, rand });
}

/** Rij van 4: meestal dicht bij elkaar (informatief), soms gespreid over een groter stuk van je lijst. */
export function pickRow(m, comps, { filter = null, mode = 'normal', size = 4, rand = Math.random } = {}) {
  m = withBonus(m);
  if (mode !== 'twijfel' && rand() < FAR_SHARE_ROW) {
    const ranked = rankedOf(m, filter); const n = ranked.length;
    if (n >= size * 4) {
      const i = weighted(ranked, ranked.map(x => Math.pow(m.variance[x], 1.5)), rand);
      const pi = ranked.indexOf(i), span = Math.max(12, Math.min(45, Math.round(n * .3)));
      const lo = Math.max(0, pi - span), hi = Math.min(n - 1, pi + span);
      const pool = []; for (let p = lo; p <= hi; p++) if (p !== pi) pool.push(ranked[p]);
      const out = [i];
      while (out.length < size && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      for (let a = out.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [out[a], out[b]] = [out[b], out[a]]; }
      if (out.length === size) return out.map(x => m.ids[x]);
    }
  }
  return nextRow(m, comps, { filter, mode, size, rand });
}
