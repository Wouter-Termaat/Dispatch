// App-staat: store, catalogus, profielen en het model per persoon (gefit in een worker).
import { fitModel, remainingEstimate } from './model.js';

export const DEFAULT_SETTINGS = { anchorDuels: 3, sound: true, music: 'orgel', musicUnlocked: false, showCertainty: false, sessionLength: 10, rowLength: 5 };

export const S = {
  store: null,
  models: {},           // key -> model
  listeners: new Set(),
};

export function on(fn) { S.listeners.add(fn); return () => S.listeners.delete(fn); }
function emit(what) { for (const fn of S.listeners) { try { fn(what); } catch (e) { console.error(e); } } }

// ---------- lezen ----------
export const catalog = () => { if (S._catV !== S.store.data.coasters) { S._catV = S.store.data.coasters; S._cat = new Map(S.store.data.coasters.map(c => [c.id, c])); } return S._cat; };
export const coaster = id => catalog().get(id);
export const profiles = () => S.store.data.profiles;
export const profileByKey = key => profiles().find(p => p.key === key);
export const profileById = id => profiles().find(p => p.id === id);
export const me = () => profileById(S.store.userId);
export const meKey = () => me()?.key;
export const otherKey = () => (meKey() === 'wouter' ? 'luca' : 'wouter');
export const nameOf = key => profileByKey(key)?.name || key;
export const entriesOf = key => { const id = profileByKey(key)?.id; return S.store.data.entries.filter(e => e.user_id === id); };
export const compsOf = key => {
  const id = profileByKey(key)?.id;
  return S.store.data.comparisons.filter(c => c.user_id === id).sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0));
};
export const settingsOf = key => ({ ...DEFAULT_SETTINGS, ...(profileByKey(key)?.settings || {}) });
export const mySettings = () => settingsOf(meKey());
export const model = key => S.models[key || meKey()];
export const remaining = key => {
  const m = model(key); if (!m) return null;
  const r = remainingEstimate(m);
  // plus de battles die nog nodig zijn tot elke baan zijn minimum heeft (elk duel telt voor twee banen)
  const extra = Math.ceil((m.missingBattles || 0) / 2);
  return { ...r, duels: r.duels + extra, rows: r.rows + Math.ceil(extra / 3), stable: r.stable && !extra };
};

// Zekerheid. Je Excel-volgorde is een startpunt, geen bewijs: hij telt zwakker mee (de helft van de ankersterkte uit Meer)
// en de verschillen die hij vooraf aanneemt zijn kleiner (spreadPerItem). Zo zijn de balken eerlijk breed en loopt de
// zekerheid pas op met echte battles. Een baan telt bovendien pas als zeker na minstens MIN_BATTLES eigen battles.
const ANCHOR_FACTOR = .5, SPREAD = .045, TAIL_CAP = 2, MIN_BATTLES = 3;   // TAIL_CAP: top en onderkant van je Excel zijn niet vanzelf zeker
function withEvidence(m, comparisons) {
  const count = new Map();
  for (const c of comparisons) { if (c.outcome === 'skip') continue; count.set(c.a, (count.get(c.a) || 0) + 1); count.set(c.b, (count.get(c.b) || 0) + 1); }
  let stable = 0, missing = 0;
  m.ids.forEach((id, i) => {
    const k = count.get(id) || 0; missing += Math.max(0, MIN_BATTLES - k);
    if (k >= MIN_BATTLES && (m.hi[i] - m.lo[i]) / 2 <= m.stableHW) stable++;
  });
  m.certainty = m.n ? stable / m.n : 0; m.unstable = m.n - stable; m.missingBattles = missing; m.battles = count;
  return m;
}

export async function saveSetting(patch) {
  await S.store.saveSettings(me().id, patch);
  import('./track.js').then(t => t.track('setting', patch)).catch(() => {});   // los geladen: track.js leunt zelf op state.js
  emit('settings');
  if ('anchorDuels' in patch) refit(meKey());
}

// ---------- model in een worker ----------
let worker = null, seq = 0; const waiting = new Map();
const status = {}; // key -> { inflight, dirty, promise }
function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => { const w = waiting.get(e.data.id); waiting.delete(e.data.id); w?.(e.data); };
    worker.onerror = e => { console.warn('Worker faalt, fit op de hoofdthread', e.message); worker = false; for (const [id, w] of waiting) { waiting.delete(id); w({ error: 'worker' }); } };
  } catch { worker = false; }
  return worker;
}
function fitOnce(key) {
  const entries = entriesOf(key), comparisons = compsOf(key), s = settingsOf(key);
  const settings = { anchorDuels: s.anchorDuels * ANCHOR_FACTOR, spreadPerItem: SPREAD, tailCap: TAIL_CAP };
  const w = getWorker();
  if (!w) return Promise.resolve(fitModel({ entries, comparisons, settings, warm: S.models[key] }));
  return new Promise((res, rej) => {
    const id = ++seq; waiting.set(id, msg => {
      if (msg.error === 'worker') res(fitModel({ entries, comparisons, settings, warm: S.models[key] }));
      else if (msg.error) rej(new Error(msg.error)); else res(msg.model);
    });
    w.postMessage({ id, key, entries, comparisons, settings });
  });
}
/** Vraagt een nieuwe fit aan. Loopt er al een, dan volgt direct daarna nog één met de nieuwste data. */
export function refit(key = meKey()) {
  const st = status[key] || (status[key] = {});
  if (st.inflight) { st.dirty = true; return st.promise; }
  st.inflight = true;
  st.promise = (async () => {
    let m;
    do { st.dirty = false; m = withEvidence(await fitOnce(key), compsOf(key)); } while (st.dirty);
    S.models[key] = m; st.inflight = false; emit('model:' + key); emit('model');
    return m;
  })().catch(e => { st.inflight = false; console.error(e); throw e; });
  return st.promise;
}
export async function fitAll() { await Promise.all(profiles().map(p => refit(p.key))); }

export { emit };
