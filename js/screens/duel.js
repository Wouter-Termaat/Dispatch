// Le Duel (standaard): twee banen, tik de beste. Ook voor Twijfelzone, Park-avond en Rematch.
// Telefoon: boven elkaar (↑ ↓). Laptop: naast elkaar (← →). Spatie = gelijk, n = weet niet.
import { model, compsOf, meKey, coaster } from '../state.js';
import { contradictions } from '../model.js';
import { startSession, commit, undoLast, endSession, filterFromParams, labelFromParams, Tempo, session } from '../session.js';
import { backdrop } from '../stage.js';
import { pickDuel } from '../pick.js';
import { cardHtml, esc, buzz, pick, toast, deal } from '../ui.js';
import { rideOpLines, BESLUITELOOS, TITANEN, TRIMREM } from '../copy.js';
import * as sound from '../sound.js';

const sig = x => 1 / (1 + Math.exp(-x));

export function rankTop(label, total, stopLabel = 'Stoppen') {
  return `<div class="rank-top"><button class="stop" id="close" aria-label="Stoppen"><i>✕</i>${stopLabel}</button>
    <div class="meter"><div class="lbl"><span>${esc(label)}</span><b id="count">${total === '' ? '' : '0 van ' + total}</b></div><div class="bar"><i id="prog"></i></div></div></div>`;
}

export default {
  nav: null, title: 'Le Duel',
  mount({ bg, fg, params, go }) {
    document.body.classList.add('ranking');
    const pmode = params.get('mode');
    const filter = filterFromParams(params);
    const cmode = pmode === 'twijfel' ? 'twijfel' : pmode === 'park' ? 'park' : pmode === 'rematch' ? 'rematch' : 'duel';
    const label = labelFromParams(params, 'Le Duel');

    // Rematch: vaste wachtrij van tegenstrijdige paren
    let queue = null;
    if (pmode === 'rematch') {
      queue = [];
      for (const c of contradictions(model(), compsOf(meKey()))) {
        if (c.type === 'upset') queue.push(c.pair);
        else { const [a, b, d] = c.cycle; queue.push([a, b], [b, d], [d, a]); }
      }
      const seen = new Set(); queue = queue.filter(([a, b]) => { const k = [a, b].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
      queue = queue.map(p => (Math.random() < .5 ? p : [p[1], p[0]]));
    }
    const s = startSession('duel', { mode: cmode, label, filter, length: queue ? Math.min(queue.length, 30) : undefined });
    if (queue && !queue.length) { toast('Geen tegenstrijdigheden gevonden.'); setTimeout(() => go(''), 10); return; }
    if (filter && model().ids.filter(filter).length < 2) { toast('Te weinig banen in dit park.'); setTimeout(() => go(''), 10); return; }

    const wide = () => innerWidth >= 900 && innerWidth / innerHeight >= 1.25;
    backdrop(bg, 'stage');
    fg.innerHTML = `${rankTop(label, s.length)}
      <div class="r-q"><h2>Welke is beter?</h2></div>
      <div class="d-wrap"><div class="d-stage" id="stage"></div></div>
      <div class="foot"><button class="ghost" id="tie">Gelijk</button><button class="ghost" id="skip">Weet niet</button><button class="ghost" id="undo">Herstel</button></div>
      <div class="d-line" id="line"></div>
      <div class="clash" id="clash"><b>${esc(TITANEN.titel)}</b><span></span></div>
      <div class="lightsout"></div>`;
    const stage = fg.querySelector('#stage'), lineEl = fg.querySelector('#line');
    const prog = fg.querySelector('#prog'), count = fg.querySelector('#count');
    const tempo = new Tempo(.6, 5); const lines = rideOpLines();
    const hint = () => (matchMedia('(hover: hover)').matches ? (wide() ? 'Klik de beste · ← → · spatie is gelijk' : 'Klik de beste · ↑ ↓ · spatie is gelijk') : 'Tik de beste.');
    lineEl.textContent = hint();
    let pair = null, busy = false, shownAt = 0, ties = 0, ended = false, qi = 0, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const progress = () => { const n = s.duels; count.textContent = `${n} van ${s.length}`; prog.style.width = Math.min(100, n / s.length * 100) + '%'; };

    function choose() {
      if (queue) return queue[qi++] || null;
      return pickDuel(model(), compsOf(meKey()), { filter, mode: pmode === 'twijfel' ? 'twijfel' : 'normal' });
    }

    function render(p) {
      if (!p) return finish();
      pair = p; busy = false;
      stage.innerHTML = cardHtml(coaster(p[0]), 'a enter', 320, 260) + cardHtml(coaster(p[1]), 'b enter', 320, 260) + '<div class="or">of</div>';
      const cards = [...stage.querySelectorAll('.card')];
      cards.forEach((c, k) => { c.insertAdjacentHTML('afterbegin', '<i class="spot"></i>'); c.onclick = () => choice(k ? 'b' : 'a'); });
      deal(cards, { stagger: 60, slow: tempo.slow });
      shownAt = performance.now();
      const top = model().ranking.slice(0, 2);
      if (top.includes(p[0]) && top.includes(p[1])) { const c = fg.querySelector('#clash'); c.querySelector('span').textContent = pick(TITANEN.sub); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
    }

    function choice(outcome) {
      if (busy || !pair) return; busy = true;
      const ms = performance.now() - shownAt;
      const [a, b] = pair;
      const m = model(); const ia = m.idx.get(a), ib = m.idx.get(b);
      const pA = ia !== undefined && ib !== undefined ? sig(m.theta[ia] - m.theta[ib]) : .5;
      const type = outcome === 'skip' ? 'skip' : 'duel';
      commit([{ a, b, outcome }], cmode, { ms, type, ids: [a, b] });
      if (outcome === 'tie') ties++; else ties = 0;
      const [A, B] = stage.querySelectorAll('.card');
      if (outcome === 'a' || outcome === 'b') {
        const w = outcome === 'a' ? A : B, l = outcome === 'a' ? B : A;
        w.classList.add('win'); l.classList.add('lose');
        w.querySelector('.spot').classList.add('hot'); l.querySelector('.spot').classList.add('off');
        buzz(8); sound.bell();
        if ((outcome === 'a' ? pA : 1 - pA) < .3) sound.whoosh();
      } else {
        [A, B].forEach(c => c.classList.add(outcome === 'tie' ? 'tie' : 'lose'));
        buzz(4);
      }
      lineEl.textContent = ties >= 5 ? BESLUITELOOS : pick(lines.slice(1));
      if (type === 'duel' && tempo.add(ms / 1000)) toast(`${TRIMREM.titel}. ${TRIMREM.sub}`, 2600);
      progress();
      const next = s.duels >= s.length ? null : choose();
      later(() => (next ? render(next) : finish()), outcome === 'skip' || outcome === 'tie' ? 170 : (tempo.slow ? 480 : 270));
    }

    fg.querySelector('#tie').onclick = () => choice('tie');
    fg.querySelector('#skip').onclick = () => choice('skip');
    fg.querySelector('#undo').onclick = () => {
      if (busy) return;
      const a = undoLast(); if (!a) { toast('Niets om te herstellen.'); return; }
      if (queue) qi = Math.max(0, qi - 1);
      progress(); toast('Vorig duel teruggedraaid.'); render(a.ids);
    };
    fg.querySelector('#close').onclick = () => (s.actions.some(a => a.type !== 'skip') ? finish() : (session.current = null, go('')));

    async function finish() {
      if (ended) return; ended = true; busy = true;
      fg.querySelector('.lightsout').classList.add('on');
      await Promise.all([endSession(), new Promise(r => setTimeout(r, 750))]);
      go('affiche');
    }

    const key = e => {
      const w = wide();
      if (e.key === (w ? 'ArrowLeft' : 'ArrowUp') || (!w && e.key === 'ArrowLeft') || (w && e.key === 'ArrowUp')) { e.preventDefault(); choice('a'); }
      else if (e.key === 'ArrowDown' && e.shiftKey) { e.preventDefault(); choice('skip'); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); choice('b'); }
      else if (e.key === ' ') { e.preventDefault(); choice('tie'); }
      else if (e.key === 'n' || e.key === 'N') choice('skip');
      else if (e.key === 'Backspace') { e.preventDefault(); fg.querySelector('#undo').click(); }
      else if (e.key === 'Escape') fg.querySelector('#close').click();
    };
    addEventListener('keydown', key);

    sound.liftHill();
    progress();
    render(choose());
    return () => { removeEventListener('keydown', key); timers.forEach(clearTimeout); document.body.classList.remove('ranking'); if (!ended && session.current === s) session.current = null; };
  },
};
