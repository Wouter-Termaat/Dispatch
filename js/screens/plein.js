// Spelen (variant B, door Wouter gekozen): de scène versmolten met de globe-achtergrond,
// en het spel als één glazen paneel erover. Op de laptop met je zekerheid en top 3 in het paneel.
import { me, model, remaining, on, coaster } from '../state.js';
import { isClosed, isHalloween, now, backdrop } from '../stage.js';
import { esc, buzz, meta } from '../ui.js';
import { openCoaster } from '../baankaart.js';
import { PLEIN, fill } from '../copy.js';
import { buildScene } from '../scene.js';
import { MODES, icon, lastMode, startMode, setLastMode, FOCUS, FOCUS_MODES, lastFocus, setLastFocus, focusStatus } from '../modes.js';
import { dot } from '../stippen.js';

function greeting(name) {
  const h = now().getHours();
  const k = h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond';
  return fill(PLEIN.groet[k], { naam: name });
}
const head = () => `<header class="sp-head"><h1 class="neon">D<span class="idot">ı${dot('logo-i')}</span>spatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div><p class="sp-greet" id="greet"></p></header>`;
const cards = () => `<div class="modes" id="modes" role="radiogroup" aria-label="Spelvorm">${MODES.map(m => `
  <button class="mode-t" role="radio" data-k="${m.k}" title="${m.d}"><span class="mi">${icon(m.k)}</span><b>${m.t}</b><small>${m.s}</small></button>`).join('')}</div>`;
const focusRow = () => `<div class="sp-focus" id="focus" role="radiogroup" aria-label="Welk deel van je ranking"><div class="pills wide">${FOCUS.map(f => `<button role="radio" data-f="${f.k}">${f.t}</button>`).join('')}</div></div>`;
const extra = () => `<div class="sp-extra"><div class="eyebrow">Jouw ranking</div><div class="big"><b id="xpct"></b><span id="xsub"></span></div><ol id="xtop"></ol></div>`;
const label = () => `<div class="sp-label"><span class="eyebrow">Kies je spel</span><span class="sp-status" id="status"></span></div>`;

export default {
  nav: 'plein', title: 'Spelen',
  async mount({ bg, fg, go }) {
    const closed = isClosed();
    let sel = lastMode(), focus = lastFocus();
    const wide = innerWidth >= 900 && innerWidth / innerHeight >= 1.25;
    backdrop(bg, 'plein');   // zonder de vage globe van de achtergrond: de scène heeft zijn eigen globe, twee over elkaar gaf harde lijnen in de lichtbundels
    fg.innerHTML = `<div class="spelen vb"><div class="vb-scene" id="scene"></div>${head()}
      <section class="sp-play vb-panel">${extra()}${label()}${cards()}${focusRow()}<button class="btn big" id="start"></button>
        <button class="pb-sign" id="pb" data-dot="pointblanc" aria-label="Point Blanc">Point Blanc</button></section>
</div>`;

    // witte stip precies op de plek van de punt van de i (gemeten in Limelight: 0,685em boven de basislijn)
    const placeIdot = () => {
      const sp = fg.querySelector('.idot'), d = sp?.querySelector('.wdot'); if (!d) return;
      const m = document.createElement('i'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; sp.insertBefore(m, d);
      const fs = parseFloat(getComputedStyle(sp).fontSize), base = m.getBoundingClientRect().top - sp.getBoundingClientRect().top; m.remove();
      d.style.top = (base - .685 * fs) + 'px';
    };
    document.fonts.ready.then(placeIdot); const roI = new ResizeObserver(placeIdot); roI.observe(fg.querySelector('.sp-head h1'));
    const sceneEl = fg.querySelector('#scene');
    // telefoon: de scène vult alleen de ruimte tussen titel en paneel, ingezoomd op de molen, zodat die nooit achter het paneel valt
    const frame = () => {
      const breed = matchMedia('(min-width:900px) and (min-aspect-ratio:5/4)').matches;   // opnieuw bepalen: venster kan draaien of groeien
      if (breed || innerHeight < 500) { sceneEl.style.top = sceneEl.style.bottom = ''; return; }   // liggend: de hele scène als achtergrond
      const root = fg.querySelector('.spelen'), head = fg.querySelector('.sp-head'), panel = fg.querySelector('.vb-panel');
      sceneEl.style.top = Math.max(0, head.offsetTop + head.offsetHeight - 40) + 'px';
      sceneEl.style.bottom = Math.max(0, root.clientHeight - panel.offsetTop - 40) + 'px';
    };
    frame(); addEventListener('resize', frame);
    // alleen de molen voor de globe: huisjes, hek, straat met deurlicht, lantaarns, auto's en het stel blijven weg (rustiger)
    const scene = await buildScene(sceneEl, { closed, focus: wide ? [0, 120, 1134, 1330] : [250, 340, 884, 1010], drop: ['buildings-l', 'buildings-r', 'fence', 'street', 'inside', 'lamp-l', 'lamp-r', 'cars-l', 'cars-r', 'couple'] });

    const render = () => {
      const m = model(), rem = remaining(), mode = MODES.find(x => x.k === sel);
      let line = esc(greeting(me()?.name || ''));
      if (closed) line += ' ' + esc(PLEIN.gesloten);
      else if (isHalloween()) line += ' ' + esc(PLEIN.halloween);
      fg.querySelector('#greet').innerHTML = line;
      fg.querySelectorAll('.mode-t').forEach(b => { const on = b.dataset.k === sel; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      fg.querySelector('#start').innerHTML = `Start ${esc(mode.t)} <span aria-hidden="true">›</span>`;
      // focus: alleen bij duel, rij en twijfel; de rest kiest zelf welke banen meedoen
      const fOk = FOCUS_MODES.includes(sel); const fEl = fg.querySelector('#focus');
      fEl.classList.toggle('off', !fOk); fEl.setAttribute('aria-hidden', !fOk); fEl.inert = !fOk;
      fEl.querySelectorAll('[data-f]').forEach(b => { const on = b.dataset.f === focus; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      const fst = fOk && focus !== 'alles' ? focusStatus(focus) : null;
      let st = '';
      if (fst) {
        const f = FOCUS.find(x => x.k === focus);
        st = `${esc(f.t)}: ${fst.pct}% zeker · nog ± ${sel === 'rij' ? fst.rows + ' rijen' : fst.duels + ' duels'}`;
      } else if (m && rem) {
        const pct = Math.round((m.certainty || 0) * 100);
        st = rem.stable ? PLEIN.stabiel : `<span class="pct">${pct}% zeker · </span>nog ± ${sel === 'rij' ? rem.rows + ' rijen' : rem.duels + ' duels'}`;
      }
      const stEl = fg.querySelector('#status'); if (stEl) stEl.innerHTML = st;
      if (m && fg.querySelector('#xpct')) {
        fg.querySelector('#xpct').textContent = Math.round((m.certainty || 0) * 100) + '%';
        fg.querySelector('#xsub').textContent = `zeker, over ${m.n} banen`;
        fg.querySelector('#xtop').innerHTML = m.ranking.slice(0, 3).map((id, i) => { const c = coaster(id); return `<li data-id="${esc(id)}"><i>${i + 1}</i><div><b>${esc(c.name)}</b><small>${meta(c)}</small></div></li>`; }).join('');
      }
    };
    render(); frame();
    const off = on(w => { if (w === 'model' || w === 'data') render(); });

    const modes = fg.querySelector('#modes');
    modes.onclick = e => { const b = e.target.closest('.mode-t'); if (!b) return; buzz(5); sel = b.dataset.k; setLastMode(sel); render(); };
    fg.querySelector('#xtop')?.addEventListener('click', e => { const li = e.target.closest('li'); if (li) openCoaster(li.dataset.id); });
    fg.querySelector('#focus').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; buzz(4); focus = b.dataset.f; setLastFocus(focus); render(); };
    fg.querySelector('#start').onclick = () => { buzz(8); startMode(sel, go, focus); };

    // Witte Stip: tik het straatbordje Point Blanc
    return () => { roI.disconnect(); off(); scene.stop(); removeEventListener('resize', frame); };
  },
};
