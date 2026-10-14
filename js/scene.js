// De scène: Wouters poster opgeknipt in lagen (uit de PSD), opnieuw opgebouwd met diepte.
// Parallax op muis (laptop) of kantelen (telefoon), draaiende wieken, lampjes die golven, en een opbouw bij binnenkomst.
// Coördinaten zijn die van de PSD (1134 × 1417); assets/scene/scene.json bevat per laag [x, y, breedte, hoogte].
import { reduceMotion } from './ui.js';
import { dot } from './stippen.js';

const HUB = [566, 612];   // naaf van de molen
// van achter naar voor: [naam, diepte]
const LAYERS = [
  ['buildings-l', .42], ['buildings-r', .42],
  ['wm-body', .55], ['wm-roof', .55], ['SAILS', .55], ['wm-hub', .55],
  ['inside', .5], ['fence', .68], ['moulin', .7], ['bulbs-front', .7], ['couple', .78],
  ['street', .85], ['lamp-l', 1], ['lamp-r', 1], ['cars-l', 1.18], ['cars-r', 1.18],
];
let META = null;
export async function sceneMeta() { if (!META) META = await (await fetch('assets/scene/scene.json')).json(); return META; }

/**
 * Bouwt de scène in `host`. focus = [x0, y0, x1, y1] in PSD-coördinaten: dat deel moet in beeld zijn.
 * opts: { mini: true } voor een kleine versie (inlogscherm), { closed: true } als het park dicht is.
 */
export async function buildScene(host, { focus = [150, 330, 984, 1330], mini = false, closed = false, only = null } = {}) {
  const M = await sceneMeta();
  host.classList.add('scene'); if (mini) host.classList.add('mini'); if (closed) host.classList.add('closed');
  const world = document.createElement('div'); world.className = 'world';
  const pos = ([x, y, w, h]) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  let html = '';
  // achtergrond: zonnestralen, lichtbundels, sterren (eigen elementen in de stijl van de poster)
  html += `<div class="lyr d0" data-d=".12"><img class="sunburst" src="assets/scene/sunburst.webp" style="${pos(M.sunburst)}" alt=""><div class="rays" style="left:${HUB[0]}px;top:${HUB[1]}px"></div></div>`;
  if (!only) html += `<div class="lyr" data-d=".2"><div class="beam b1"></div><div class="beam b2"></div></div>`;
  for (const [name, d] of LAYERS) {
    if (only && !only.includes(name)) continue;
    if (name === 'SAILS') {
      const s = M['wm-sails'], b = M['bulbs-sails'];
      html += `<div class="lyr" data-d="${d}"><div class="sails" style="transform-origin:${HUB[0]}px ${HUB[1]}px">
        <img src="assets/scene/wm-sails.webp" style="${pos(s)}" alt=""><img src="assets/scene/bulbs-sails.webp" style="${pos(b)}" alt="">
        <img class="glow wave-r" src="assets/scene/bulbs-sails.webp" style="${pos(b)};--hx:${HUB[0] - b[0]}px;--hy:${HUB[1] - b[1]}px" alt=""></div></div>`;
      continue;
    }
    if (!M[name]) continue;
    let extra = name === 'wm-hub' ? dot('molen', 'hub') .replace('class="wdot', `style="left:${HUB[0]}px;top:${HUB[1]}px" class="wdot`) : '';
    if (name === 'bulbs-front') extra = `<img class="glow wave-x" src="assets/scene/bulbs-front.webp" style="${pos(M[name])}" alt="">`;
    if (name === 'inside') extra = `<div class="doorlight" style="left:${M.inside[0] + M.inside[2] * .5}px;top:${M.inside[1] + M.inside[3] * .55}px"></div>`;
    if (name === 'lamp-l' || name === 'lamp-r') { const L = M[name]; extra = `<i class="halo" style="left:${L[0] + L[2] * (name === 'lamp-l' ? .5 : .5)}px;top:${L[1] + 22}px"></i>`; }
    html += `<div class="lyr" data-d="${d}"><img class="${name}" src="assets/scene/${name}.webp" style="${pos(M[name])}" alt="" decoding="async">${extra}</div>`;
  }
  // sterren in de lucht
  let stars = ''; const rnd = mulberry(7);
  for (let i = 0; i < (mini ? 14 : 34); i++) { const x = rnd() * 1134, y = 120 + rnd() * 520, s = 6 + rnd() * 14; stars += `<i style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;animation-delay:${(rnd() * 5).toFixed(2)}s;animation-duration:${(3.5 + rnd() * 3).toFixed(2)}s"></i>`; }
  html = `<div class="lyr stars" data-d=".08">${stars}</div>` + html;
  world.innerHTML = html;
  host.appendChild(world);

  // schalen zodat de focus het vak vult
  const fit = () => {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return;
    const fw = focus[2] - focus[0], fh = focus[3] - focus[1];
    const k = Math.max(W / fw, H / fh);
    const cx = (focus[0] + focus[2]) / 2, cy = (focus[1] + focus[3]) / 2;
    world.style.transform = `translate(${W / 2 - cx * k}px, ${H / 2 - cy * k}px) scale(${k})`;
  };
  fit(); const ro = new ResizeObserver(fit); ro.observe(host);

  // parallax
  const lyrs = [...world.querySelectorAll('.lyr')].map(el => ({ el, d: +el.dataset.d }));
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, alive = true, t0 = performance.now();
  const reduce = reduceMotion();
  const amp = mini ? 10 : 26;
  const onMove = e => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2; };
  const onTilt = e => { if (e.gamma == null) return; tx = Math.max(-1, Math.min(1, e.gamma / 25)); ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };
  const loop = now => {
    if (!alive) return;
    const idle = (now - t0) / 1000;
    const ax = tx + Math.sin(idle * .23) * .18, ay = ty + Math.cos(idle * .17) * .12;   // zachte drift, ook zonder input
    x += (ax - x) * .06; y += (ay - y) * .06;
    for (const l of lyrs) l.el.style.transform = `translate3d(${(-x * l.d * amp).toFixed(2)}px, ${(-y * l.d * amp * .5).toFixed(2)}px, 0)`;
    raf = requestAnimationFrame(loop);
  };
  if (!reduce) {
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('deviceorientation', onTilt, { passive: true });
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', vis);
  }
  function vis() { cancelAnimationFrame(raf); if (!document.hidden && alive) raf = requestAnimationFrame(loop); }
  // opbouw: lagen komen van achter naar voor binnen
  if (!reduce) { host.classList.add('enter'); requestAnimationFrame(() => requestAnimationFrame(() => host.classList.remove('enter'))); }
  lyrs.forEach((l, i) => l.el.style.setProperty('--i', i));

  return {
    el: host, world,
    stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); document.removeEventListener('visibilitychange', vis); },
    /** Park gesloten: lampjes één voor één uit (via een klasse; de golf stopt en alles dimt). */
    close() { host.classList.add('closed'); },
  };
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
