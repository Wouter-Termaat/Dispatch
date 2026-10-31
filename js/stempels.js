// De kermiskaart: twintig stempels met elk drie niveaus (brons, zilver, goud). Alleen om te verzamelen.
// De meeste waarden komen rechtstreeks uit je vergelijkingen (dus ook met terugwerkende kracht); een paar tellen per
// afgeronde ronde mee (settings.ach, bijgewerkt in recordRound). Behaalde niveaus staan met datum in settings.stamps.
import { model, compsOf, coaster, settingsOf, meKey, saveSetting } from './state.js';
import { myStats } from './insights.js';
import { icon } from './modes.js';
import { toast } from './ui.js';
import { track } from './track.js';
import * as sound from './sound.js';

export const LEVELS = ['Brons', 'Zilver', 'Goud'];
// lange namen hebben een zacht afbreekstreepje (­), zodat ze op de telefoon netjes over twee regels passen
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  ticket: svg('<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M15 6v12" stroke-dasharray="1.5 2"/>'),
  vlam: svg('<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.2 2.3-5 3.5-7.5.5 1.6 1.4 2.6 2.4 3 .2-3 1.6-5.4 3.6-7.5.4 3 3.5 5.8 3.5 10.5 0 4.3-2.8 7.5-6.5 7.5z"/>'),
  kalender: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M12 14h2M16 14h.5M8 17h2M12 17h2"/>'),
  lamp: svg('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z"/>'),
  meter: svg('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3"/>'),
  zuil: svg('<path d="M5 21h14M6 18h12M7 8h10M6 5h12l-1 3H7zM8 8v10M12 8v10M16 8v10"/>'),
  vink: svg('<path d="M4 6h10M4 12h7M4 18h6"/><path d="M14 16l2.5 2.5L21 13"/>'),
  sterren: svg('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  kompas: svg('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  kroon: svg('<path d="M3 18L4.5 7l5 5L12 4l2.5 8 5-5L21 18z"/><path d="M3.5 21h17"/>'),
  pijl: svg('<path d="M12 20V5M6 11l6-6 6 6"/><path d="M5 20h14"/>'),
  sprong: svg('<path d="M4 19c4 0 6-3 8-7s4-7 8-7"/><path d="M16 5h4v4"/>'),
  hart: svg('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  gelijk: svg('<path d="M6 9.5h12M6 14.5h12"/><circle cx="12" cy="12" r="9"/>'),
  stip: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>'),
};

const pct = v => Math.round(v * 100) + '%';
// waarde: hoe ver je bent. lower: lager is beter (underdog). fmt: hoe de drempel en de waarde er uitzien.
export const STAMPS = [
  { cat: 'Battles', id: 'battles', name: 'Stamgast', ic: IC.ticket, levels: [500, 2500, 10000], unit: 'battles', v: c => c.st.total },

  { cat: 'Volharding', id: 'reeks', name: 'Vaste klant', ic: IC.vlam, levels: [3, 7, 30], unit: 'dagen op rij gespeeld', v: c => c.st.longestStreak },
  { cat: 'Volharding', id: 'dagen', name: 'Seizoens­kaart', ic: IC.kalender, levels: [10, 50, 150], unit: 'speeldagen', v: c => c.st.days },
  { cat: 'Volharding', id: 'avond', name: 'Lange avond', ic: IC.lamp, levels: [50, 150, 400], unit: 'keuzes op één dag', v: c => c.st.busiestDay?.n || 0 },

  { cat: 'Zekerheid', id: 'zeker', name: 'Op de kaart', ic: IC.meter, levels: [.5, .75, .95], unit: 'van je ranking zeker', fmt: pct, v: c => c.m?.certainty || 0 },
  { cat: 'Zekerheid', id: 'steen', name: 'In steen', ic: IC.zuil, levels: [10, 25, 50], unit: 'banen bovenaan op rij zeker', v: c => c.topSure },
  { cat: 'Zekerheid', id: 'vergeten', name: 'Niemand vergeten', ic: IC.vink, levels: [3, 6, 10], unit: 'eigen battles voor elke baan', v: c => c.minBattles },
  { cat: 'Zekerheid', id: 'opruimer', name: 'Opruimer', ic: IC.sterren, levels: [5, 10, 20], unit: 'banen zeker gemaakt in één ronde', v: c => c.ach.opruimer || 0 },

  { cat: 'Spelvormen', id: 'rondreis', name: 'Rondreis', ic: IC.kompas, levels: [1, 10, 25], unit: 'rondes van elke spelvorm', v: c => Math.min(...ROUND_MODES.map(k => c.ach.rounds?.[k] || 0)) },
  { cat: 'Spelvormen', id: 'kampioen', name: 'Kampioens­maker', ic: icon('toernooi'), levels: [5, 20, 50], unit: 'toernooien uitgespeeld', v: c => c.ach.toernooi || 0 },
  { cat: 'Spelvormen', id: 'koning', name: 'Konings­maker', ic: IC.kroon, levels: [4, 7, 10], unit: 'duels op rij gewonnen door één koning', v: c => c.ach.koning || 0 },
  { cat: 'Spelvormen', id: 'slepen', name: 'Sleep­kampioen', ic: icon('rij'), levels: [25, 250, 1000], unit: 'rijen bij La Rangée', v: c => c.rows },
  { cat: 'Spelvormen', id: 'parken', name: 'Park­directeur', ic: icon('park'), levels: [5, 15, 30], unit: 'parken op een Park-avond', v: c => c.parks },
  { cat: 'Spelvormen', id: 'twijfel', name: 'Twijfelzone overleefd', ic: icon('twijfel'), levels: [5, 25, 100], unit: 'rondes Twijfelzone', v: c => c.ach.rounds?.twijfel || 0 },

  { cat: 'Smaak en verrassingen', id: 'underdog', name: 'Underdog', ic: IC.pijl, levels: [.15, .08, .03], lower: true, unit: 'kans of minder, en toch gewonnen', fmt: pct, v: c => c.st.upset?.p ?? 1 },
  { cat: 'Smaak en verrassingen', id: 'sprong', name: 'Grote sprong', ic: IC.sprong, levels: [10, 20, 40], unit: 'plekken gestegen in één ronde', v: c => c.ach.sprong || 0 },
  { cat: 'Smaak en verrassingen', id: 'troon', name: 'Troons­wisseling', ic: icon('rematch'), levels: [1, 3, 10], unit: 'keer een nieuwe nummer 1', v: c => c.ach.troon || 0 },
  { cat: 'Smaak en verrassingen', id: 'trouw', name: 'Trouw', ic: IC.hart, levels: [10, 25, 50], unit: 'overwinningen op rij voor één baan', v: c => c.winStreak },
  { cat: 'Smaak en verrassingen', id: 'gelijk', name: 'Gelijk­speler', ic: IC.gelijk, levels: [25, 100, 250], unit: 'keer gelijk gegeven', v: c => c.st.ties },

  { cat: 'Verborgen', id: 'stippen', name: 'Witte stippen', ic: IC.stip, levels: [3, 6, 10], unit: 'witte stippen gevonden', v: c => (c.s.dots || []).length },
];
export const ROUND_MODES = ['duel', 'rij', 'twijfel', 'park', 'rematch', 'toernooi'];
export const TOTAL_LEVELS = STAMPS.length * 3;

/** Alles wat de stempels nodig hebben, voor één profiel. */
function context(key) {
  const m = model(key), s = settingsOf(key), comps = compsOf(key), real = comps.filter(c => c.outcome !== 'skip');
  const ctx = { m, s, ach: s.ach || {}, st: myStats(key), topSure: 0, minBattles: 0, rows: 0, parks: 0, winStreak: 0 };
  if (m) {
    for (const id of m.ranking) { const i = m.idx.get(id); if ((m.battles?.get(id) || 0) >= 3 && (m.hi[i] - m.lo[i]) / 2 <= m.stableHW) ctx.topSure++; else break; }
    ctx.minBattles = m.ids.length ? Math.min(...m.ids.map(id => m.battles?.get(id) || 0)) : 0;
  }
  // rijen: een rij van vier is één keuze met zes vergelijkingen
  const perBatch = new Map(); for (const c of comps) perBatch.set(c.batch, (perBatch.get(c.batch) || 0) + 1);
  ctx.rows = [...perBatch.values()].filter(n => n === 6).length;
  const parks = new Set(); for (const c of comps) if (c.mode === 'park') for (const id of [c.a, c.b]) { const p = coaster(id)?.park; if (p) parks.add(p); }
  ctx.parks = parks.size;
  // langste reeks overwinningen van één baan (gelijk breekt de reeks niet, verlies wel)
  const run = new Map();
  for (const c of [...real].sort((x, y) => (x.created_at > y.created_at ? 1 : -1))) {
    if (c.outcome === 'tie') continue;
    const w = c.outcome === 'a' ? c.a : c.b, l = c.outcome === 'a' ? c.b : c.a;
    const n = (run.get(w) || 0) + 1; run.set(w, n); run.set(l, 0); if (n > ctx.winStreak) ctx.winStreak = n;
  }
  return ctx;
}

/** Per stempel: waarde, behaald niveau (0 tot 3), volgende drempel. */
export function stampsOf(key) {
  const c = context(key), got = settingsOf(key).stamps || {};
  return STAMPS.map(d => {
    const v = d.v(c);
    const level = d.levels.filter(t => (d.lower ? v <= t : v >= t)).length;
    return { ...d, value: v, level, dates: got[d.id] || [], next: level < 3 ? d.levels[level] : null };
  });
}
export const fmtOf = (d, x) => (d.fmt ? d.fmt(x) : x.toLocaleString('nl-NL'));

/** Nieuwe niveaus vastleggen (met datum) en vieren. De eerste keer stil: dan is het de terugwerkende kracht. */
export async function checkStamps() {
  const key = meKey(); if (!key) return [];
  const s = settingsOf(key), first = !s.stamps, got = { ...(s.stamps || {}) }, now = new Date().toISOString(), fresh = [];
  for (const st of stampsOf(key)) {
    const dates = [...(got[st.id] || [])];
    for (let l = dates.length; l < st.level; l++) { dates[l] = first ? null : now; if (!first) fresh.push([st, l]); }
    if (dates.length !== (got[st.id] || []).length) got[st.id] = dates;
  }
  const changed = first || STAMPS.some(d => (got[d.id] || []).length !== (s.stamps?.[d.id] || []).length);
  if (!changed) return [];
  await saveSetting({ stamps: got });
  if (first) { const n = Object.values(got).reduce((a, d) => a + d.length, 0); if (n) toast(`Je kermiskaart is gevuld: ${n} ${n === 1 ? 'stempel' : 'stempels'}. Kijk onder Inzichten.`, 4200); }
  for (const [st, l] of fresh) track('stamp', { id: st.id, level: l + 1 });
  if (fresh.length) {
    const [st, l] = fresh.at(-1);
    sound.fanfare(); setTimeout(() => toast(fresh.length === 1 ? `Stempel: ${st.name}, ${LEVELS[l].toLowerCase()}.` : `${fresh.length} nieuwe stempels, onder andere ${st.name} ${LEVELS[l].toLowerCase()}.`, 4200), 500);
  }
  return fresh;
}

/** Na een afgeronde ronde: de tellers die niet uit de vergelijkingen zelf te halen zijn. */
export async function recordRound(s, after, summary) {
  const key = meKey(); if (!key || !after) return;
  const a = structuredClone(settingsOf(key).ach || {}); a.rounds ||= {};
  const k = s.mode === 'rangee' ? 'rij' : s.mode === 'koning' ? 'toernooi' : s.mode;
  if (ROUND_MODES.includes(k)) a.rounds[k] = (a.rounds[k] || 0) + 1;
  if (s.kind === 'toernooi' && s.mode === 'toernooi' && s.champion) a.toernooi = (a.toernooi || 0) + 1;
  if (s.kingBest) a.koning = Math.max(a.koning || 0, s.kingBest);
  const before = Math.round((s.certaintyBefore || 0) * after.n), nowSure = Math.round((after.certainty || 0) * after.n);
  a.opruimer = Math.max(a.opruimer || 0, nowSure - before);
  if (summary?.riser?.delta) a.sprong = Math.max(a.sprong || 0, summary.riser.delta);
  const topBefore = [...s.before].find(([, p]) => p === 0)?.[0];
  if (topBefore && after.ranking[0] && after.ranking[0] !== topBefore) a.troon = (a.troon || 0) + 1;
  await saveSetting({ ach: a });
  return checkStamps();
}
