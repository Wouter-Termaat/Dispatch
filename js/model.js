// Dispatch ranking model
// Bradley-Terry (logistic) model, MAP-estimated with a Gaussian prior per coaster that comes
// from the person's starting rank (their Excel order, or a guessed spot for a new coaster).
// Pure functions, no DOM, no network. Used by the UI and by tools/simulate.mjs.

/** Tunables. Changing ANCHOR_DUELS etc. never requires re-ranking: everything is recomputed from history. */
export const DEFAULTS = {
  anchorDuels: 3,          // how many "virtual duels" the starting rank is worth (user setting)
  newCoasterAnchor: 1,     // weaker anchor for a coaster placed by guess
  rerideWeight: 0.5,       // weight of duels from before a "herreden" mark
  spreadPerItem: 0.056,    // prior scale: SD of the latent scores = spreadPerItem * N (logit units)
  stableHalfWidth: null,   // a coaster counts as "zeker" when its 80% rank range is within +/- this (null = max(3, 3.5% of list))
  windowRanks: 12,         // opponents are searched within +/- this many places
  samples: 300,            // Monte Carlo draws for rank ranges
};

// ---------- small numeric helpers ----------
const sig = x => 1 / (1 + Math.exp(-x));

// Acklam's inverse normal CDF approximation (|err| < 1.2e-9)
export function probit(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Seeded RNG so selections are reproducible in tests (pass Math.random in the app if preferred)
export function mulberry32(seed) {
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gauss(rand) { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// In-place Cholesky of symmetric positive definite matrix (Float64Array rows), returns L in lower triangle
function cholesky(A, n) {
  for (let j = 0; j < n; j++) {
    let s = A[j * n + j];
    for (let k = 0; k < j; k++) s -= A[j * n + k] * A[j * n + k];
    const d = Math.sqrt(Math.max(s, 1e-12)); A[j * n + j] = d;
    for (let i = j + 1; i < n; i++) {
      let t = A[i * n + j];
      for (let k = 0; k < j; k++) t -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = t / d;
    }
  }
  return A;
}
function cholSolve(L, n, b) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
  return x;
}
// diag of inverse from Cholesky factor: diag(A^-1)_i = sum_k (L^-1)_{k,i}^2
function cholInvDiag(L, n) {
  const out = new Float64Array(n);
  const col = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    col.fill(0); col[i] = 1 / L[i * n + i];
    for (let r = i + 1; r < n; r++) { let s = 0; for (let k = i; k < r; k++) s -= L[r * n + k] * col[k]; col[r] = s / L[r * n + r]; }
    for (let r = i; r < n; r++) out[i] += col[r] * col[r];
  }
  return out;
}

// ---------- the model ----------
/**
 * @param {object} p
 * @param {Array<{coaster_id:string, initial_rank:number, prior_strength?:number, reridden_at?:string|null}>} p.entries  the person's list
 * @param {Array<{a:string,b:string,outcome:'a'|'b'|'tie'|'skip',created_at?:string}>} p.comparisons  the person's history
 * @param {object} [p.settings]  { anchorDuels }
 * @param {object} [p.warm]  previous model, used as Newton warm start
 */
export function fitModel({ entries, comparisons = [], settings = {}, warm = null }) {
  const cfg = { ...DEFAULTS, ...settings };
  const sorted = [...entries].sort((x, y) => x.initial_rank - y.initial_rank);
  const ids = sorted.map(e => e.coaster_id);
  const n = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const SD = Math.max(3, cfg.spreadPerItem * n);
  const mu0 = new Float64Array(n), prec0 = new Float64Array(n);
  sorted.forEach((e, i) => {
    mu0[i] = SD * probit(1 - (i + 0.5) / n);
    prec0[i] = 0.25 * cfg.anchorDuels * (e.prior_strength ?? 1);
  });
  const reride = sorted.map(e => (e.reridden_at ? Date.parse(e.reridden_at) : 0));

  // flatten comparisons into weighted wins: (w, l, weight)
  const W = [], L = [], Wt = [];
  for (const c of comparisons) {
    if (c.outcome === 'skip') continue;
    const ia = idx.get(c.a), ib = idx.get(c.b);
    if (ia === undefined || ib === undefined || ia === ib) continue;
    const t = c.created_at ? Date.parse(c.created_at) : Infinity;
    let w = 1;
    if (t < reride[ia] || t < reride[ib]) w *= cfg.rerideWeight;
    if (c.outcome === 'tie') { W.push(ia, ib); L.push(ib, ia); Wt.push(w / 2, w / 2); }
    else if (c.outcome === 'a') { W.push(ia); L.push(ib); Wt.push(w); }
    else { W.push(ib); L.push(ia); Wt.push(w); }
  }

  let theta = new Float64Array(n);
  if (warm && warm.ids) { const wi = new Map(warm.ids.map((id, i) => [id, i])); for (let i = 0; i < n; i++) { const k = wi.get(ids[i]); theta[i] = k === undefined ? mu0[i] : warm.theta[k]; } }
  else theta.set(mu0);

  let Lc = null;
  for (let it = 0; it < 8; it++) {
    const g = new Float64Array(n), H = new Float64Array(n * n);
    for (let i = 0; i < n; i++) { g[i] = -prec0[i] * (theta[i] - mu0[i]); H[i * n + i] = prec0[i]; }
    for (let k = 0; k < W.length; k++) {
      const a = W[k], b = L[k], w = Wt[k];
      const p = sig(theta[a] - theta[b]), q = w * p * (1 - p), r = w * (1 - p);
      g[a] += r; g[b] -= r;
      H[a * n + a] += q; H[b * n + b] += q; H[a * n + b] -= q; H[b * n + a] -= q;
    }
    Lc = cholesky(H, n);
    const step = cholSolve(Lc, n, g);
    let mx = 0; for (let i = 0; i < n; i++) { theta[i] += step[i]; mx = Math.max(mx, Math.abs(step[i])); }
    if (mx < 1e-6) break;
  }
  const variance = cholInvDiag(Lc, n);

  const order = ids.map((_, i) => i).sort((x, y) => theta[y] - theta[x]);
  const position = new Int32Array(n); order.forEach((i, p) => (position[i] = p));
  const model = { ids, idx, theta, variance, mu0, prec0, order, position, n, SD, cfg, comparisonsUsed: W.length };
  model.ranking = order.map(i => ids[i]);
  computeRanges(model);
  return model;
}

/** 80% rank ranges via Monte Carlo (independent normals). Fills model.lo/hi (0-based positions) and certainty. */
export function computeRanges(model, rand = mulberry32(7)) {
  const { n, theta, variance, cfg } = model;
  const S = cfg.samples;
  const stableHW = cfg.stableHalfWidth ?? Math.max(3, Math.round(n * 0.035));
  model.stableHW = stableHW;
  const ranks = Array.from({ length: n }, () => new Int16Array(S));
  const draw = new Float64Array(n), ord = new Array(n);
  const sd = Array.from(variance, v => Math.sqrt(v));
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < n; i++) { draw[i] = theta[i] + sd[i] * gauss(rand); ord[i] = i; }
    ord.sort((x, y) => draw[y] - draw[x]);
    for (let p = 0; p < n; p++) ranks[ord[p]][s] = p;
  }
  model.lo = new Int16Array(n); model.hi = new Int16Array(n);
  let stable = 0, hwSum = 0;
  for (let i = 0; i < n; i++) {
    const r = Array.from(ranks[i]).sort((x, y) => x - y);
    model.lo[i] = r[Math.floor(S * 0.1)]; model.hi[i] = r[Math.floor(S * 0.9)];
    const hw = (model.hi[i] - model.lo[i]) / 2; hwSum += hw;
    if (hw <= stableHW) stable++;
  }
  model.certainty = stable / n;                 // share of coasters that are "zeker"
  model.meanHalfWidth = hwSum / n;
  model.unstable = n - stable;
  return model;
}

/** Info for one coaster, for the "baankaart". Positions are 1-based for display. */
export function coasterInfo(model, id, comparisons = []) {
  const i = model.idx.get(id); if (i === undefined) return null;
  const wins = [], losses = [], ties = [];
  for (const c of comparisons) {
    if (c.outcome === 'skip' || (c.a !== id && c.b !== id)) continue;
    const other = c.a === id ? c.b : c.a;
    if (c.outcome === 'tie') ties.push(other);
    else if ((c.outcome === 'a') === (c.a === id)) wins.push(other); else losses.push(other);
  }
  const hw = (model.hi[i] - model.lo[i]) / 2;
  return { rank: model.position[i] + 1, lo: model.lo[i] + 1, hi: model.hi[i] + 1, halfWidth: hw, stars: hw <= 0.5 ? 5 : hw <= 1.5 ? 4 : hw <= 3 ? 3 : hw <= 6 ? 2 : 1,
    wins, losses, ties, duels: wins.length + losses.length + ties.length };
}

/** Rough estimate of actions still needed until "stabiel". */
export function remainingEstimate(model, rowSize = 4) {
  const excess = Array.from({ length: model.n }, (_, i) => Math.max(0, (model.hi[i] - model.lo[i]) / 2 - model.stableHW)).reduce((a, b) => a + b, 0);
  const duels = Math.ceil(excess / 2.2);
  return { duels, rows: Math.ceil(duels / (rowSize === 4 ? 3 : 1)), stable: model.meanHalfWidth <= model.stableHW };
}

// ---------- selection ----------
function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
function historyIndex(comparisons) {
  const count = new Map(), recent = new Set();
  comparisons.forEach((c, k) => { const key = pairKey(c.a, c.b); count.set(key, (count.get(key) || 0) + 1); if (k >= comparisons.length - 40) recent.add(key); });
  return { count, recent };
}
function pickWeighted(items, weights, rand) {
  let s = 0; for (const w of weights) s += w; let r = rand() * s;
  for (let k = 0; k < items.length; k++) { r -= weights[k]; if (r <= 0) return items[k]; }
  return items[items.length - 1];
}

/**
 * Choose the next duel.
 * @param {object} opts { filter?: (id)=>boolean, mode?: 'normal'|'twijfel', rand? }
 * @returns {[string,string]|null}
 */
export function nextDuel(model, comparisons = [], opts = {}) {
  const rand = opts.rand || Math.random;
  const { ids, order, position, theta, variance, cfg } = model;
  const allowed = opts.filter ? ids.map((id, i) => (opts.filter(id) ? i : -1)).filter(i => i >= 0) : ids.map((_, i) => i);
  if (allowed.length < 2) return null;
  const hist = historyIndex(comparisons);
  let pool = allowed;
  if (opts.mode === 'twijfel') { pool = [...allowed].sort((x, y) => variance[y] - variance[x]).slice(0, Math.max(2, Math.ceil(allowed.length / 4))); }
  const allowedSet = new Set(allowed);
  for (let attempt = 0; attempt < 6; attempt++) {
    const i = pickWeighted(pool, pool.map(k => Math.pow(variance[k], 1.5)), rand);
    // opponents: nearby in the (filtered) ranking
    const ranked = opts.filter ? order.filter(k => allowedSet.has(k)) : order;
    const pi = ranked.indexOf(i);
    const lo = Math.max(0, pi - cfg.windowRanks), hi = Math.min(ranked.length - 1, pi + cfg.windowRanks);
    const cands = [], scores = [];
    for (let p = lo; p <= hi; p++) {
      const j = ranked[p]; if (j === i) continue;
      const key = pairKey(ids[i], ids[j]);
      if (hist.recent.has(key)) continue;
      const pr = sig(theta[i] - theta[j]);
      const novelty = 1 / (1 + 2 * (hist.count.get(key) || 0));
      cands.push(j); scores.push(pr * (1 - pr) * (variance[i] + variance[j]) * novelty);
    }
    if (!cands.length) continue;
    // softmax-ish over the best few to keep variety
    const top = cands.map((j, k) => [j, scores[k]]).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const j = pickWeighted(top.map(t => t[0]), top.map(t => t[1]), rand);
    return rand() < 0.5 ? [ids[i], ids[j]] : [ids[j], ids[i]];
  }
  // fallback: any two allowed
  const a = allowed[Math.floor(rand() * allowed.length)]; let b = a;
  while (b === a) b = allowed[Math.floor(rand() * allowed.length)];
  return [ids[a], ids[b]];
}

/** Choose k coasters for La Rangée (default 4). Returned in random display order. */
export function nextRow(model, comparisons = [], opts = {}) {
  const k = opts.size || 4, rand = opts.rand || Math.random;
  const { ids, order, variance, theta, cfg } = model;
  const allowedSet = opts.filter ? new Set(ids.map((id, i) => (opts.filter(id) ? i : -1)).filter(i => i >= 0)) : null;
  const ranked = allowedSet ? order.filter(i => allowedSet.has(i)) : order;
  if (ranked.length < k) return null;
  const hist = historyIndex(comparisons);
  let pool = ranked;
  if (opts.mode === 'twijfel') pool = [...ranked].sort((x, y) => variance[y] - variance[x]).slice(0, Math.max(k, Math.ceil(ranked.length / 4)));
  const i = pickWeighted(pool, pool.map(x => Math.pow(variance[x], 1.5)), rand);
  const pi = ranked.indexOf(i);
  const w = Math.max(cfg.windowRanks, k * 2);
  const lo = Math.max(0, pi - w), hi = Math.min(ranked.length - 1, pi + w);
  const chosen = [i];
  while (chosen.length < k) {
    let best = null, bestS = -1;
    for (let p = lo; p <= hi; p++) {
      const j = ranked[p]; if (chosen.includes(j)) continue;
      let s = variance[j];
      for (const c of chosen) {
        const pr = sig(theta[c] - theta[j]); const key = pairKey(ids[c], ids[j]);
        s *= 0.35 + pr * (1 - pr) * 2.6;                      // prefer informative (close) pairs
        if (hist.recent.has(key)) s *= 0.3;
      }
      s *= 0.75 + 0.5 * rand();
      if (s > bestS) { bestS = s; best = j; }
    }
    if (best === null) break;
    chosen.push(best);
  }
  for (let a = chosen.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [chosen[a], chosen[b]] = [chosen[b], chosen[a]]; }
  return chosen.map(x => ids[x]);
}

/** Turn an ordered row (best first) into pairwise comparisons. */
export function rowToComparisons(orderedIds) {
  const out = [];
  for (let x = 0; x < orderedIds.length; x++) for (let y = x + 1; y < orderedIds.length; y++) out.push({ a: orderedIds[x], b: orderedIds[y], outcome: 'a' });
  return out;
}

/** "Klopt dit?": a window of `size` consecutive coasters around an uncertain spot, best first. */
export function checkWindow(model, size = 5, rand = Math.random) {
  const { order, variance, ids } = model;
  const pos = pickWeighted(order.map((_, p) => p), order.map(i => variance[i]), rand);
  const start = Math.max(0, Math.min(order.length - size, pos - Math.floor(size / 2)));
  return order.slice(start, start + size).map(i => ids[i]);
}

/** Contradictions for "Rematch": recorded results the model now finds unlikely, plus 3-cycles. */
export function contradictions(model, comparisons = [], limit = 20) {
  const { idx, theta } = model;
  // majority per pair
  const tally = new Map();
  for (const c of comparisons) {
    if (c.outcome === 'skip' || c.outcome === 'tie') continue;
    const win = c.outcome === 'a' ? c.a : c.b, lose = c.outcome === 'a' ? c.b : c.a;
    const key = pairKey(win, lose); const t = tally.get(key) || { [win]: 0, [lose]: 0 };
    t[win] = (t[win] || 0) + 1; tally.set(key, t);
  }
  const beats = new Map(); // winner -> Set(loser)
  for (const [key, t] of tally) {
    const [x, y] = key.split('|'); if ((t[x] || 0) === (t[y] || 0)) continue;
    const w = (t[x] || 0) > (t[y] || 0) ? x : y, l = w === x ? y : x;
    if (!beats.has(w)) beats.set(w, new Set()); beats.get(w).add(l);
  }
  const out = [];
  for (const [w, ls] of beats) for (const l of ls) {
    if (!idx.has(w) || !idx.has(l)) continue;
    const p = sig(theta[idx.get(w)] - theta[idx.get(l)]);
    if (p < 0.3) out.push({ type: 'upset', pair: [w, l], p });
  }
  // 3-cycles a>b>c>a
  const seen = new Set();
  for (const [a, bs] of beats) for (const b of bs) { const cs = beats.get(b); if (!cs) continue; for (const c of cs) { if (beats.get(c)?.has(a)) { const key = [a, b, c].sort().join('|'); if (!seen.has(key)) { seen.add(key); out.push({ type: 'cycle', cycle: [a, b, c] }); } } } }
  out.sort((x, y) => (x.type === 'cycle' ? -1 : x.p) - (y.type === 'cycle' ? -1 : y.p));
  return out.slice(0, limit);
}

/** Binary-search placement for a newly added coaster. */
export class Placement {
  constructor(model, newId) { this.ranking = model.ranking.filter(id => id !== newId); this.newId = newId; this.lo = 0; this.hi = this.ranking.length; this.steps = 0; this.results = []; }
  get done() { return this.hi - this.lo <= 0 || this.steps >= 9; }
  next() { if (this.done) return null; this.mid = Math.floor((this.lo + this.hi) / 2); return this.ranking[this.mid]; }
  /** @param {'new'|'old'|'tie'} winner */
  answer(winner) {
    const opp = this.ranking[this.mid]; this.steps++;
    this.results.push({ a: this.newId, b: opp, outcome: winner === 'new' ? 'a' : winner === 'old' ? 'b' : 'tie' });
    if (winner === 'new') this.hi = this.mid; else if (winner === 'old') this.lo = this.mid + 1; else { this.lo = this.hi = this.mid; }
  }
  /** 1-based starting rank to store as initial_rank (fractional so it slots between neighbours) */
  get initialRank() { return this.lo + 0.5; }
}

// ---------- statistics ----------
function zScores(model) {
  const { theta, n } = model; let m = 0; for (const t of theta) m += t; m /= n;
  let v = 0; for (const t of theta) v += (t - m) ** 2; const s = Math.sqrt(v / n) || 1;
  return Array.from(theta, t => (t - m) / s);
}

/** Group stats for parks or manufacturers. key: 'park' | 'manufacturer'. Bayesian average so a 1-coaster park can't top the list. */
export function groupStats(model, catalog, key = 'park', prior = 2) {
  const z = zScores(model); const groups = new Map();
  model.ids.forEach((id, i) => {
    const c = catalog.get(id); if (!c) return; const g = (c[key] || '?').trim();
    if (!groups.has(g)) groups.set(g, { name: g, count: 0, operational: 0, sum: 0, best: null, bestPos: Infinity });
    const s = groups.get(g); s.count++; if (c.operational) s.operational++; s.sum += z[i];
    if (model.position[i] < s.bestPos) { s.bestPos = model.position[i]; s.best = id; }
  });
  return [...groups.values()].map(s => ({ ...s, mean: s.sum / s.count, score: s.sum / (s.count + prior) * (1 + Math.log1p(s.count) / 4) }))
    .sort((a, b) => b.score - a.score);
}

function spearman(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const rank = arr => { const o = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(n); o.forEach(([, i], k) => (r[i] = k)); return r; };
  const rx = rank(xs), ry = rank(ys); let d = 0; for (let i = 0; i < n; i++) d += (rx[i] - ry[i]) ** 2;
  return 1 - 6 * d / (n * (n * n - 1));
}

/** Compare two people. Returns match %, disagreements, joint ranking, bucket lists, per-manufacturer match. */
export function compare(modelA, modelB, catalog) {
  const shared = modelA.ids.filter(id => modelB.idx.has(id));
  const posA = id => modelA.position[modelA.idx.get(id)], posB = id => modelB.position[modelB.idx.get(id)];
  const rho = spearman(shared.map(posA), shared.map(posB));
  const zA = zScores(modelA), zB = zScores(modelB);
  const prA = id => posA(id) / (modelA.n - 1), prB = id => posB(id) / (modelB.n - 1);
  const disagreements = shared.map(id => ({ id, rankA: posA(id) + 1, rankB: posB(id) + 1, gap: prB(id) - prA(id) }))
    .sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
  const joint = shared.map(id => ({ id, z: (zA[modelA.idx.get(id)] + zB[modelB.idx.get(id)]) / 2 })).sort((x, y) => y.z - x.z).map(x => x.id);
  const bucketA = modelB.ranking.slice(0, 30).filter(id => !modelA.idx.has(id));
  const bucketB = modelA.ranking.slice(0, 30).filter(id => !modelB.idx.has(id));
  const byMan = new Map();
  for (const id of shared) { const m = catalog.get(id)?.manufacturer || '?'; if (!byMan.has(m)) byMan.set(m, []); byMan.get(m).push(id); }
  const perManufacturer = [...byMan].filter(([, l]) => l.length >= 4).map(([m, l]) => ({ manufacturer: m, count: l.length, match: Math.round(50 * (1 + spearman(l.map(posA), l.map(posB)))) }))
    .sort((a, b) => b.match - a.match);
  return { shared, match: rho === null ? null : Math.round(50 * (1 + rho)), rho, disagreements, joint, bucketA, bucketB, perManufacturer,
    bothTop: shared.filter(id => posA(id) === 0 && posB(id) === 0) };
}

/** Session summary: compare positions before/after. before: Map(id -> 0-based position) */
export function sessionSummary(before, after, actions) {
  const moves = after.ranking.map((id, p) => ({ id, from: before.has(id) ? before.get(id) : null, to: p })).filter(m => m.from !== null).map(m => ({ ...m, delta: m.from - m.to }));
  moves.sort((x, y) => y.delta - x.delta);
  return { riser: moves[0]?.delta > 0 ? moves[0] : null, faller: moves[moves.length - 1]?.delta < 0 ? moves[moves.length - 1] : null, moves, ...actions };
}
