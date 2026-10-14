// Le Duel: twee kaarten boven elkaar. Tik de winnaar. Ook gebruikt voor Twijfelzone, Park-avond en Rematch.
import { model, compsOf, meKey, coaster } from '../state.js';
import { nextDuel, contradictions } from '../model.js';
import { startSession, commit, undoLast, endSession, filterFromParams, labelFromParams, Tempo, session } from '../session.js';
import { beams } from '../stage.js';
import { cardHtml, esc, buzz, pick, toast } from '../ui.js';
import { rideOpLines, BESLUITELOOS, TITANEN, TRIMREM } from '../copy.js';
import * as sound from '../sound.js';

const sig = x => 1 / (1 + Math.exp(-x));

export default {
  nav: null, title: 'Le Duel',
  light: { fogH: .30, fog: .9, beams: [] },
  mount({ bg, fg, params, go }) {
    document.body.classList.add('ranking');
    const pmode = params.get('mode');
    const filter = filterFromParams(params);
    const parks = params.getAll('park');
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

    bg.innerHTML = '<div class="theatre"></div><div class="floor"></div>';
    fg.innerHTML = `
      <div class="topbar"><button class="x" id="close" aria-label="Sluiten">✕</button><div class="prog"><i id="prog"></i></div><div class="count" id="count">0 / ${s.length}</div></div>
      <div class="d-head"><div class="eyebrow">${esc(label)}</div></div>
      <div class="d-wrap"><div class="d-stage" id="stage"></div></div>
      <div class="d-foot"><button class="ghost" id="tie">Gelijk</button><button class="ghost" id="skip">Weet niet</button><button class="ghost icon" id="undo" aria-label="Herstel" title="Herstel">↺</button></div>
      <div class="d-line" id="line">${matchMedia('(hover: hover)').matches ? 'Klik de winnaar · ↑ ↓ · spatie is gelijk' : 'Tik de winnaar.'}</div>
      <div class="clash" id="clash"><b>${esc(TITANEN.titel)}</b><span></span></div>
      <div class="curtain"><i></i><i></i></div>`;
    const stage = fg.querySelector('#stage'), lineEl = fg.querySelector('#line');
    const prog = fg.querySelector('#prog'), count = fg.querySelector('#count');
    const tempo = new Tempo(.6, 5); const lines = rideOpLines();
    let pair = null, busy = false, shownAt = 0, ties = 0, ended = false, qi = 0, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const progress = () => { const n = s.duels; count.textContent = `${n} / ${s.length}`; prog.style.width = Math.min(100, n / s.length * 100) + '%'; };

    function choose() {
      if (queue) return queue[qi++] || null;
      const m = model(), comps = compsOf(meKey());
      if (parks.length === 2) {
        // twee parken tegen elkaar: liefst een baan uit elk park
        for (let k = 0; k < 12; k++) { const p = nextDuel(m, comps, { filter, mode: 'normal' }); if (p && coaster(p[0]).park !== coaster(p[1]).park) return p; }
      }
      return nextDuel(m, comps, { filter, mode: pmode === 'twijfel' ? 'twijfel' : 'normal' });
    }

    const baseBeams = () => [{ x: .5, y: 1.15, a: Math.PI - .16, w: .12, i: .45 }, { x: .5, y: 1.15, a: Math.PI + .16, w: .12, i: .45 }];
    function render(p) {
      if (!p) return finish();
      pair = p; busy = false;
      const slow = tempo.slow;
      stage.innerHTML = cardHtml(coaster(p[0]), 'a enter', 320, 240) + cardHtml(coaster(p[1]), 'b enter', 320, 240) + '<div class="or">of</div>';
      const [A, B] = stage.querySelectorAll('.card');
      if (slow) { A.style.transitionDuration = B.style.transitionDuration = '.5s'; }
      requestAnimationFrame(() => { A.classList.remove('enter'); later(() => B.classList.remove('enter'), slow ? 160 : 50); });
      A.onclick = () => choice('a'); B.onclick = () => choice('b');
      beams(baseBeams());
      shownAt = performance.now();
      const top = model().ranking.slice(0, 2);
      if (top.includes(p[0]) && top.includes(p[1])) { const c = fg.querySelector('#clash'); c.querySelector('span').textContent = pick(TITANEN.sub); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
    }

    function choice(outcome) {
      if (busy || !pair) return; busy = true;
      const ms = performance.now() - shownAt;
      const [a, b] = pair;
      // verrassing? (het model gaf de winnaar minder dan 30% kans)
      const m = model(); const ia = m.idx.get(a), ib = m.idx.get(b);
      const pA = ia !== undefined && ib !== undefined ? sig(m.theta[ia] - m.theta[ib]) : .5;
      const type = outcome === 'skip' ? 'skip' : 'duel';
      commit([{ a, b, outcome }], cmode, { ms, type, ids: [a, b] });
      if (outcome === 'tie') ties++; else ties = 0;
      if (outcome === 'a' || outcome === 'b') {
        const [A, B] = stage.querySelectorAll('.card'); const w = outcome === 'a' ? A : B, l = outcome === 'a' ? B : A;
        w.classList.add('win'); l.classList.add('lose');
        const bb = baseBeams(); bb[outcome === 'a' ? 0 : 1].i = 1.1; bb[outcome === 'a' ? 1 : 0].i = .08; beams(bb);
        buzz(8); sound.bell();
        if ((outcome === 'a' ? pA : 1 - pA) < .3) sound.whoosh();
      } else {
        stage.querySelectorAll('.card').forEach(c => c.classList.add(outcome === 'tie' ? 'tie' : 'lose'));
        buzz(4);
      }
      lineEl.textContent = ties >= 5 ? BESLUITELOOS : pick(lines.slice(1));
      if (type === 'duel' && tempo.add(ms / 1000)) toast(`${TRIMREM.titel}. ${TRIMREM.sub}`, 2600);
      progress();
      const next = s.duels >= s.length ? null : choose();
      later(() => (next ? render(next) : finish()), outcome === 'skip' || outcome === 'tie' ? 160 : (tempo.slow ? 480 : 250));
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
      fg.querySelector('.curtain').classList.add('close');
      await Promise.all([endSession(), new Promise(r => setTimeout(r, 900))]);
      go('affiche');
    }

    const key = e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); choice('a'); }
      else if (e.key === 'ArrowDown' && e.shiftKey) { e.preventDefault(); choice('skip'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); choice('b'); }
      else if (e.key === ' ') { e.preventDefault(); choice('tie'); }
      else if (e.key === 'n' || e.key === 'N') choice('skip');
      else if (e.key === 'Backspace') { e.preventDefault(); fg.querySelector('#undo').click(); }
    };
    addEventListener('keydown', key);

    sound.liftHill();
    progress();
    render(choose());
    return () => { removeEventListener('keydown', key); timers.forEach(clearTimeout); document.body.classList.remove('ranking'); if (!ended && session.current === s) session.current = null; };
  },
};
