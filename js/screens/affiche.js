// De affiche na elke sessie: "Dispatch présente / Une Soirée de Duels", met de molen.
import { coaster } from '../state.js';
import { backdrop } from '../stage.js';
import { dot } from '../stippen.js';
import { lastSummary } from '../session.js';
import { esc, dateNl, buzz, reduceMotion } from '../ui.js';
import * as sound from '../sound.js';

function rowsOf(s) {
  const nm = id => coaster(id)?.name || '?';
  const out = [];
  if (s.champion) out.push(['Kampioen', nm(s.champion), '']);
  if (s.riser) out.push(['Ster van de avond', nm(s.riser.id), `+${s.riser.delta}`, 'up']);
  if (s.faller) out.push(['Gevallen ster', nm(s.faller.id), `−${Math.abs(s.faller.delta)}`, 'dn']);
  if (s.hardest) out.push(['Zwaarste keuze', `${nm(s.hardest[0])} of ${nm(s.hardest[1])}`, '']);
  const parts = [];
  if (s.rows) parts.push(`${s.rows} ${s.rows === 1 ? 'rij' : 'rijen'}`);
  if (s.duels) parts.push(`${s.duels} ${s.duels === 1 ? 'duel' : 'duels'}`);
  if (!parts.length) parts.push('een korte avond');
  out.push([parts.join(' · '), `ranking ${Math.round(s.certainty * 100)}% zeker`, '']);
  return out;
}

export default {
  nav: null, title: 'De affiche',
  mount({ bg, fg, go }) {
    const s = lastSummary();
    if (!s) { go(''); return; }
    const date = new Date(s.date);
    const rows = rowsOf(s);
    const again = s.kind === 'duel' ? 'duel' + (s.mode && s.mode !== 'duel' && s.mode !== 'park' && s.mode !== 'rematch' ? '?mode=' + s.mode : '') : s.kind === 'toernooi' ? 'toernooi' : 'rangee';
    backdrop(bg, 'dim');
    fg.innerHTML = `
      <div class="aff-wrap">
        <div class="aff" id="aff"><div class="art"></div><div class="shade"></div>
          <div class="t"><div class="eyebrow">Dispatch présente</div><h1>Une Soirée<br>de Duels</h1><p>${esc(dateNl(date))}</p></div>
          <div class="rows">${rows.map(([k, v, d, cls], i) => `<div class="row" style="--i:${i}"><span>${esc(k)}</span><b>${esc(v)}${d ? `<small class="${cls}">${esc(d)}</small>` : ''}</b></div>`).join('')}</div>
          <div class="marquee"></div>${dot('affiche', 'affdot', 'span')}
        </div>
      </div>
      <div class="a-foot">
        <div class="row-btns"><button class="ghost" id="home">Klaar</button><button class="btn" id="again">Nog een ronde</button></div>
      </div>`;
    if (!reduceMotion()) setTimeout(() => sound.applause(), 500);
    buzz([10, 50, 10]);

    fg.querySelector('#again').onclick = () => go(again);
    fg.querySelector('#home').onclick = () => go('');
  },
};
