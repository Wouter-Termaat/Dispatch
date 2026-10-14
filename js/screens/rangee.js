// La Rangée: vier banen naast elkaar. Tik ze op volgorde (favoriet eerst), bekijk de volgorde en bevestig.
import { model, compsOf, meKey, coaster, mySettings } from '../state.js';
import { rowToComparisons, checkWindow } from '../model.js';
import { startSession, commit, undoLast, endSession, checkDue, checkDone, filterFromParams, labelFromParams, Tempo, session } from '../session.js';
import { backdrop } from '../stage.js';
import { pickRow } from '../pick.js';
import { cardHtml, esc, buzz, pick, toast, artFor, meta, deal } from '../ui.js';
import { GENOTEERD, TITANEN, TRIMREM } from '../copy.js';
import { rankTop } from './duel.js';
import * as sound from '../sound.js';

export default {
  nav: null, title: 'La Rangée',
  mount({ bg, fg, params, go }) {
    document.body.classList.add('ranking');
    const m0 = model();
    const filter = filterFromParams(params);
    const mode = params.get('mode') === 'twijfel' ? 'twijfel' : 'normal';
    const cmode = params.get('mode') === 'twijfel' ? 'twijfel' : params.get('mode') === 'park' ? 'park' : 'rangee';
    const label = labelFromParams(params, 'La Rangée');
    const s = startSession('rangee', { mode: cmode, label, filter, length: mySettings().rowLength });
    const allowed = filter ? m0.ids.filter(filter).length : m0.n;
    if (allowed < 4) { toast('Te weinig banen voor een rij. We doen duels.'); setTimeout(() => go('duel?' + params.toString()), 10); return; }

    backdrop(bg, 'stage');
    fg.innerHTML = `${rankTop(label, s.length)}
      <div class="r-q"><h2 id="rh">Welke eerst?</h2><p id="rp">Tik ze op volgorde, je favoriet eerst.</p></div>
      <div class="r-stage"><div class="r-line" id="line"></div><div class="r-check" id="check" hidden></div></div>
      <div class="r-flash" id="flash">Genoteerd</div>
      <div class="foot tools"><button class="ghost" id="undo">Herstel</button><button class="ghost" id="skip">Sla over</button></div>
      <div class="foot confirm"><button class="ghost" id="again">Opnieuw</button><button class="btn" id="ok">Bevestig</button></div>
      <div class="d-line"><span class="keys">1 2 3 4 kiezen · Enter bevestigt · Backspace herstelt</span></div>
      <div class="clash" id="clash"><b>${esc(TITANEN.titel)}</b><span></span></div>
      <div class="lightsout"></div>`;
    const scr = fg, line = fg.querySelector('#line'), flash = fg.querySelector('#flash'), checkEl = fg.querySelector('#check');
    const prog = fg.querySelector('#prog'), count = fg.querySelector('#count');
    const tempo = new Tempo(.35, 3);   // 3 tikken + bevestigen; pas onder ~1,4 s per rij gaat Trimrem aan
    let row = null, ord = [], shownAt = 0, locked = false, inCheck = false, confirming = false, ended = false, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    const pos = i => `calc(${i} * ((100% - 24px) / 4 + 8px))`;
    const progress = () => { count.textContent = `${s.rows} van ${s.length}`; prog.style.width = Math.min(100, s.rows / s.length * 100) + '%'; };
    const choose = () => pickRow(model(), compsOf(meKey()), { size: 4, filter, mode });
    const setQ = (h, p) => { fg.querySelector('#rh').textContent = h; fg.querySelector('#rp').textContent = p; };

    function render(ids) {
      inCheck = false; confirming = false; scr.classList.remove('confirming'); line.classList.remove('ordered');
      checkEl.hidden = true; line.hidden = false;
      setQ('Welke eerst?', 'Tik ze op volgorde, je favoriet eerst.');
      row = ids; ord = []; locked = false;
      line.innerHTML = ids.map(id => cardHtml(coaster(id), 'enter', 120, 350)).join('');
      const cards = [...line.children];
      cards.forEach((el, i) => {
        el.style.left = pos(i);
        el.insertAdjacentHTML('afterbegin', '<i class="spot"></i>');
        el.onclick = () => pickCard(el);
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickCard(el); } };
      });
      deal(cards, { stagger: 45, slow: tempo.slow });
      shownAt = performance.now();
      const top = model().ranking.slice(0, 2);
      if (top.every(t => ids.includes(t))) { const c = fg.querySelector('#clash'); c.querySelector('span').textContent = pick(TITANEN.sub); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); sound.whoosh(); }
    }

    function pickCard(el) {
      if (locked || inCheck) return;
      if (el.classList.contains('picked')) {
        // de laatst gekozen kaart nog eens tikken = die keuze terugnemen (ook in de bevestigstap)
        if (ord[ord.length - 1] === el || confirming) unpickFrom(el);
        return;
      }
      ord.push(el); el.classList.add('picked'); el.querySelector('.num').textContent = ord.length; buzz(6); sound.tick();
      el.querySelector('.spot').classList.add('hot');
      if (ord.length === 3) { const last = [...line.children].find(x => !x.classList.contains('picked')); pickCard(last); return; }
      if (ord.length === 4) showOrder();
    }
    function unpickFrom(el) {
      const k = ord.indexOf(el); if (k < 0) return;
      // terug naar de stand vóór deze keuze; de automatisch ingevulde vierde gaat ook terug
      const keep = ord.slice(0, Math.min(k, 2));
      ord.slice(keep.length).forEach(e => { e.classList.remove('picked'); e.querySelector('.num').textContent = ''; e.querySelector('.spot').classList.remove('hot'); });
      ord = keep; confirming = false; scr.classList.remove('confirming'); line.classList.remove('ordered');
      [...line.children].forEach(e => (e.style.left = pos(row.indexOf(e.dataset.id))));
      setQ('Welke eerst?', 'Tik ze op volgorde, je favoriet eerst.'); buzz(4);
    }

    // na vier keuzes: kaarten schuiven naar de gekozen volgorde, dan bevestigen
    function showOrder() {
      confirming = true; scr.classList.add('confirming');
      ord.forEach((e, i) => (e.style.left = pos(i)));
      setQ('Zo dan?', 'Bevestig, of tik een kaart om vanaf daar opnieuw te kiezen.');
      later(() => fg.querySelector('#ok').focus({ preventScroll: true }), 50);
    }

    function confirm() {
      if (!confirming || locked) return;
      locked = true; confirming = false; scr.classList.remove('confirming');
      const ms = performance.now() - shownAt;
      const ordered = ord.map(e => e.dataset.id);
      commit(rowToComparisons(ordered), cmode, { ms, type: 'row', ids: ordered });
      sound.confirm(); buzz(10);
      ord.forEach(e => e.classList.add('win'));
      flash.textContent = pick(GENOTEERD); flash.classList.add('show');
      progress();
      if (tempo.add(ms / 1000 / 4)) toast(`${TRIMREM.titel}. ${TRIMREM.sub}`, 2600);
      const finished = s.rows >= s.length;
      const wantCheck = false;   // Klopt dit? is uitgezet: Wouter wil alleen rijen van vier
      const next = !finished && !wantCheck ? choose() : null;   // direct kiezen met het vorige model; de nieuwe fit loopt in de worker
      later(() => {
        flash.classList.remove('show');
        if (finished) return finish();
        if (wantCheck) return showCheck();
        render(next || choose());
      }, tempo.slow ? 560 : 300);
    }

    // ---------- Klopt dit? ----------
    function showCheck(reorder = false, ids = null) {
      inCheck = true; locked = false; confirming = false; scr.classList.remove('confirming'); line.hidden = true; checkEl.hidden = false;
      const win = ids || checkWindow(model(), 5);
      setQ(reorder ? 'Hoe dan wel?' : 'Klopt dit?', reorder ? 'Tik ze op volgorde, je favoriet eerst.' : 'Zo staan deze vijf nu bij je, van hoog naar laag.');
      checkEl.innerHTML = `<ol class="ck-list">${win.map((id, i) => { const c = coaster(id); return `<li data-id="${esc(id)}" class="${reorder ? 'tap' : ''}" style="--i:${i}"><i class="ck-n">${reorder ? '' : i + 1}</i><div class="ck-art">${artFor(c, 120, 80)}</div><div><b>${esc(c.name)}</b><small>${meta(c)}</small></div></li>`; }).join('')}</ol>
        ${reorder ? '<div class="row-btns"><button class="ghost" id="ckback">Terug</button></div>' : '<div class="row-btns"><button class="ghost" id="ckno">Anders</button><button class="btn" id="ckyes">Klopt</button></div>'}`;
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
    fg.querySelector('#ok').onclick = confirm;
    fg.querySelector('#again').onclick = () => { if (ord.length) unpickFrom(ord[0]); };
    fg.querySelector('#undo').onclick = () => {
      if (inCheck || locked) return;
      buzz(5);
      if (ord.length) { unpickFrom(ord[0]); return; }
      const a = undoLast();
      if (!a) { toast('Niets om te herstellen.'); return; }
      progress(); toast(a.type === 'check' ? 'Controle teruggedraaid.' : 'Vorige rij teruggedraaid.');
      if (a.type === 'row') render(shuffle(a.ids)); else render(choose());
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
      fg.querySelector('.lightsout').classList.add('on'); sound.drumroll(.8);
      await Promise.all([endSession(), new Promise(r => setTimeout(r, 750))]);
      go('affiche');
    }

    const key = e => {
      if (e.key === 'Enter' && confirming) { e.preventDefault(); confirm(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); fg.querySelector('#undo').click(); return; }
      if (e.key === 'Escape') { fg.querySelector('#close').click(); return; }
      const n = +e.key; if (n >= 1 && n <= 4 && !inCheck) { const el = line.children[row.indexOf(row[n - 1])]; const card = [...line.children].find(c => c.dataset.id === row[n - 1]); if (card || el) pickCard(card || el); }
    };
    addEventListener('keydown', key);

    sound.liftHill();
    progress();
    render(choose());
    return () => { removeEventListener('keydown', key); timers.forEach(clearTimeout); document.body.classList.remove('ranking'); if (!ended && session.current === s) session.current = null; };
  },
};

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
