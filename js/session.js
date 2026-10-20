// Een ranksessie: houdt bij wat er gebeurt, slaat vergelijkingen direct (optimistisch) op,
// en maakt aan het eind de samenvatting voor de affiche.
import { S, me, meKey, model, refit, compsOf, coaster, mySettings } from './state.js';
import { newBatch } from './store.js';
import { sessionSummary } from './model.js';
import { toast } from './ui.js';
import { TICKETS } from './copy.js';
import { focusSet, FOCUS } from './modes.js';
import { track, setTrackSession, inputKind } from './track.js';

export const session = { current: null };

export function startSession(kind, { mode = 'normal', label = '', length, filter = null, extra = {} } = {}) {
  const m = model();
  const before = new Map(m.ranking.map((id, p) => [id, p]));
  try { localStorage.setItem('dispatch.before.' + meKey(), JSON.stringify(Object.fromEntries(before))); } catch { /* geen ruimte */ }
  session.current = { id: newBatch(), kind, mode, label, filter, length: length ?? mySettings().sessionLength, startedAt: Date.now(), before,
    rows: 0, duels: 0, checks: 0, actions: [], undos: 0, certaintyBefore: m.certainty, ...extra };
  setTrackSession(session.current.id);
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  track('session_start', { kind, mode, label, focus: q.get('focus'), parks: q.getAll('park'), length: session.current.length,
    pool: filter ? m.ids.filter(filter).length : m.n, n: m.n, certainty: m.certainty, meanHalfWidth: m.meanHalfWidth, comparisons: countReal() });
  return session.current;
}

const countReal = () => compsOf(meKey()).filter(c => c.outcome !== 'skip').length;

/** Slaat vergelijkingen op als één batch. comps: [{a,b,outcome}]. Geeft de batch-id terug. */
export function commit(comps, cmode, { ms = 0, type = 'row', ids = [] } = {}) {
  const user_id = me().id, batch = newBatch(), t = new Date();
  const before = countReal();
  logChoice(comps, cmode, { ms, type, ids, batch });
  const rows = comps.map((c, i) => ({ ...c, user_id, batch, mode: cmode, created_at: new Date(t.getTime() + i).toISOString() }));
  S.store.addComparisons(rows);
  refit();
  const s = session.current;
  if (s) {
    if (type === 'row') s.rows++; else if (type === 'duel') s.duels++; else if (type === 'check') s.checks++;
    s.actions.push({ type, batch, ids, comps, ms, at: Date.now() });
  }
  const after = before + comps.filter(c => c.outcome !== 'skip').length;
  for (const tk of TICKETS) if (before < tk.at && after >= tk.at) { track('ticket', { naam: tk.naam, at: tk.at }); setTimeout(() => toast(`Ticket verdiend: ${tk.naam}. ${tk.tekst}`, 4200), 700); }
  return batch;
}

/** Logboek per keuze: wat het model vooraf verwachtte, waar de banen stonden en hoe zeker, hoe lang je erover deed. */
function logChoice(comps, cmode, { ms, type, ids, batch }) {
  const m = model(); if (!m) return;
  const sig = x => 1 / (1 + Math.exp(-x));
  const at = id => { const i = m.idx.get(id); return i === undefined ? null : { r: m.position[i] + 1, hw: (m.hi[i] - m.lo[i]) / 2, b: m.battles?.get(id) || 0 }; };
  const pairs = comps.map(c => {
    const i = m.idx.get(c.a), j = m.idx.get(c.b);
    const p = i === undefined || j === undefined ? null : +sig(m.theta[i] - m.theta[j]).toFixed(3);   // kans dat a wint volgens het model
    const won = c.outcome === 'a' ? p : c.outcome === 'b' && p !== null ? +(1 - p).toFixed(3) : null;
    return { a: c.a, b: c.b, o: c.outcome, p, upset: won !== null && won < .3 };
  });
  const s = session.current;
  track('choice', { batch, type, mode: cmode, ms: Math.round(ms), input: inputKind(), n: (s?.actions.length || 0) + 1,
    ids, at: Object.fromEntries(ids.map(id => [id, at(id)])), pairs,
    order: type === 'row' ? ids : undefined, hour: new Date().getHours() });
}

/** Ronde gestopt zonder afsluiting (weg genavigeerd of niets gekozen). */
export function abandonSession(reason = 'weg') {
  const s = session.current; if (!s) return;
  track('session_end', { completed: false, reason, kind: s.kind, mode: s.mode, label: s.label, ms: Date.now() - s.startedAt, actions: s.actions.length, undos: s.undos, rows: s.rows, duels: s.duels, length: s.length });
  session.current = null; setTrackSession(null);
}

/** Draait de laatste batch van deze sessie terug. Geeft de actie terug (of null). */
export function undoLast() {
  const s = session.current; if (!s) return null;
  for (let i = s.actions.length - 1; i >= 0; i--) {
    const a = s.actions[i]; if (a.type === 'skip') { s.actions.splice(i, 1); continue; }
    s.actions.splice(i, 1); s.undos++;
    track('undo', { batch: a.batch, type: a.type, ids: a.ids, msAfter: a.at ? Date.now() - a.at : null });
    S.store.deleteBatch(me().id, a.batch);
    if (a.type === 'row') s.rows--; else if (a.type === 'duel') s.duels--; else if (a.type === 'check') s.checks--;
    refit();
    return a;
  }
  return null;
}

/**
 * Zwaarste keuze van een sessie: een samenspel van twee dingen.
 * - Gelijkwaardigheid: hoe dicht de twee banen volgens je ranking bij elkaar staan (precies 50/50 is het zwaarst).
 * - Twijfeltijd: hoe lang je erover deed, vergeleken met je eigen gewone tempo in deze sessie (mediaan per soort, want een
 *   rij van vier duurt van nature langer dan een duel). Drie keer je gewone tempo is het maximum.
 * Ze worden vermenigvuldigd: lang twijfelen tussen twee banen die ver uit elkaar staan is geen dilemma, en een snelle
 * keuze tussen twee gelijke banen telt nog wel mee (60%), maar met twijfeltijd erbij wint hij. Gelijk geven telt als extra twijfel.
 */
export function hardestChoice(actions, pOf) {
  const acts = actions.filter(a => (a.type === 'row' || a.type === 'duel') && a.ms > 0);
  if (!acts.length) return null;
  const median = type => { const v = acts.filter(a => a.type === type).map(a => a.ms).sort((x, y) => x - y); return v[v.length >> 1] || 1; };
  const med = { row: median('row'), duel: median('duel') };
  let best = null, top = -1;
  for (const a of acts) {
    const rel = a.ms / med[a.type];
    const traag = Math.min(rel, 3) / 3;                                        // 0 tot 1
    for (const c of a.comps) {
      if (c.outcome === 'skip') continue;
      const gelijk = 1 - Math.abs(pOf(c.a, c.b) - .5) * 2;                     // 1 = precies 50/50
      const score = gelijk * (.6 + .4 * traag) + (c.outcome === 'tie' ? .05 : 0);
      if (score > top) { top = score; best = [c.a, c.b]; }
    }
  }
  return best;
}

/** Sluit de sessie af en bewaart de samenvatting voor de affiche. */
export async function endSession() {
  const s = session.current; session.current = null;
  if (!s) return null;
  const after = await refit();
  const sum = sessionSummary(s.before, after, {});
  const sig = x => 1 / (1 + Math.exp(-x));
  const pOf = (a, b) => { const i = after.idx.get(a), j = after.idx.get(b); return i === undefined || j === undefined ? 0 : sig(after.theta[i] - after.theta[j]); };
  const hardest = hardestChoice(s.actions, pOf);
  const summary = {
    kind: s.kind, mode: s.mode, label: s.label, date: new Date().toISOString(), key: meKey(),
    rows: s.rows, duels: s.duels, checks: s.checks,
    riser: sum.riser ? { id: sum.riser.id, delta: sum.riser.delta } : null,
    faller: sum.faller ? { id: sum.faller.id, delta: sum.faller.delta } : null,
    hardest, certainty: after.certainty, champion: s.champion || null,
  };
  try { localStorage.setItem('dispatch.lastSession', JSON.stringify(summary)); } catch { /* */ }
  const msList = s.actions.filter(a => a.ms > 0).map(a => a.ms).sort((x, y) => x - y);
  const outs = s.actions.flatMap(a => a.comps.map(c => c.outcome));
  track('session_end', { completed: true, ...summary, date: undefined, key: undefined,
    ms: Date.now() - s.startedAt, actions: s.actions.length, undos: s.undos, length: s.length,
    medianMs: msList[msList.length >> 1] || null, meanMs: msList.length ? Math.round(msList.reduce((x, y) => x + y, 0) / msList.length) : null,
    fastestMs: msList[0] || null, slowestMs: msList.at(-1) || null,
    ties: outs.filter(o => o === 'tie').length, skips: outs.filter(o => o === 'skip').length,
    certaintyBefore: s.certaintyBefore, meanHalfWidth: after.meanHalfWidth,
    moved: sum.moves.filter(x => x.delta).length, biggestMoves: sum.moves.filter(x => Math.abs(x.delta) >= 3).slice(0, 12).map(x => [x.id, x.from + 1, x.to + 1]) });
  setTrackSession(null);
  return summary;
}
export function lastSummary() { try { return JSON.parse(localStorage.getItem('dispatch.lastSession') || 'null'); } catch { return null; } }

/** Filter op basis van de modus (park-avond). */
export function filterFromParams(params) {
  const parks = params.getAll('park');
  if (params.get('mode') === 'park' && parks.length) { const set = new Set(parks); return id => set.has(coaster(id)?.park); }
  // focus (Top 10 enzovoort): de set ligt vast bij de start van de sessie, ook als de ranking tijdens het spelen verschuift
  const fs = focusSet(params.get('focus'));
  if (fs) { const set = new Set(fs.all); return id => set.has(id); }
  return null;
}
export function labelFromParams(params, base) {
  const mode = params.get('mode'); const parks = params.getAll('park');
  const fl = FOCUS.find(x => x.k === params.get('focus') && x.n);
  if (mode === 'twijfel') return fl ? `Twijfelzone · ${fl.t}` : 'Twijfelzone';
  if (mode === 'park') return parks.length === 2 ? `${parks[0]} tegen ${parks[1]}` : `Park-avond · ${parks[0]}`;
  if (mode === 'rematch') return 'Rematch';
  return fl ? `${base} · ${fl.t}` : base;
}

/** Trimrem: houdt het tempo bij. Te snel (< 0,6 s per keuze) een paar keer achter elkaar? Dan iets trager. */
export class Tempo {
  constructor(limit = .6, streak = 3) { this.limit = limit; this.streak = streak; this.fast = 0; this.slowLeft = 0; this.fired = false; }
  /** perChoice in seconden. Geeft true terug als Trimrem nu aangaat. */
  add(perChoice) {
    if (this.slowLeft > 0) this.slowLeft--;
    this.fast = perChoice < this.limit ? this.fast + 1 : 0;
    if (this.fast >= this.streak && this.slowLeft === 0) { this.fast = 0; this.slowLeft = 4; return true; }
    return false;
  }
  get slow() { return this.slowLeft > 0; }
}
