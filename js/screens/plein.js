// Het plein: Wouters poster, levend gemaakt. Lampjes, sterren, kaarslicht, mist. Eén hoofdactie.
import { S, me, model, remaining, saveSetting, mySettings, on } from '../state.js';
import { light, isClosed, isHalloween, now } from '../stage.js';
import { esc, SPARKLE, buzz, reduceMotion } from '../ui.js';
import { PLEIN, WITTE_STIP, fill } from '../copy.js';

let PTS = null;
async function points() { if (!PTS) PTS = await (await fetch('assets/home-points.json')).json(); return PTS; }

function greeting(name) {
  const h = now().getHours();
  const k = h < 6 ? 'nacht' : h < 12 ? 'ochtend' : h < 18 ? 'middag' : 'avond';
  return fill(PLEIN.groet[k], { naam: name });
}

export default {
  nav: 'plein', title: 'Plein',
  async mount({ bg, fg, go }) {
    const P = await points();
    const [PW, PH] = P.size, hub = P.hub, k = PW / 1000;
    const closed = isClosed();

    bg.innerHTML = `<div class="plein-bg${closed ? ' closed' : ''}"><div class="plate" id="plate">
      <img src="assets/home-plate-1000.jpg" srcset="assets/home-plate-1000.jpg 1000w, assets/home-plate.jpg 1400w" sizes="80vh" alt="" draggable="false"></div></div>`;
    const plate = bg.querySelector('#plate');
    const frag = document.createDocumentFragment(), bulbs = [];
    P.bulbs.forEach(([x, y, s]) => {
      const b = document.createElement('i'); b.className = 'bulb';
      const dx = x - hub[0], dy = y - hub[1], r = Math.hypot(dx, dy);
      const onSail = r < 330 * k && y < hub[1] + 260 * k && !(x > 530 * k && x < 870 * k && y > hub[1] + 40 * k);
      const xx = x / k, yy = y / k;
      b.style.cssText = `left:${x / PW * 100}%;top:${y / PH * 100}%;--s:${(s * 2.0 / PW * 100).toFixed(2)}%;--d:${onSail ? 6 : 7 + ((Math.round(xx) * 7) % 5)}s;--dl:${onSail ? (r / (330 * k) * 1.6).toFixed(2) : (((Math.round(xx) * 13 + Math.round(yy) * 7) % 60) / 10).toFixed(1)}s`;
      frag.appendChild(b); bulbs.push(b);
    });
    P.stars.forEach(([x, y, s], i) => {
      if (y > PH * .42) return;
      const g = document.createElement('div'); g.className = 'glint'; g.innerHTML = SPARKLE;
      const z = Math.max(10, Math.min(26, s / k * .13));
      g.style.cssText = `left:${x / PW * 100}%;top:${y / PH * 100}%;width:${z}px;height:${z}px;animation-delay:${(i * .7) % 5}s;animation-duration:${4 + (i % 4)}s`;
      frag.appendChild(g);
    });
    [[.229, .695], [.783, .695]].forEach(([x, y], i) => { const l = document.createElement('div'); l.className = 'lampglow'; l.style.left = x * 100 + '%'; l.style.top = y * 100 + '%'; l.style.animationDelay = i * 1.3 + 's'; frag.appendChild(l); });
    const door = document.createElement('div'); door.className = 'doorglow'; frag.appendChild(door);
    const hit = document.createElement('div'); hit.className = 'pb-hit'; hit.title = 'Point Blanc'; hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', 'Point Blanc');
    frag.appendChild(hit);
    plate.appendChild(frag);

    const p = me(); const n = model()?.n ?? 0;
    fg.innerHTML = `
      <div class="home-top"><h1>Dispatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div>
        <p class="tonight" id="tonight"></p></div>
      <div class="home-cta">
        <button class="btn" id="start">Begin met ranken</button>
        <button class="modes" id="modes"><span id="status"></span><u>andere voorstelling ›</u></button>
      </div>
      <div class="ws" id="ws"><i></i><div>${esc(WITTE_STIP.titel)}</div><div class="eyebrow" style="margin-top:8px">${esc(WITTE_STIP.sub)}</div></div>`;
    fg.classList.add('passthrough');

    const render = () => {
      const m = model(); const rem = remaining();
      let line = `${esc(greeting(p?.name || ''))}<br>`;
      if (closed) line += esc(PLEIN.gesloten);
      else if (isHalloween()) line += esc(PLEIN.halloween);
      else if (m) line += `<b>${m.n} banen</b> op het programma, ${Math.round(m.certainty * 100)}% zeker.`;
      fg.querySelector('#tonight').innerHTML = line;
      let st = '';
      if (rem) st = rem.stable ? esc(PLEIN.stabiel) + ' · ' : `Nog ${rem.rows} ${rem.rows === 1 ? 'rij' : 'rijen'} tot je ranking staat · `;
      fg.querySelector('#status').innerHTML = st;
    };
    render();
    const off = on(w => { if (w === 'model') render(); });

    fg.querySelector('#start').onclick = () => { buzz(8); go('rangee'); };
    fg.querySelector('#modes').onclick = async () => { buzz(4); (await import('../modes.js')).openModes(go); };

    // Witte Stip: tik het straatbordje Point Blanc
    const ws = fg.querySelector('#ws'); let wsT = 0;
    hit.onclick = async () => {
      buzz([6, 40, 6]); ws.classList.add('show'); clearTimeout(wsT); wsT = setTimeout(() => ws.classList.remove('show'), 3200);
      if (!mySettings().musicUnlocked) await saveSetting({ musicUnlocked: true, music: 'wittestip' });
      (await import('../music.js')).openMusic();
    };

    // lichtplas voor de deur en twee zoeklichten; plek volgt de poster
    const place = () => {
      const r = plate.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const street = [(r.left + r.width * .5) / W, 1 - (r.top + r.height * .9) / H];
      const open = !closed;
      light({ fogH: .42, fog: 1.1, pool: street, poolI: open ? .9 : 0, pool2: [.5, .5], pool2I: 0,
        beams: open ? [{ x: -.05, y: .05, a: .62, w: .07, i: .35, sway: .12, speed: .09 }, { x: 1.05, y: .05, a: -.62, w: .07, i: .35, sway: .12, speed: .11 }] : [] });
    };
    place(); addEventListener('resize', place);

    // Park gesloten: lampjes gaan één voor één uit
    const timers = [];
    if (closed) {
      const order = bulbs.map((b, i) => [b, i]).sort(() => Math.random() - .5);
      order.forEach(([b], i) => timers.push(setTimeout(() => b.classList.add('off'), reduceMotion() ? 0 : 600 + i * 26)));
    }
    return () => { off(); removeEventListener('resize', place); timers.forEach(clearTimeout); clearTimeout(wsT); };
  },
};
