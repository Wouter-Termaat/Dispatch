// Inzichten: jouw cijfers, berekend uit je eigen vergelijkingen en je huidige model. Alles lokaal, niets extra opgeslagen.
import { model, compsOf, entriesOf, coaster } from './state.js';
import { TICKETS } from './copy.js';

export const MODE_NAMES = { duel: 'Le Duel', rangee: 'La Rangée', twijfel: 'Twijfelzone', park: 'Park-avond', rematch: 'Rematch', toernooi: 'Toernooi', plaatsing: 'Plaatsing', check: 'Controle' };
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const sig = x => 1 / (1 + Math.exp(-x));
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function myStats(key) {
  const m = model(key), comps = compsOf(key), real = comps.filter(c => c.outcome !== 'skip');
  const out = { m, total: real.length, skips: comps.length - real.length, ties: real.filter(c => c.outcome === 'tie').length };
  out.choices = new Set(comps.map(c => c.batch)).size;

  // per spelvorm: keuzes (batches) en vergelijkingen
  const per = new Map();
  for (const c of comps) { const k = c.mode || 'duel'; const p = per.get(k) || { mode: k, comps: 0, batches: new Set() }; if (c.outcome !== 'skip') p.comps++; p.batches.add(c.batch); per.set(k, p); }
  out.modes = [...per.values()].map(p => ({ mode: p.mode, name: MODE_NAMES[p.mode] || p.mode, comps: p.comps, choices: p.batches.size })).sort((a, b) => b.choices - a.choices);

  // wanneer: speeldagen, reeksen, dagdeel en weekdag (per keuze, niet per vergelijking)
  const batchAt = new Map(); for (const c of comps) if (c.created_at && !batchAt.has(c.batch)) batchAt.set(c.batch, new Date(c.created_at));
  const times = [...batchAt.values()];
  const days = [...new Set(times.map(dayKey))].map(k => { const [y, mo, d] = k.split('-').map(Number); return new Date(y, mo - 1, d).getTime(); }).sort((a, b) => a - b);
  out.days = days.length;
  let best = 0, run = 0, prev = null;
  for (const t of days) { run = prev !== null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  out.longestStreak = best;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // huidige reeks: telt alleen als je vandaag of gisteren nog speelde
  let cur = 0;
  if (days.length && today.getTime() - days.at(-1) <= 864e5) { cur = 1; for (let i = days.length - 1; i > 0 && Math.round((days[i] - days[i - 1]) / 864e5) === 1; i--) cur++; }
  out.currentStreak = cur;
  const parts = { nacht: 0, ochtend: 0, middag: 0, avond: 0 }, wd = new Array(7).fill(0);
  for (const t of times) { const h = t.getHours(); parts[h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond']++; wd[t.getDay()]++; }
  out.parts = parts; out.favDay = times.length ? DAYS[wd.indexOf(Math.max(...wd))] : null;
  const perDay = new Map(); for (const t of times) { const k = dayKey(t); perDay.set(k, { n: (perDay.get(k)?.n || 0) + 1, date: t }); }
  out.busiestDay = [...perDay.values()].sort((a, b) => b.n - a.n)[0] || null;

  if (!m) return out;
  // per baan: battles, winst, zekerheid
  const rec = new Map();
  for (const c of real) for (const [id, w] of [[c.a, c.outcome === 'a' ? 1 : c.outcome === 'tie' ? .5 : 0], [c.b, c.outcome === 'b' ? 1 : c.outcome === 'tie' ? .5 : 0]]) { const r = rec.get(id) || { n: 0, w: 0 }; r.n++; r.w += w; rec.set(id, r); }
  const hw = id => { const i = m.idx.get(id); return (m.hi[i] - m.lo[i]) / 2; };
  const inList = id => m.idx.has(id);
  const played = [...rec.entries()].filter(([id]) => inList(id));
  out.mostPlayed = played.sort((a, b) => b[1].n - a[1].n)[0] || null;
  const winners = played.filter(([, r]) => r.n >= 5).map(([id, r]) => [id, r.w / r.n, r.n]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  out.bestWin = winners[0] || null; out.worstWin = winners.at(-1) && winners.length > 1 ? winners.at(-1) : null;
  const certain = m.ids.filter(id => (m.battles?.get(id) || 0) >= 3).sort((a, b) => hw(a) - hw(b) || m.position[m.idx.get(a)] - m.position[m.idx.get(b)]);
  out.surest = certain[0] || null;
  out.unsurest = [...m.ids].sort((a, b) => hw(b) - hw(a))[0] || null;
  out.certain = Math.round((m.certainty || 0) * m.n);

  // sinds je Excel: de grootste stijger en daler
  const excel = new Map([...entriesOf(key)].sort((a, b) => a.initial_rank - b.initial_rank).map((e, p) => [e.coaster_id, p]));
  const moves = m.ranking.map((id, p) => ({ id, from: excel.get(id), to: p })).filter(x => x.from !== undefined).map(x => ({ ...x, delta: x.from - x.to }));
  moves.sort((a, b) => b.delta - a.delta);
  out.riser = moves[0]?.delta > 0 ? moves[0] : null; out.faller = moves.at(-1)?.delta < 0 ? moves.at(-1) : null;
  out.moved = moves.filter(x => x.delta).length;

  // grootste verrassing: de winst die het model (met alles wat het nu weet) het minst had zien aankomen
  let up = null;
  for (const c of real) {
    if (c.outcome === 'tie') continue;
    const w = c.outcome === 'a' ? c.a : c.b, l = c.outcome === 'a' ? c.b : c.a; const i = m.idx.get(w), j = m.idx.get(l);
    if (i === undefined || j === undefined) continue;
    const p = sig(m.theta[i] - m.theta[j]); if (!up || p < up.p) up = { w, l, p, at: c.created_at };
  }
  out.upset = up && up.p < .5 ? up : null;
  out.ticket = TICKETS.find(t => out.total < t.at) || null;
  out.lastTicket = [...TICKETS].reverse().find(t => out.total >= t.at) || null;
  out.name = id => coaster(id)?.name || id;
  out.rank = id => m.position[m.idx.get(id)] + 1;
  return out;
}
