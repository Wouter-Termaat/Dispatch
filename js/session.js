// Een ranksessie: houdt bij wat er gebeurt, slaat vergelijkingen direct (optimistisch) op,
// en maakt aan het eind de samenvatting voor de affiche.
import { S, me, meKey, model, refit, compsOf, coaster, mySettings } from './state.js';
import { newBatch } from './store.js';
import { sessionSummary } from './model.js';
import { toast } from './ui.js';
import { TICKETS } from './copy.js';

const CHECK_EVERY = 15;
export const session = { current: null };

export function startSession(kind, { mode = 'normal', label = '', length, filter = null, extra = {} } = {}) {
  const m = model();
  const before = new Map(m.ranking.map((id, p) => [id, p]));
  try { localStorage.setItem('dispatch.before.' + meKey(), JSON.stringify(Object.fromEntries(before))); } catch { /* geen ruimte */ }
  session.current = { kind, mode, label, filter, length: length ?? mySettings().sessionLength, startedAt: Date.now(), before,
    rows: 0, duels: 0, checks: 0, actions: [], ...extra };
  return session.current;
}

const countReal = () => compsOf(meKey()).filter(c => c.outcome !== 'skip').length;

/** Slaat vergelijkingen op als één batch. comps: [{a,b,outcome}]. Geeft de batch-id terug. */
export function commit(comps, cmode, { ms = 0, type = 'row', ids = [] } = {}) {
  const user_id = me().id, batch = newBatch(), t = new Date();
  const before = countReal();
  const rows = comps.map((c, i) => ({ ...c, user_id, batch, mode: cmode, created_at: new Date(t.getTime() + i).toISOString() }));
  S.store.addComparisons(rows);
  refit();
  const s = session.current;
  if (s) {
    if (type === 'row') s.rows++; else if (type === 'duel') s.duels++; else if (type === 'check') s.checks++;
    s.actions.push({ type, batch, ids, comps, ms });
  }
  if (type !== 'skip') bumpActions();
  const after = before + comps.filter(c => c.outcome !== 'skip').length;
  for (const tk of TICKETS) if (before < tk.at && after >= tk.at) setTimeout(() => toast(`Ticket verdiend: ${tk.naam}. ${tk.tekst}`, 4200), 700);
  return batch;
}

/** Draait de laatste batch van deze sessie terug. Geeft de actie terug (of null). */
export function undoLast() {
  const s = session.current; if (!s) return null;
  for (let i = s.actions.length - 1; i >= 0; i--) {
    const a = s.actions[i]; if (a.type === 'skip') { s.actions.splice(i, 1); continue; }
    s.actions.splice(i, 1);
    S.store.deleteBatch(me().id, a.batch);
    if (a.type === 'row') s.rows--; else if (a.type === 'duel') s.duels--; else if (a.type === 'check') s.checks--;
    bumpActions(-1); refit();
    return a;
  }
  return null;
}

function counterKey() { return 'dispatch.actions.' + meKey(); }
function bumpActions(d = 1) { const n = (+localStorage.getItem(counterKey()) || 0) + d; localStorage.setItem(counterKey(), String(Math.max(0, n))); }
/** Tijd voor een "Klopt dit?"-ronde? (elke ~15 acties) */
export function checkDue() {
  const n = +localStorage.getItem(counterKey()) || 0;
  const last = +localStorage.getItem(counterKey() + '.check') || 0;
  return n - last >= CHECK_EVERY;
}
export function checkDone() { localStorage.setItem(counterKey() + '.check', localStorage.getItem(counterKey()) || '0'); }

/** Sluit de sessie af en bewaart de samenvatting voor de affiche. */
export async function endSession() {
  const s = session.current; session.current = null;
  if (!s) return null;
  const after = await refit();
  const sum = sessionSummary(s.before, after, {});
  const sig = x => 1 / (1 + Math.exp(-x));
  const pOf = (a, b) => { const i = after.idx.get(a), j = after.idx.get(b); return i === undefined || j === undefined ? 0 : sig(after.theta[i] - after.theta[j]); };
  // zwaarste keuze: de actie waar je het langst over deed; daarbinnen het paar dat het dichtst bij 50/50 lag
  let hardest = null;
  const acts = s.actions.filter(a => a.type === 'row' || a.type === 'duel');
  if (acts.length) {
    const slow = acts.reduce((x, y) => (y.ms > x.ms ? y : x));
    let best = null, bd = 9;
    for (const c of slow.comps) { if (c.outcome === 'skip') continue; const d = Math.abs(pOf(c.a, c.b) - .5); if (d < bd) { bd = d; best = [c.a, c.b]; } }
    hardest = best;
  }
  const summary = {
    kind: s.kind, mode: s.mode, label: s.label, date: new Date().toISOString(), key: meKey(),
    rows: s.rows, duels: s.duels, checks: s.checks,
    riser: sum.riser ? { id: sum.riser.id, delta: sum.riser.delta } : null,
    faller: sum.faller ? { id: sum.faller.id, delta: sum.faller.delta } : null,
    hardest, certainty: after.certainty, champion: s.champion || null,
  };
  try { localStorage.setItem('dispatch.lastSession', JSON.stringify(summary)); } catch { /* */ }
  return summary;
}
export function lastSummary() { try { return JSON.parse(localStorage.getItem('dispatch.lastSession') || 'null'); } catch { return null; } }

/** Filter op basis van de modus (park-avond). */
export function filterFromParams(params) {
  const parks = params.getAll('park');
  if (params.get('mode') === 'park' && parks.length) { const set = new Set(parks); return id => set.has(coaster(id)?.park); }
  return null;
}
export function labelFromParams(params, base) {
  const mode = params.get('mode'); const parks = params.getAll('park');
  if (mode === 'twijfel') return 'Twijfelzone';
  if (mode === 'park') return parks.length === 2 ? `${parks[0]} tegen ${parks[1]}` : `Park-avond · ${parks[0]}`;
  if (mode === 'rematch') return 'Rematch';
  return base;
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
