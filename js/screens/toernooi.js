// Toernooi: bracket van 16 (of 8) banen (fabrikant, park of willekeurig uit je top 30). Elke match telt als vergelijking.
import { track } from '../track.js';
import { warm } from '../photos.js';
import { model, coaster } from '../state.js';
import { startSession, commit, endSession, abandonSession, session } from '../session.js';
import { backdrop } from '../stage.js';
import { rankTop } from './duel.js';
import { esc, cardHtml, buzz, toast, openSheet, closeSheet, deal } from '../ui.js';
import * as sound from '../sound.js';
import { dot } from '../stippen.js';

const ROUND = { 16: ['Achtste finale', 'Kwartfinale', 'Halve finale', 'Finale'], 8: ['Kwartfinale', 'Halve finale', 'Finale'], 4: ['Halve finale', 'Finale'] };
const SEED = { 16: [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10], 8: [0, 7, 3, 4, 1, 6, 2, 5], 4: [0, 3, 1, 2] };

function groups(field) {
  const m = model(); const map = new Map();
  for (const id of m.ranking) { const g = coaster(id)?.[field]; if (!g) continue; if (!map.has(g)) map.set(g, []); map.get(g).push(id); }
  return [...map].filter(([, l]) => l.length >= 4).map(([name, ids]) => ({ name, ids })).sort((a, b) => b.ids.length - a.ids.length || a.name.localeCompare(b.name));
}
function draw(ids) {
  // de 8 (of 4) beste uit de groep, of bij "willekeurig" 8 uit de top 30; volgorde = huidige ranking (seeding)
  const n = ids.length >= 16 ? 16 : ids.length >= 8 ? 8 : 4;
  const m = model(); const sorted = [...ids].sort((a, b) => m.position[m.idx.get(a)] - m.position[m.idx.get(b)]);
  return sorted.slice(0, n);
}

export default {
  nav: null, title: 'Toernooi',
  mount({ bg, fg, go }) {
    document.body.classList.add('ranking');
    backdrop(bg, 'stage');
    fg.innerHTML = `${rankTop('Toernooi', '')}
      <div class="tour" id="tour"></div><div class="curtain"><i></i><i></i></div>`;
    const root = fg.querySelector('#tour');
    let s = null, rounds = [], ri = 0, mi = 0, busy = false, keyH = null, ended = false, total = 0, played = 0, alive = true, advT = 0;
    const prog = () => { fg.querySelector('#prog').style.width = (total ? played / total * 100 : 0) + '%'; fg.querySelector('#count').textContent = total ? `${played} van ${total}` : ''; };
    fg.querySelector('#close').onclick = () => { if (s && s.actions.length) finish(); else { abandonSession('gestopt'); go(''); } };

    // ---------- kiezen ----------
    function setup() {
      root.innerHTML = `<div class="add-in"><div class="eyebrow">Toernooi</div><h2 class="h-title">Eén kampioen</h2>
        <p class="sheet-text">Kies wie er meedoet. Elke match telt als gewone vergelijking.</p>
        <div class="mode-list">
          <button class="mode" data-k="random"><b>Willekeurig</b><span>Zestien banen die in je ranking bij elkaar staan.</span><em>›</em></button>
          <button class="mode" data-k="manufacturer"><b>Per fabrikant</b><span>De beste van één fabrikant (8 of 16).</span><em>›</em></button>
          <button class="mode" data-k="park"><b>Per park</b><span>De beste van één park.</span><em>›</em></button>
        </div></div>`;
      root.querySelectorAll('.mode').forEach(b => b.onclick = () => {
        buzz(5); const k = b.dataset.k;
        if (k === 'random') {
          if (model().ranking.length < 4) { toast('Je hebt minstens vier banen nodig voor een toernooi.'); return; }
          // een willekeurig blok van 16 aangrenzende banen uit je ranking
          const rk = model().ranking, n = Math.min(16, rk.length), at = Math.floor(Math.random() * (rk.length - n + 1));
          return start(draw(rk.slice(at, at + n)), `plek ${at + 1} tot ${at + n}`);
        }
        const gs = groups(k);
        if (!gs.length) { toast('Geen groep met minstens vier banen.'); return; }
        const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">${k === 'park' ? 'Park' : 'Fabrikant'}</div><h3 class="h-title">Kies</h3>
          <div class="chips">${gs.map((g, i) => `<button class="chip" data-i="${i}">${esc(g.name)} <small>${g.ids.length}</small></button>`).join('')}</div></div>`);
        body.querySelectorAll('.chip').forEach(c => c.onclick = () => { closeSheet(); const g = gs[+c.dataset.i]; start(draw(g.ids), g.name); });
      });
    }

    // ---------- bracket ----------
    function start(ids, label) {
      const n = ids.length; const order = SEED[n].map(i => ids[i]);
      rounds = [[]]; for (let i = 0; i < n; i += 2) rounds[0].push({ a: order[i], b: order[i + 1], w: null });
      ri = 0; mi = 0; total = n - 1; played = 0;
      s = startSession('toernooi', { mode: 'toernooi', label: `Toernooi · ${label}`, length: total });
      s.tLabel = label; sound.liftHill(); prog(); warm(ids); bracket();
    }
    function bracket(next = true) {
      const names = ROUND[rounds[0].length * 2];
      root.innerHTML = `<div class="add-in"><div class="eyebrow">Toernooi · ${esc(s.tLabel)}</div><h2 class="h-title">${esc(names[ri])}</h2>
        <div class="bracket">${rounds.map((r, k) => `<div class="b-round">${rounds.length > 1 ? `<div class="eyebrow">${esc(names[k])}</div>` : ''}${r.map(mt => `<div class="b-match">${[mt.a, mt.b].map(x => `<div class="b-slot${mt.w ? (mt.w === x ? ' won' : ' out') : ''}">${x ? esc(coaster(x).name) : '·'}</div>`).join('')}</div>`).join('')}</div>`).join('')}</div>
        <div class="row-btns"><button class="btn" id="go">${played ? 'Volgende ronde' : 'Begin'}</button></div></div>`;
      root.querySelector('#go').onclick = () => match();
    }
    function match() {
      const r = rounds[ri], mt = r[mi]; const names = ROUND[rounds[0].length * 2];
      root.innerHTML = `<div class="d-head"><div class="eyebrow">${esc(names[ri])}${r.length > 1 ? ` · ${mi + 1} van ${r.length}` : ''}</div></div>
        <div class="d-wrap"><div class="d-stage" id="stage">${cardHtml(coaster(mt.a), 'a enter', 320, 240)}${cardHtml(coaster(mt.b), 'b enter', 320, 240)}<div class="or">of</div></div></div>
        <div class="d-line">Wie gaat door?</div>`;
      const st = root.querySelector('#stage'); const [A, B] = st.querySelectorAll('.card'); busy = false;
      deal([A, B], { stagger: 60 });
      const t0 = performance.now();
      const pickW = (w, el, other) => {
        if (busy) return; busy = true; mt.w = w; played++; prog();
        commit([{ a: mt.a, b: mt.b, outcome: w === mt.a ? 'a' : 'b' }], 'toernooi', { type: 'duel', ids: [mt.a, mt.b], ms: performance.now() - t0 });
        el.classList.add('win'); other.classList.add('lose'); buzz(8); sound.bell();
        
        advT = setTimeout(() => alive && advance(), 420);
      };
      A.onclick = () => pickW(mt.a, A, B); B.onclick = () => pickW(mt.b, B, A);
      keyH && removeEventListener('keydown', keyH);
      keyH = e => { if (e.key === 'ArrowUp') A.click(); else if (e.key === 'ArrowDown') B.click(); };
      addEventListener('keydown', keyH);
    }
    function advance() {
      const r = rounds[ri];
      if (mi < r.length - 1) { mi++; return match(); }
      const winners = r.map(m => m.w);
      if (winners.length === 1) return champion(winners[0]);
      const nr = []; for (let i = 0; i < winners.length; i += 2) nr.push({ a: winners[i], b: winners[i + 1], w: null });
      rounds.push(nr); ri++; mi = 0; bracket();
    }

    // ---------- kampioen ----------
    function champion(id) {
      s.champion = id; const c = coaster(id);
      track('champion', { id, label: s.tLabel, field: rounds[0]?.length * 2 || null });
      root.innerHTML = `<div class="champ"><div class="eyebrow">Toernooi · ${esc(s.tLabel)}</div><h2 class="champ-t">Kampioen</h2>
        <div class="champ-card">${cardHtml(c, 'win', 320, 420)}<div class="champ-ring"></div></div>
        <div class="row-btns"><button class="ghost" id="again">Nog een toernooi</button><button class="btn" id="aff">Naar de affiche</button></div></div>`;
      const ring = root.querySelector('.champ-ring'); let h = '';
      // één lamp in de ring (rechts, halverwege) is een witte stip
      for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; const st = `left:${50 + 54 * Math.cos(a)}%;top:${50 + 50 * Math.sin(a)}%;animation-delay:${(i * .09).toFixed(2)}s`; h += i === 0 ? dot('kampioen', 'ringdot', 'span').replace('class=', `style="${st}" class=`) : `<i style="${st}"></i>`; }
      ring.innerHTML = h;
      sound.fanfare(true); setTimeout(() => sound.applause(2.6), 700); buzz([12, 50, 12, 50, 30]);
      root.querySelector('#aff').onclick = finish;
      root.querySelector('#again').onclick = async () => { await endSession(); s = null; setup(); };
    }

    async function finish() {
      if (ended) return; ended = true;
      fg.querySelector('.curtain').classList.add('close');
      await Promise.all([endSession(), new Promise(r => setTimeout(r, 900))]);
      go('affiche');
    }

    setup(); prog();
    return () => { alive = false; clearTimeout(advT); document.body.classList.remove('ranking'); keyH && removeEventListener('keydown', keyH); if (!ended && session.current === s) abandonSession(); };
  },
};
