// Witte stippen: tien kleine witte stipjes, verstopt als ontwerpdetail door de app heen. Tik er een aan en je
// hebt hem gevonden. Voortgang staat in je profiel (settings.dots), dus ook op je andere apparaten.
import { mySettings, saveSetting, meKey } from './state.js';
import * as sound from './sound.js';
import { buzz, toast, esc } from './ui.js';

export const DOTS = [
  { id: 'pointblanc', naam: 'Point Blanc', hint: 'Een straatbordje met een witte naam.' },
  { id: 'logo-i', naam: 'De i van Dispatch', hint: 'Elke letter verdient zijn puntje.' },
  { id: 'molen', naam: 'Het hart van de molen', hint: 'Waar de wieken om draaien.' },
  { id: 'boog', naam: 'Het laatste lampje', hint: 'Samen is de boog net niet rond.' },
  { id: 'cijfers', naam: 'Tussen de cijfers', hint: 'Een rustig regeltje boven je lijst.' },
  { id: 'instellingen', naam: 'Bij de instellingen', hint: 'Waar je de knoppen van de zaal vindt.' },
  { id: 'bereik', naam: 'Op het balkje', hint: 'Waarschijnlijk tussen plek zoveel en zoveel.' },
  { id: 'affiche', naam: 'Een lampje op de affiche', hint: 'Na elke voorstelling, in de rand.' },
  { id: 'handtekening', naam: 'De handtekening', hint: 'Aan het eind van het verhaal achter de schermen.' },
  { id: 'kampioen', naam: 'Rond de kampioen', hint: 'Niet elke lamp rond de winnaar is goud.' },
];
export const found = () => (meKey() ? mySettings().dots || [] : []);
export const isFound = id => found().includes(id);

/** HTML voor een stip. tag='span' binnen een andere knop. */
export function dot(id, cls = '', tag = 'button') {
  const a = tag === 'button' ? 'type="button"' : 'role="button" tabindex="0"';
  return `<${tag} class="wdot ${cls}${isFound(id) ? ' got' : ''}" data-dot="${id}" ${a} aria-label="Een witte stip"></${tag}>`;
}

let overlayT = 0;
function show(n, title, sub) {
  let el = document.getElementById('dotfound');
  if (!el) { el = document.createElement('div'); el.id = 'dotfound'; el.className = 'dotfound'; document.getElementById('app').appendChild(el); }
  el.innerHTML = `<i></i><b>${esc(title)}</b><span>${esc(sub)}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(overlayT); overlayT = setTimeout(() => el.classList.remove('show'), n === DOTS.length ? 4200 : 2600);
}

export async function find(id, el) {
  if (!meKey() || !DOTS.some(d => d.id === id)) return;
  el?.classList.add('got', 'pop'); setTimeout(() => el?.classList.remove('pop'), 700);
  if (isFound(id)) { toast(`Deze witte stip had je al. ${found().length} van ${DOTS.length}.`); return; }
  const list = [...found(), id];
  sound.sparkle(); buzz([6, 30, 6, 30, 12]);
  const patch = { dots: list };
  if (list.length === DOTS.length) patch.musicUnlocked = true;
  await saveSetting(patch);
  if (list.length === DOTS.length) { show(list.length, 'Alle witte stippen!', 'Je hebt ze alle tien. Witte Stip. staat nu bij de muziek.'); sound.applause(2); }
  else show(list.length, `Witte stip ${list.length} van ${DOTS.length}`, DOTS.find(d => d.id === id).naam);
}

// één luisteraar voor de hele app (vangt de klik af voordat een eventuele ouderknop hem krijgt)
document.addEventListener('click', e => {
  const d = e.target.closest?.('[data-dot]'); if (!d) return;
  if (d.dataset.dot !== 'pointblanc') { e.stopPropagation(); e.preventDefault(); }
  find(d.dataset.dot, d);
}, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('span[data-dot]')) { e.preventDefault(); e.target.click(); } });
