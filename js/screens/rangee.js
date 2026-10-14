// La Rangée: vier banen naast elkaar, tik ze op volgorde (favoriet eerst). De hoofdmodus, moet snel zijn.
import { model, compsOf, meKey, coaster } from '../state.js';
import { nextRow, rowToComparisons, checkWindow } from '../model.js';
import { startSession, commit, undoLast, endSession, checkDue, checkDone, filterFromParams, labelFromParams, Tempo, session } from '../session.js';
import { light, beams, spotOver } from '../stage.js';
import { cardHtml, esc, buzz, pick, toast, artFor, meta } from '../ui.js';
import { GENOTEERD, TITANEN, TRIMREM } from '../copy.js';
import * as sound from '../sound.js';

export default {
  nav: null, title: 'La Rangée',
  light: { fogH: .32, fog: .9, beams: [] },
  mount({ bg, fg, params, go }) {
    document.body.classList.add('ranking');
    const m0 = model();
    const filter = filterFromParams(params);
    const mode = params.get('mode') === 'twijfel' ? 'twijfel' : 'normal';
    const cmode = params.get('mode') === 'twijfel' ? 'twijfel' : params.get('mode') === 'park' ? 'park' : 'rangee';
    const label = labelFromParams(params, 'La Rangée');
    const s = startSession('rangee', { mode: cmode, label, filter });
    const allowed = filter ? m0.ids.filter(filter).length : m0.n;
    if (allowed < 4) { toast('Te weinig banen voor een rij. We doen duels.'); setTimeout(() => go('duel?' + params.toString()), 10); return; }

    bg.innerHTML = '<div class="theatre"></div><div class="floor"></div>';
    fg.innerHTML = `
      <div class="topbar"><button class="x" id="close" aria-label="Sluiten">✕</button><div class="prog"><i id="prog"></i></div><div class="count" id="count">0 / ${s.length}</div></div>
      <div class="r-title"><div class="eyebrow">${esc(label)}</div><h2 id="rh">Welke eerst?</h2><p id="rp">Tik ze op volgorde, je favoriet eerst.</p></div>
      <div class="r-stage"><div class="r-line" id="line"></div><div class="r-check" id="check" hidden></div></div>
      <div class="r-flash" id="flash">Genoteerd</div>
      <div class="r-foot"><button class="ghost" id="undo">Herstel</button><button class="ghost" id="skip">Sla over</button></div>
      <div class="clash" id="clash"><b>${esc(TITANEN.titel)}</b><span></span></div>
      <div class="curtain"><i></i><i></i></div>`;
    const line = fg.querySelector('#line'), flash = fg.querySelector('#flash'), checkEl = fg.querySelector('#check');
    const prog = fg.querySelector('#prog'), count = fg.querySelector('#count');
    const tempo = new Tempo();
    let row = null, ord = [], shownAt = 0, locked = false, nextReady = null, inCheck = false, ended = false, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    const pos = i => `calc(${i} * ((100% - 24px) / 4 + 8px))`;
    const progress = () => { count.textContent = `${s.rows} / ${s.length}`; prog.style.width = Math.min(100, s.rows / s.length * 100) + '%'; };
    const choose = () => nextRow(model(), compsOf(meKey()), { size: 4, filter, mode });

    function setBeams(hot = -1) {
      const cards = [...line.children];
      beams(cards.map((c, k) => spotOver(c.getBoundingClientRect(), k === hot ? 1.0 : (ord.includes(c) ? .8 : .42))));
    }

    function render(ids, anim = true) {
      inCheck = false; checkEl.hidden = true; line.hidden = false;
      fg.querySelector('#rh').textContent = 'Welke eerst?'; fg.querySelector('#rp').textContent = 'Tik ze op volgorde, je favoriet eerst.';
      row = ids; ord = []; locked = false;
      const slow = tempo.slow;
      line.innerHTML = ids.map(id => cardHtml(coaster(id), anim ? 'enter' : '', 120, 350)).join('');
      [...line.children].forEach((el, i) => {
        el.style.left = pos(i);
        el.onclick = () => pickCard(el);
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickCard(el); } };
        if (anim) later(() => el.classList.remove('enter'), (slow ? 60 : 16) + i * (slow ? 140 : 40));
        if (slow) el.style.transitionDuration = '.5s';
      });
      shownAt = performance.now();
      requestAnimationFrame(() => setBeams());
      // Titanenclash: je twee hoogste banen in één rij
      const top = model().ranking.slice(0, 2);
      if (top.every(t => ids.includes(t))) clash();
      nextReady = null;
    }

    function clash() {
      const c = fg.querySelector('#clash'); c.querySelector('span').textContent = pick(TITANEN.sub);
      c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); sound.whoosh();
    }

    function pickCard(el) {
      if (locked || inCheck) return;
      if (el.classList.contains('picked')) {
        // de laatst gekozen kaart nog eens tikken = die keuze terugnemen
        if (ord[ord.length - 1] === el) { ord.pop(); el.classList.remove('picked'); el.querySelector('.num').textContent = ''; setBeams(); buzz(4); }
        return;
      }
      ord.push(el); el.classList.add('picked'); el.querySelector('.num').textContent = ord.length; buzz(6); sound.tick();
      setBeams([...line.children].indexOf(el));
      if (ord.length === 3) { const last = [...line.children].find(x => !x.classList.contains('picked')); pickCard(last); return; }
      if (ord.length === 4) done();
    }

    function done() {
      locked = true;
      const ms = performance.now() - shownAt;
      const ordered = ord.map(e => e.dataset.id);
      commit(rowToComparisons(ordered), cmode, { ms, type: 'row', ids: ordered });
      sound.bell(); buzz(10);
      ord.forEach((e, i) => (e.style.left = pos(i)));
      flash.textContent = pick(GENOTEERD); flash.classList.add('show');
      progress();
      if (tempo.add(ms / 1000 / 3)) toast(`${TRIMREM.titel}. ${TRIMREM.sub}`, 2600);
      // volgende rij direct kiezen op basis van het vorige model (de nieuwe fit loopt in de worker)
      const finished = s.rows >= s.length;
      const wantCheck = !finished && checkDue();
      if (!finished && !wantCheck) nextReady = choose();
      const wait = tempo.slow ? 620 : 330;
      later(() => {
        flash.classList.remove('show');
        if (finished) return finish();
        if (wantCheck) return showCheck();
        render(nextReady || choose());
      }, wait);
    }

    // ---------- Klopt dit? ----------
    function showCheck(reorder = false, ids = null) {
      inCheck = true; locked = false; line.hidden = true; checkEl.hidden = false;
      const win = ids || checkWindow(model(), 5);
      fg.querySelector('#rh').textContent = reorder ? 'Hoe dan wel?' : 'Klopt dit?';
      fg.querySelector('#rp').textContent = reorder ? 'Tik ze op volgorde, je favoriet eerst.' : 'Zo staan deze vijf nu bij je, van hoog naar laag.';
      checkEl.innerHTML = `<ol class="ck-list">${win.map((id, i) => { const c = coaster(id); return `<li data-id="${esc(id)}" class="${reorder ? 'tap' : ''}"><i class="ck-n">${reorder ? '' : i + 1}</i><div class="ck-art">${artFor(c, 120, 80)}</div><div><b>${esc(c.name)}</b><small>${meta(c)}</small></div></li>`; }).join('')}</ol>
        ${reorder ? '<div class="row-btns"><button class="ghost" id="ckback">Terug</button></div>' : '<div class="row-btns"><button class="ghost" id="ckno">Anders</button><button class="btn" id="ckyes">Klopt</button></div>'}`;
      beams([{ x: .5, y: 1.12, a: Math.PI, w: .2, i: .5 }]);
      shownAt = performance.now();
      if (!reorder) {
        checkEl.querySelector('#ckyes').onclick = () => { commit(rowToComparisons(win), 'check', { type: 'check', ids: win, ms: performance.now() - shownAt }); checkDone(); buzz(8); sound.bell(1.12); toast('Bevestigd.'); render(choose()); };
        checkEl.querySelector('#ckno').onclick = () => showCheck(true, win);
        return;
      }
      checkEl.querySelector('#ckback').onclick = () => showCheck(false, win);
      const chosen = [];
      const items = [...checkEl.querySelectorAll('li')];
      items.forEach(li => li.onclick = () => {
        if (li.classList.contains('picked')) { if (chosen[chosen.length - 1] === li) { chosen.pop(); li.classList.remove('picked'); li.querySelector('.ck-n').textContent = ''; } return; }
        chosen.push(li); li.classList.add('picked'); li.querySelector('.ck-n').textContent = chosen.length; buzz(6); sound.tick();
        if (chosen.length === items.length - 1) { const last = items.find(x => !x.classList.contains('picked')); last.click(); return; }
        if (chosen.length === items.length) {
          const ordered = chosen.map(x => x.dataset.id);
          commit(rowToComparisons(ordered), 'check', { type: 'check', ids: ordered, ms: performance.now() - shownAt }); checkDone();
          sound.bell(1.12); toast('Genoteerd. Dank je.'); later(() => render(choose()), 380);
        }
      });
    }

    // ---------- knoppen ----------
    fg.querySelector('#undo').onclick = () => {
      if (inCheck) return;
      buzz(5);
      if (ord.length) { ord.forEach(e => { e.classList.remove('picked'); e.querySelector('.num').textContent = ''; }); ord = []; setBeams(); return; }
      const a = undoLast();
      if (!a) { toast('Niets om te herstellen.'); return; }
      progress(); toast(a.type === 'check' ? 'Controle teruggedraaid.' : 'Vorige rij teruggedraaid.');
      if (a.type === 'row') render(shuffle(a.ids), true); else render(choose());
    };
    fg.querySelector('#skip').onclick = () => {
      if (locked) return;
      if (inCheck) { checkDone(); render(choose()); return; }
      buzz(4);
      commit(rowToComparisons(row).map(c => ({ ...c, outcome: 'skip' })), cmode, { type: 'skip', ids: row });
      render(choose());
    };
    fg.querySelector('#close').onclick = () => (s.actions.some(a => a.type !== 'skip') ? finish() : (session.current = null, go('')));

    async function finish() {
      if (ended) return; ended = true; locked = true;
      fg.querySelector('.curtain').classList.add('close');
      const [sum] = await Promise.all([endSession(), new Promise(r => setTimeout(r, 900))]);
      go('affiche');
      return sum;
    }

    const key = e => {
      if (e.key === 'Backspace') { e.preventDefault(); fg.querySelector('#undo').click(); }
      const n = +e.key; if (n >= 1 && n <= 4 && !inCheck) { const el = line.children[n - 1]; if (el) pickCard(el); }
    };
    addEventListener('keydown', key);
    const onResize = () => !inCheck && setBeams();
    addEventListener('resize', onResize);

    sound.liftHill();
    progress();
    render(choose());
    return () => { removeEventListener('keydown', key); removeEventListener('resize', onResize); timers.forEach(clearTimeout); document.body.classList.remove('ranking'); if (!ended && session.current === s) session.current = null; };
  },
};

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
