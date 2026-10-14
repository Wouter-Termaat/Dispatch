// Spelen: kies je spel en start. Mockup-varianten om uit te kiezen via ?spelen=a|b|c (zonder: huidige versie).
//   a  Globe + molen als held: Samen-sfeer, molen als middelpunt, lampjesrij en lantaarns in de UI
//   b  Scène versmolten: de hele poster als achtergrond, het spel als één glazen paneel erover
//   c  Theater: toneellijst met lampjes en gordijnen, molen in de boog, spelvormen als programma
import { me, model, remaining, saveSetting, mySettings, on, coaster } from '../state.js';
import { isClosed, isHalloween, now, backdrop } from '../stage.js';
import { esc, buzz, meta } from '../ui.js';
import { openCoaster } from '../baankaart.js';
import { PLEIN, WITTE_STIP, fill } from '../copy.js';
import { buildScene } from '../scene.js';
import { MODES, icon, lastMode, startMode, setLastMode } from '../modes.js';

const MILL = ['wm-body', 'wm-roof', 'SAILS', 'wm-hub'];

function greeting(name) {
  const h = now().getHours();
  const k = h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond';
  return fill(PLEIN.groet[k], { naam: name });
}
function variant() {
  const v = new URLSearchParams(location.search).get('spelen') || new URLSearchParams(location.hash.split('?')[1] || '').get('spelen');
  if (v) { try { localStorage.setItem('dispatch.spelen', v); } catch { /* */ } }
  const s = v || (() => { try { return localStorage.getItem('dispatch.spelen'); } catch { return null; } })();
  return ['a', 'b', 'c'].includes(s) ? s : '';
}

const head = () => `<header class="sp-head"><h1 class="neon">Dispatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div><p class="sp-greet" id="greet"></p></header>`;
const cards = () => `<div class="modes" id="modes" role="radiogroup" aria-label="Spelvorm">${MODES.map(m => `
  <button class="mode-t" role="radio" data-k="${m.k}"><span class="mi">${icon(m.k)}</span><b>${m.t}</b><small>${m.s}</small></button>`).join('')}</div>`;
const extra = () => `<div class="sp-extra"><div class="eyebrow">Jouw ranking</div><div class="big"><b id="xpct"></b><span id="xsub"></span></div><ol id="xtop"></ol></div>`;
const label = () => `<div class="sp-label"><span class="eyebrow">Kies je spel</span><span class="sp-status" id="status"></span></div>`;

export default {
  nav: 'plein', title: 'Spelen',
  async mount({ bg, fg, go }) {
    const closed = isClosed(), v = variant();
    let sel = lastMode();
    const wide = innerWidth >= 900 && innerWidth / innerHeight >= 1.25;

    if (v === 'a') {
      backdrop(bg);
      fg.innerHTML = `<div class="spelen va">
        <div class="va-top">${head()}<div class="va-mill" id="mill"></div></div>
        <div class="va-marquee" aria-hidden="true"></div>
        <section class="sp-play">${label()}${cards()}<p class="mode-desc" id="desc"></p>
          <div class="va-cta"><span class="va-lamp l"><img src="assets/scene/lamp-l.webp" alt=""><i></i></span><button class="btn big" id="start"></button>
            <button class="va-lamp r" id="pb" aria-label="Point Blanc"><img src="assets/scene/lamp-r.webp" alt=""><i></i></button></div></section>
        <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow">${esc(WITTE_STIP.sub)}</div></div></div>`;
    } else if (v === 'b') {
      backdrop(bg);
      fg.innerHTML = `<div class="spelen vb"><div class="vb-scene" id="scene"></div>${head()}
        <section class="sp-play vb-panel">${extra()}${label()}${cards()}<p class="mode-desc" id="desc"></p><button class="btn big" id="start"></button></section>
        <button class="pb-hit" id="pb" aria-label="Point Blanc"></button>
        <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow">${esc(WITTE_STIP.sub)}</div></div></div>`;
    } else if (v === 'c') {
      backdrop(bg);
      fg.innerHTML = `<div class="spelen vc">
        <div class="pros" aria-hidden="true"><i class="cur l"></i><i class="cur r"></i><div class="valance"></div></div>
        <div class="vc-arch"><div class="vc-mill" id="mill"></div></div>${head()}
        <section class="vc-bill"><div class="vc-bill-head"><span class="eyebrow">Programma van vanavond</span><span class="sp-status" id="status"></span></div>
          <ol class="bill" id="modes" role="radiogroup" aria-label="Spelvorm">${MODES.map((m, i) => `<li><button class="mode-t" role="radio" data-k="${m.k}"><i>${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}</i><b>${m.t}</b><span class="dots"></span><small>${m.d}</small></button></li>`).join('')}</ol>
          <button class="ticket-btn" id="start"></button>
          <button class="vc-sign" id="pb" aria-label="Point Blanc">Point Blanc</button></section>
        <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow">${esc(WITTE_STIP.sub)}</div></div></div>`;
    } else {
      bg.innerHTML = '<div class="page-night"></div>';
      fg.innerHTML = `<div class="spelen">
        <div class="sp-scene" id="scene">${head()}<button class="pb-hit" id="pb" aria-label="Point Blanc"></button></div>
        <section class="sp-play">${extra()}${label()}${cards()}<p class="mode-desc" id="desc"></p><button class="btn big" id="start"></button></section>
        <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow">${esc(WITTE_STIP.sub)}</div></div></div>`;
    }

    // scène of molen
    let scene = null; const sceneEl = fg.querySelector('#scene'), millEl = fg.querySelector('#mill');
    if (sceneEl) scene = await buildScene(sceneEl, { closed, focus: v === 'b' ? (wide ? [0, 120, 1134, 1330] : [150, 60, 984, 1330]) : wide ? [60, 90, 1074, 1330] : [140, 40, 994, 1300] });
    if (millEl) scene = await buildScene(millEl, { only: MILL, mini: true, closed, focus: [318, 360, 816, 990] });

    const render = () => {
      const m = model(), rem = remaining(), mode = MODES.find(x => x.k === sel);
      let line = esc(greeting(me()?.name || ''));
      if (closed) line += ' ' + esc(PLEIN.gesloten);
      else if (isHalloween()) line += ' ' + esc(PLEIN.halloween);
      fg.querySelector('#greet').innerHTML = line;
      fg.querySelectorAll('.mode-t').forEach(b => { const on = b.dataset.k === sel; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      const desc = fg.querySelector('#desc'); if (desc) desc.textContent = mode.d;
      fg.querySelector('#start').innerHTML = v === 'c' ? `<small>Toegang</small>Start ${esc(mode.t)}` : `Start ${esc(mode.t)} <span aria-hidden="true">›</span>`;
      let st = '';
      if (m && rem) {
        const pct = Math.round(m.certainty * 100);
        st = rem.stable ? PLEIN.stabiel : `<span class="pct">${pct}% zeker · </span>nog ± ${sel === 'rij' ? rem.rows + ' rijen' : rem.duels + ' duels'}`;
      }
      const stEl = fg.querySelector('#status'); if (stEl) stEl.innerHTML = st;
      if (m && fg.querySelector('#xpct')) {
        fg.querySelector('#xpct').textContent = Math.round(m.certainty * 100) + '%';
        fg.querySelector('#xsub').textContent = `zeker, over ${m.n} banen`;
        fg.querySelector('#xtop').innerHTML = m.ranking.slice(0, 3).map((id, i) => { const c = coaster(id); return `<li data-id="${esc(id)}"><i>${i + 1}</i><div><b>${esc(c.name)}</b><small>${meta(c)}</small></div></li>`; }).join('');
      }
    };
    render();
    const off = on(w => { if (w === 'model' || w === 'data') render(); });

    const modes = fg.querySelector('#modes');
    modes.onclick = e => { const b = e.target.closest('.mode-t'); if (!b) return; buzz(5); sel = b.dataset.k; setLastMode(sel); render(); if (v !== 'c') b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); };
    if (v !== 'c') requestAnimationFrame(() => modes.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
    fg.querySelector('#xtop')?.addEventListener('click', e => { const li = e.target.closest('li'); if (li) openCoaster(li.dataset.id); });
    fg.querySelector('#start').onclick = () => { buzz(8); startMode(sel, go); };

    // Witte Stip: tik het straatbordje Point Blanc
    const ws = fg.querySelector('#ws'); let wsT = 0;
    const pb = fg.querySelector('#pb'); let ro = null;
    if (pb.classList.contains('pb-hit')) {
      const host = sceneEl;
      const placePb = () => {   // het bordje zit in de PSD rond (878-958, 1040-1072); ruim, want de lantaarnlaag beweegt mee met de parallax
        const w = host.querySelector('.world'); const mm = new DOMMatrix(getComputedStyle(w).transform); const r = host.getBoundingClientRect(), f = (pb.offsetParent || fg).getBoundingClientRect();
        pb.style.left = (r.left - f.left + mm.e + 870 * mm.a) + 'px'; pb.style.top = (r.top - f.top + mm.f + 1032 * mm.d) + 'px'; pb.style.width = 100 * mm.a + 'px'; pb.style.height = 48 * mm.d + 'px';
      };
      placePb(); ro = new ResizeObserver(placePb); ro.observe(host);
    }
    pb.onclick = async () => {
      buzz([6, 40, 6]); ws.classList.add('show'); clearTimeout(wsT); wsT = setTimeout(() => ws.classList.remove('show'), 3200);
      if (!mySettings().musicUnlocked) await saveSetting({ musicUnlocked: true, music: 'wittestip' });
      (await import('../music.js')).openMusic();
    };
    return () => { off(); scene?.stop(); ro?.disconnect(); clearTimeout(wsT); };
  },
};
