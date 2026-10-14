// De spelvormen op het Spelen-scherm. Le Duel is de standaard.
import { entriesOf, meKey, coaster, model, compsOf } from './state.js';
import { contradictions } from './model.js';
import { openSheet, closeSheet, esc, buzz, toast } from './ui.js';
import * as sound from './sound.js';

const I = {
  duel: '<svg viewBox="0 0 48 48"><rect x="7" y="9" width="17" height="24" rx="2" transform="rotate(-10 15 21)"/><rect x="24" y="9" width="17" height="24" rx="2" transform="rotate(10 33 21)"/><path d="M18 40h12M24 36v8"/></svg>',
  rij: '<svg viewBox="0 0 48 48"><rect x="5" y="12" width="8" height="24" rx="1.5"/><rect x="15" y="12" width="8" height="24" rx="1.5"/><rect x="25" y="12" width="8" height="24" rx="1.5"/><rect x="35" y="12" width="8" height="24" rx="1.5"/><path d="M9 8v-2M19 8v-3M29 8v-4M39 8v-5"/></svg>',
  twijfel: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><path d="M18.5 19a5.5 5.5 0 1 1 8 4.9c-1.6.9-2.5 2-2.5 3.6V30"/><circle cx="24" cy="35" r="1.2" fill="currentColor"/></svg>',
  park: '<svg viewBox="0 0 48 48"><circle cx="24" cy="21" r="14"/><circle cx="24" cy="21" r="2"/><path d="M24 7v28M10 21h28M14 11l20 20M34 11 14 31M17 42l7-21 7 21"/></svg>',
  rematch: '<svg viewBox="0 0 48 48"><path d="M36 17a13 13 0 0 0-23-3M12 31a13 13 0 0 0 23 3"/><path d="M13 8v6h6M35 40v-6h-6"/></svg>',
  toernooi: '<svg viewBox="0 0 48 48"><path d="M16 8h16v9a8 8 0 0 1-16 0zM16 11H9c0 6 3 9 7 9M32 11h7c0 6-3 9-7 9M24 25v8M17 40h14M19 33h10v7H19z"/></svg>',
};

export const MODES = [
  { k: 'duel', t: 'Le Duel', s: '1 tegen 1', d: 'Twee banen. Tik de beste.', unit: 'duels' },
  { k: 'rij', t: 'La Rangée', s: 'rij van 4', d: 'Vier banen op volgorde, dan bevestigen.', unit: 'rijen' },
  { k: 'twijfel', t: 'Twijfelzone', s: 'duels', d: 'Alleen je onzekerste banen.', unit: 'duels' },
  { k: 'park', t: 'Park-avond', s: 'duels', d: 'Duels binnen één park.', unit: 'duels' },
  { k: 'rematch', t: 'Rematch', s: 'duels', d: 'Tegenstrijdigheden opnieuw.', unit: 'duels' },
  { k: 'toernooi', t: 'Toernooi', s: 'bracket', d: 'Zestien banen in een bracket, één kampioen.', unit: '' },
];
export const icon = k => I[k] || '';

const LAST = 'dispatch.mode';
export function lastMode() { const k = localStorage.getItem(LAST); return MODES.some(m => m.k === k) ? k : 'duel'; }
export function setLastMode(k) { localStorage.setItem(LAST, k); }

/** Start een spelvorm. */
export function startMode(k, go) {
  setLastMode(k);
  if (k !== 'park') sound.fanfare();
  if (k === 'duel') return go('duel');
  if (k === 'rij') return go('rangee');
  if (k === 'twijfel') return go('duel?mode=twijfel');
  if (k === 'toernooi') return go('toernooi');
  if (k === 'rematch') {
    const m = model(); const list = m ? contradictions(m, compsOf(meKey())) : [];
    if (!list.length) { toast('Geen tegenstrijdigheden gevonden. Je bent opvallend consequent.'); return; }
    return go('duel?mode=rematch');
  }
  if (k === 'park') return parkPicker(go);
}

export function parksOf(key = meKey()) {
  const counts = new Map();
  for (const e of entriesOf(key)) { const p = coaster(e.coaster_id)?.park; if (p) counts.set(p, (counts.get(p) || 0) + 1); }
  return [...counts].map(([park, n]) => ({ park, n })).sort((a, b) => b.n - a.n || a.park.localeCompare(b.park));
}

function parkPicker(go) {
  const parks = parksOf().filter(p => p.n >= 2);
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Park-avond</div><h3 class="h-title">Welk park?</h3>
    <p class="sheet-text">Je krijgt duels tussen banen van dat park.</p>
    <div class="chips" id="parks">${parks.map(p => `<button class="chip" data-p="${esc(p.park)}">${esc(p.park)} <small>${p.n}</small></button>`).join('')}</div></div>`);
  body.querySelectorAll('.chip').forEach(c => c.onclick = () => { buzz(5); closeSheet(); go('duel?mode=park&park=' + encodeURIComponent(c.dataset.p)); });
}
