// De affiche na elke sessie: "Dispatch présente / Une Soirée de Duels", met de molen.
// Bewaar als PNG (canvas, met de juiste fonts) of stuur naar de ander (Web Share API, anders downloaden).
import { coaster, nameOf, otherKey, meKey } from '../state.js';
import { lastSummary } from '../session.js';
import { esc, dateNl, isoDate, toast, buzz, reduceMotion } from '../ui.js';
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
  light: { fogH: .3, fog: .8, beams: [{ x: .1, y: -.05, a: .45, w: .08, i: .3, sway: .1 }, { x: .9, y: -.05, a: -.45, w: .08, i: .3, sway: .1 }] },
  mount({ bg, fg, go }) {
    const s = lastSummary();
    if (!s) { go(''); return; }
    const date = new Date(s.date);
    const other = nameOf(otherKey());
    const rows = rowsOf(s);
    const again = s.kind === 'duel' ? 'duel' : s.kind === 'toernooi' ? 'toernooi' : 'rangee';
    bg.innerHTML = '<div class="theatre"></div>';
    fg.innerHTML = `
      <div class="aff-wrap">
        <div class="aff" id="aff"><div class="art"></div><div class="shade"></div>
          <div class="t"><div class="eyebrow">Dispatch présente</div><h1>Une Soirée<br>de Duels</h1><p>${esc(dateNl(date))}</p></div>
          <div class="rows">${rows.map(([k, v, d, cls], i) => `<div class="row" style="--i:${i}"><span>${esc(k)}</span><b>${esc(v)}${d ? `<small class="${cls}">${esc(d)}</small>` : ''}</b></div>`).join('')}</div>
          <div class="curtain open"><i></i><i></i></div>
        </div>
      </div>
      <div class="a-foot">
        <div class="row-btns"><button class="ghost" id="save">Bewaar</button><button class="btn" id="share">Stuur naar ${esc(other)}</button></div>
        <div class="row-btns small"><button class="link" id="again">Nog een ronde</button><button class="link" id="home">Naar het plein</button></div>
      </div>`;
    if (!reduceMotion()) setTimeout(() => sound.applause(), 500);
    buzz([10, 50, 10]);

    fg.querySelector('#again').onclick = () => go(again);
    fg.querySelector('#home').onclick = () => go('');
    const file = () => `Dispatch ${nameOf(meKey())} ${isoDate(date)}.png`;
    fg.querySelector('#save').onclick = async () => {
      const blob = await renderPng(s, rows, date); download(blob, file()); toast('Affiche bewaard.');
    };
    fg.querySelector('#share').onclick = async () => {
      const blob = await renderPng(s, rows, date);
      const f = new File([blob], file(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] })) {
        try { await navigator.share({ files: [f], title: 'Une Soirée de Duels', text: `Mijn avond in Dispatch, ${dateNl(date)}.` }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      download(blob, file()); toast(`Gedownload. Stuur hem zelf naar ${other}.`);
    };
  },
};

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

/** Tekent de affiche op een canvas van 1080×1350. */
export async function renderPng(s, rows, date) {
  await Promise.all(['60px Limelight', 'italic 40px "Playfair Display"', '600 20px "Josefin Sans"'].map(f => document.fonts.load(f)));
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#120a18'; g.fillRect(0, 0, W, H);
  const img = await loadImg('assets/windmill.jpg');
  // cover, uitsnede iets boven het midden
  const sc = Math.max(W / img.width, H / img.height), iw = img.width * sc, ih = img.height * sc;
  g.drawImage(img, (W - iw) / 2, (H - ih) * .3, iw, ih);
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(18,10,26,.92)'); gr.addColorStop(.3, 'rgba(18,10,26,.2)'); gr.addColorStop(.55, 'rgba(18,10,26,.15)'); gr.addColorStop(.78, 'rgba(14,8,20,.96)'); gr.addColorStop(1, 'rgba(14,8,20,.98)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // kader
  g.strokeStyle = 'rgba(236,199,127,.6)'; g.lineWidth = 2; g.strokeRect(28, 28, W - 56, H - 56);
  g.strokeStyle = 'rgba(236,199,127,.22)'; g.strokeRect(40, 40, W - 80, H - 80);
  g.textAlign = 'center';
  const spaced = (txt, x, y, sp) => { g.save(); g.letterSpacing = sp + 'px'; g.fillText(txt, x, y); g.restore(); };
  g.fillStyle = '#d9b97a'; g.font = '600 22px "Josefin Sans"'; spaced('DISPATCH PRÉSENTE', W / 2, 120, 9);
  g.shadowColor = 'rgba(255,200,120,.75)'; g.shadowBlur = 36; g.fillStyle = '#fff1d2'; g.font = '104px Limelight';
  g.fillText('Une Soirée', W / 2, 250); g.fillText('de Duels', W / 2, 360);
  g.shadowColor = 'rgba(10,5,14,.95)'; g.shadowBlur = 18; g.fillStyle = '#f3e6c6'; g.font = 'italic 34px "Playfair Display"'; g.fillText(dateNl(date), W / 2, 420); g.fillText(dateNl(date), W / 2, 420); g.shadowBlur = 0;
  // regels onderaan
  const top = H - 70 - rows.length * 92;
  rows.forEach(([k, v, d, cls], i) => {
    const y = top + i * 92;
    g.strokeStyle = 'rgba(236,199,127,.22)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(80, y); g.lineTo(W - 80, y); g.stroke();
    g.textAlign = 'left'; g.fillStyle = '#cbb994'; g.font = '600 19px "Josefin Sans"'; spaced(k.toUpperCase(), 80, y + 56, 5);
    const lw = g.measureText(k.toUpperCase()).width + k.length * 5;
    g.textAlign = 'right';
    let x = W - 80;
    if (d) { g.font = '600 26px "Josefin Sans"'; g.fillStyle = cls === 'up' ? '#a6d3a6' : '#e09486'; g.fillText(d, x, y + 58); x -= g.measureText(d).width + 14; }
    g.font = 'italic 40px "Playfair Display"'; g.fillStyle = '#f3e6c6';
    const max = x - 80 - lw - 36; let txt = v;
    while (g.measureText(txt).width > max && txt.length > 4) txt = txt.slice(0, -2).trimEnd() + '…';
    g.fillText(txt, x, y + 58);
  });
  return new Promise(r => c.toBlob(r, 'image/png'));
}
