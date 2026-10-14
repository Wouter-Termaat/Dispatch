// Spelen: de scène (poster in lagen) met daaronder duidelijk de spelvorm en één startknop.
import { me, model, remaining, saveSetting, mySettings, on } from '../state.js';
import { isClosed, isHalloween, now } from '../stage.js';
import { esc, buzz } from '../ui.js';
import { PLEIN, WITTE_STIP, fill } from '../copy.js';
import { buildScene } from '../scene.js';
import { MODES, icon, lastMode, startMode, setLastMode } from '../modes.js';

function greeting(name) {
  const h = now().getHours();
  const k = h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond';
  return fill(PLEIN.groet[k], { naam: name });
}

export default {
  nav: 'plein', title: 'Spelen',
  async mount({ bg, fg, go }) {
    const closed = isClosed();
    bg.innerHTML = '<div class="page-night"></div>';
    let sel = lastMode();
    fg.innerHTML = `<div class="spelen">
      <div class="sp-scene" id="scene">
        <header class="sp-head"><h1 class="neon">Dispatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div><p class="sp-greet" id="greet"></p></header>
        <button class="pb-hit" id="pb" aria-label="Point Blanc"></button>
      </div>
      <section class="sp-play">
        <div class="sp-label"><span class="eyebrow">Kies je spel</span><span class="sp-status" id="status"></span></div>
        <div class="modes" id="modes" role="radiogroup" aria-label="Spelvorm">${MODES.map(m => `
          <button class="mode-t" role="radio" data-k="${m.k}"><span class="mi">${icon(m.k)}</span><b>${m.t}</b><small>${m.s}</small></button>`).join('')}</div>
        <p class="mode-desc" id="desc"></p>
        <button class="btn big" id="start"></button>
      </section>
      <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow">${esc(WITTE_STIP.sub)}</div></div>
    </div>`;
    const sceneEl = fg.querySelector('#scene');
    const scene = await buildScene(sceneEl, { closed, focus: innerWidth >= 900 && innerWidth / innerHeight >= 1.25 ? [60, 90, 1074, 1330] : [140, 40, 994, 1300] });

    const render = () => {
      const m = model(), rem = remaining(), mode = MODES.find(x => x.k === sel);
      let line = esc(greeting(me()?.name || ''));
      if (closed) line += ' ' + esc(PLEIN.gesloten);
      else if (isHalloween()) line += ' ' + esc(PLEIN.halloween);
      fg.querySelector('#greet').innerHTML = line;
      fg.querySelectorAll('.mode-t').forEach(b => { const on = b.dataset.k === sel; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      fg.querySelector('#desc').textContent = mode.d;
      fg.querySelector('#start').innerHTML = `Start ${esc(mode.t)} <span aria-hidden="true">›</span>`;
      let st = '';
      if (m && rem) {
        const pct = Math.round(m.certainty * 100);
        st = rem.stable ? PLEIN.stabiel : `${pct}% zeker · nog ± ${sel === 'rij' ? rem.rows + ' rijen' : rem.duels + ' duels'}`;
      }
      fg.querySelector('#status').textContent = st;
    };
    render();
    const off = on(w => { if (w === 'model' || w === 'data') render(); });

    const modes = fg.querySelector('#modes');
    modes.onclick = e => { const b = e.target.closest('.mode-t'); if (!b) return; buzz(5); sel = b.dataset.k; setLastMode(sel); render(); b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); };
    requestAnimationFrame(() => modes.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
    fg.querySelector('#start').onclick = () => { buzz(8); startMode(sel, go); };

    // Witte Stip: tik het straatbordje Point Blanc
    const ws = fg.querySelector('#ws'); let wsT = 0;
    const pb = fg.querySelector('#pb');
    const placePb = () => {   // het bordje zit in de PSD rond (878-958, 1040-1072); ruim, want de lantaarnlaag beweegt mee met de parallax
      const w = sceneEl.querySelector('.world'); const m = new DOMMatrix(getComputedStyle(w).transform);
      pb.style.left = (m.e + 870 * m.a) + 'px'; pb.style.top = (m.f + 1032 * m.d) + 'px'; pb.style.width = 100 * m.a + 'px'; pb.style.height = 48 * m.d + 'px';
    };
    placePb(); const ro = new ResizeObserver(placePb); ro.observe(sceneEl);
    pb.onclick = async () => {
      buzz([6, 40, 6]); ws.classList.add('show'); clearTimeout(wsT); wsT = setTimeout(() => ws.classList.remove('show'), 3200);
      if (!mySettings().musicUnlocked) await saveSetting({ musicUnlocked: true, music: 'wittestip' });
      (await import('../music.js')).openMusic();
    };
    return () => { off(); scene.stop(); ro.disconnect(); clearTimeout(wsT); };
  },
};
