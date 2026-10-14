// Keuzeblad "andere voorstelling": de modi.
import { entriesOf, meKey, coaster, model, compsOf } from './state.js';
import { contradictions } from './model.js';
import { openSheet, closeSheet, esc, buzz, toast } from './ui.js';

const MODES = [
  { k: 'rangee', t: 'La Rangée', d: 'Snel en standaard. Vier banen, zet ze op volgorde.' },
  { k: 'duel', t: 'Le Duel', d: 'Twee banen, één winnaar.' },
  { k: 'twijfel', t: 'Twijfelzone', d: 'Alleen je onzekerste banen.' },
  { k: 'park', t: 'Park-avond', d: 'Eén park, of twee parken tegen elkaar.' },
  { k: 'rematch', t: 'Rematch', d: 'Tegenstrijdigheden opnieuw voorgelegd.' },
  { k: 'toernooi', t: 'Toernooi', d: 'Acht banen, één kampioen.' },
];

export function openModes(go) {
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Andere voorstelling</div><h3 class="h-title">Wat spelen we vanavond?</h3>
    <div class="mode-list">${MODES.map(m => `<button class="mode" data-k="${m.k}"><b>${m.t}</b><span>${m.d}</span><em>›</em></button>`).join('')}</div></div>`);
  body.querySelectorAll('.mode').forEach(b => b.onclick = () => {
    buzz(5);
    const k = b.dataset.k;
    if (k === 'rangee') { closeSheet(); go('rangee'); }
    else if (k === 'duel') { closeSheet(); go('duel'); }
    else if (k === 'twijfel') twijfel(go);
    else if (k === 'park') parkPicker(go);
    else if (k === 'rematch') {
      const m = model(); const list = m ? contradictions(m, compsOf(meKey())) : [];
      if (!list.length) { toast('Geen tegenstrijdigheden gevonden. Je bent opvallend consequent.'); return; }
      closeSheet(); go('duel?mode=rematch');
    }
    else if (k === 'toernooi') { closeSheet(); go('toernooi'); }
  });
}

function twijfel(go) {
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Twijfelzone</div><h3 class="h-title">Alleen de twijfelgevallen</h3>
    <p class="sheet-text">De banen waarvan de plek het minst zeker is. Hoe wil je ze voorgelegd krijgen?</p>
    <div class="row-btns"><button class="ghost" data-k="duel">In duels</button><button class="btn" data-k="rangee">In rijen</button></div></div>`);
  body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { closeSheet(); go(`${b.dataset.k}?mode=twijfel`); });
}

export function parksOf(key = meKey()) {
  const counts = new Map();
  for (const e of entriesOf(key)) { const p = coaster(e.coaster_id)?.park; if (p) counts.set(p, (counts.get(p) || 0) + 1); }
  return [...counts].map(([park, n]) => ({ park, n })).sort((a, b) => b.n - a.n || a.park.localeCompare(b.park));
}

function parkPicker(go) {
  const parks = parksOf().filter(p => p.n >= 2);
  const chosen = [];
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Park-avond</div><h3 class="h-title">Kies een park</h3>
    <p class="sheet-text">Of kies er twee: dan gaan hun banen tegen elkaar.</p>
    <div class="chips" id="parks">${parks.map(p => `<button class="chip" data-p="${esc(p.park)}">${esc(p.park)} <small>${p.n}</small></button>`).join('')}</div>
    <div class="row-btns sticky"><button class="btn" id="go" disabled>Kies een park</button></div></div>`);
  const btn = body.querySelector('#go');
  const update = () => {
    body.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', chosen.includes(c.dataset.p)));
    const n = chosen.reduce((s, p) => s + (parks.find(x => x.park === p)?.n || 0), 0);
    btn.disabled = !chosen.length;
    btn.textContent = !chosen.length ? 'Kies een park' : chosen.length === 2 ? `${chosen[0]} tegen ${chosen[1]}` : n >= 4 ? 'Begin in rijen' : 'Begin met duels';
  };
  body.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const p = c.dataset.p; const i = chosen.indexOf(p);
    if (i >= 0) chosen.splice(i, 1); else { chosen.push(p); if (chosen.length > 2) chosen.shift(); }
    buzz(4); update();
  });
  btn.onclick = () => {
    const n = chosen.reduce((s, p) => s + (parks.find(x => x.park === p)?.n || 0), 0);
    const q = 'mode=park&' + chosen.map(p => 'park=' + encodeURIComponent(p)).join('&');
    closeSheet(); go(`${chosen.length === 1 && n >= 4 ? 'rangee' : 'duel'}?${q}`);
  };
}
