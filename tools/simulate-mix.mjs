// Effect van "soms verder uit elkaar" (js/pick.js) op de nauwkeurigheid. node tools/simulate-mix.mjs
// Zelfde opzet als tools/simulate.mjs, maar de selectie loopt via pickDuel/pickRow.
import { fitModel, rowToComparisons, mulberry32, probit } from '../js/model.js';
import { pickDuel, pickRow } from '../js/pick.js';
const N = 169, SDtrue = 11.6, EXCEL_NOISE = 3;
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function run(seed, mode, actions) {
  const r = mulberry32(seed);
  const truth = Array.from({ length: N }, (_, i) => SDtrue * probit(1 - (i + .5) / N));
  const ids = truth.map((_, i) => 'c' + i);
  const noisy = truth.map(t => t + gauss(r) * EXCEL_NOISE);
  const entries = ids.map((_, i) => i).sort((a, b) => noisy[b] - noisy[a]).map((i, p) => ({ coaster_id: ids[i], initial_rank: p + 1 }));
  const comps = []; let model = fitModel({ entries });
  const err = () => { let s = 0; model.ranking.forEach((id, p) => (s += Math.abs(p - +id.slice(1)))); return s / N; };
  const out = {};
  const answer = (a, b) => (r() < 1 / (1 + Math.exp(-(truth[+a.slice(1)] - truth[+b.slice(1)]))) ? 'a' : 'b');
  for (let k = 1; k <= actions; k++) {
    if (mode === 'duel') { const [a, b] = pickDuel(model, comps, { rand: r }); comps.push({ a, b, outcome: answer(a, b) }); }
    else { const row = pickRow(model, comps, { rand: r }); comps.push(...rowToComparisons(row.map(id => [id, truth[+id.slice(1)] + gauss(r) * 1.8]).sort((x, y) => y[1] - x[1]).map(x => x[0]))); }
    model = fitModel({ entries, comparisons: comps, warm: model });
    if ([50, 100, 150].includes(k)) out[k] = [err(), model.certainty];
  }
  return out;
}
for (const mode of ['duel', 'row']) {
  const R = [1, 2, 3].map(s => run(s, mode, 150));
  console.log(mode + ' (mix)', Object.keys(R[0]).map(k => `${k}: err ${(R.reduce((a, x) => a + x[k][0], 0) / 3).toFixed(1)} zeker ${(100 * R.reduce((a, x) => a + x[k][1], 0) / 3).toFixed(0)}%`).join(' | '));
}
