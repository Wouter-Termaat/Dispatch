// La Rangée: vier banen naast elkaar. Sleep ze op volgorde (favoriet links, plek 1), de nummers lopen mee, en bevestig.
import { warm } from '../photos.js';
import { model, compsOf, meKey, coaster, mySettings } from '../state.js';
import { rowToComparisons } from '../model.js';
import { startSession, commit, undoLast, endSession, abandonSession, filterFromParams, labelFromParams, Tempo, session } from '../session.js';
import { backdrop } from '../stage.js';
import { pickRow } from '../pick.js';
import { cardHtml, esc, buzz, pick, toast, deal } from '../ui.js';
import { GENOTEERD, TITANEN, TRIMREM } from '../copy.js';
import { rankTop } from './duel.js';
import * as sound from '../sound.js';

export default {
  nav: null, title: 'La Rangée',
  async mount({ bg, fg, params, go }) {
    const m0 = model();
    const filter = filterFromParams(params);
    const mode = params.get('mode') === 'twijfel' ? 'twijfel' : 'normal';
    const cmode = params.get('mode') === 'twijfel' ? 'twijfel' : params.get('mode') === 'park' ? 'park' : 'rangee';
    const label = labelFromParams(params, 'La Rangée');
    const allowed = filter ? m0.ids.filter(filter).length : m0.n;
    if (allowed < 4) { toast('Te weinig banen voor een rij. We doen duels.'); setTimeout(() => go('duel?' + params.toString()), 10); return; }
    document.body.classList.add('ranking');
    const s = startSession('rangee', { mode: cmode, label, filter, length: mySettings().rowLength });

    backdrop(bg, 'stage');
    const Q = ['Sleep op volgorde', 'Je favoriet naar links, op plek 1. Klopt het? Bevestig.'];
    fg.innerHTML = `${rankTop(label, s.length)}
      <div class="r-q"><h2 id="rh">${Q[0]}</h2><p id="rp">${Q[1]}</p></div>
      <div class="r-stage"><div class="r-line ranked" id="line"></div></div>
      <div class="r-flash" id="flash">Genoteerd</div>
      <div class="foot r-foot"><button class="ghost" id="undo">Herstel</button><button class="ghost" id="skip">Sla over</button><button class="btn" id="ok">Bevestig</button></div>
      <div class="d-line"><span class="keys">Slepen of ← → verplaatsen · Enter bevestigt · Backspace herstelt</span></div>
      <div class="clash" id="clash"><b>${esc(TITANEN.titel)}</b><span></span></div>
      <div class="lightsout"></div>`;
    const line = fg.querySelector('#line'), flash = fg.querySelector('#flash');
    const prog = fg.querySelector('#prog'), count = fg.querySelector('#count');
    const tempo = new Tempo(.35, 3);   // per kaart; pas onder ~1,4 s per rij gaat Trimrem aan
    // order: de kaarten in hun huidige volgorde (plek 1 links). shown: hoe de rij binnenkwam (voor het logboek)
    let row = null, order = [], shown = [], moves = 0, shownAt = 0, locked = false, ended = false, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const HINT = 'dispatch.hint.sleep';

    const pos = i => `calc(${i} * ((100% - 24px) / 4 + 8px))`;
    // Herstel kan pas als er in deze ronde een rij te herstellen is
    const progress = () => { count.textContent = `${s.rows} van ${s.length}`; prog.style.width = Math.min(100, s.rows / s.length * 100) + '%'; fg.querySelector('#undo').disabled = !s.actions.some(a => a.type !== 'skip'); };
    const choose = () => pickRow(model(), compsOf(meKey()), { size: 4, filter, mode });

    // nummers 1 tot 4 volgen altijd de plek; een nummer dat verandert, springt even op
    function numbers() {
      order.forEach((el, i) => {
        const n = el.querySelector('.num'), v = String(i + 1);
        el.dataset.place = v; el.setAttribute('aria-label', `${coaster(el.dataset.id)?.name || ''}, plek ${v} van 4`);
        if (n.textContent === v) return;
        n.textContent = v; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
      });
    }
    const place = (skip = null) => order.forEach((c, i) => { if (c !== skip) c.style.left = pos(i); });

    function render(ids) {
      row = ids; locked = false; moves = 0;
      // in willekeurige volgorde binnen: nooit de volgorde van het model laten zien (anders sleep je die alleen maar na)
      shown = shuffle(ids);
      line.innerHTML = shown.map(id => cardHtml(coaster(id), 'enter', 120, 350)).join('');
      order = [...line.children];
      order.forEach(el => {
        el.insertAdjacentHTML('afterbegin', '<i class="spot"></i>');
        el.addEventListener('pointerdown', e => grab(e, el));
        el.onkeydown = e => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(el, e.key === 'ArrowLeft' ? -1 : 1); }
        };
      });
      place(); numbers();
      deal(order, { stagger: 45, slow: tempo.slow });
      shownAt = performance.now();
      // de allereerste keer even laten zien dat de kaarten schuiven
      let seen = true; try { seen = !!localStorage.getItem(HINT); } catch { /* */ }
      if (!seen) later(() => { if (!moves && order[1]) order[1].classList.add('nudge'); }, 900);
      const top = model().ranking.slice(0, 2);
      if (top.every(t => ids.includes(t))) { const c = fg.querySelector('#clash'); c.querySelector('span').textContent = pick(TITANEN.sub); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); sound.whoosh(); }
    }

    function moved() { moves++; numbers(); sound.tick(); buzz(3); try { localStorage.setItem(HINT, '1'); } catch { /* */ } line.querySelector('.nudge')?.classList.remove('nudge'); }

    // met het toetsenbord: de kaart met focus een plek opschuiven
    function step(el, d) {
      if (locked) return;
      const from = order.indexOf(el), to = from + d; if (to < 0 || to > 3) return;
      order.splice(from, 1); order.splice(to, 0, el); place(); moved(); el.focus({ preventScroll: true });
    }

    // slepen: de kaart volgt de vinger of muis, de rest schuift opzij zodra hij over het midden van een plek komt
    function grab(e, el) {
      if (locked || e.button > 0 || el.classList.contains('enter')) return;
      const W = line.clientWidth, cw = (W - 24) / 4, slot = cw + 8, x0 = e.clientX, start = order.indexOf(el) * slot;
      let dragging = false, lastX = x0, lastT = performance.now(), vx = 0;
      // geen ingebouwd slepen van de foto (dat breekt de muis af) en geen tekstselectie
      if (e.pointerType === 'mouse') { e.preventDefault(); el.focus({ preventScroll: true }); }
      try { el.setPointerCapture(e.pointerId); } catch { /* */ }
      const move = ev => {
        const dx = ev.clientX - x0;
        if (!dragging) {
          if (Math.abs(dx) < 6) return;
          dragging = true; el.classList.add('dragging'); line.classList.add('dragging'); el.querySelector('.spot')?.classList.add('hot'); buzz(4);
        }
        const left = Math.max(-cw * .3, Math.min(W - cw + cw * .3, start + dx));
        el.style.left = left + 'px';
        // een beetje kantelen in de richting van de beweging
        const now = performance.now(); vx = vx * .75 + ((ev.clientX - lastX) / Math.max(8, now - lastT)) * .25; lastX = ev.clientX; lastT = now;
        el.style.setProperty('--ry', Math.max(-16, Math.min(16, vx * 22)).toFixed(1) + 'deg');
        const to = Math.max(0, Math.min(3, Math.round(left / slot))), from = order.indexOf(el);
        if (to !== from) { order.splice(from, 1); order.splice(to, 0, el); place(el); moved(); }
      };
      const up = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (!dragging) return;
        el.classList.remove('dragging'); line.classList.remove('dragging'); el.style.removeProperty('--ry'); el.querySelector('.spot')?.classList.remove('hot');
        el.style.left = pos(order.indexOf(el));
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }

    function confirm() {
      if (locked || order.length !== 4 || line.querySelector('.dragging')) return;
      locked = true;
      const ms = performance.now() - shownAt;
      const ordered = order.map(e => e.dataset.id);
      commit(rowToComparisons(ordered), cmode, { ms, type: 'row', ids: ordered, meta: { moves, shown } });
      sound.confirm(); buzz(10);
      order.forEach(e => e.classList.add('win'));
      flash.textContent = pick(GENOTEERD); flash.classList.add('show');
      progress();
      if (tempo.add(ms / 1000 / 4)) toast(`${TRIMREM.titel}. ${TRIMREM.sub}`, 2600);
      const finished = s.rows >= s.length;
      const next = !finished ? choose() : null;   // direct kiezen met het vorige model; de nieuwe fit loopt in de worker
      warm(next);
      later(() => {
        flash.classList.remove('show');
        if (finished) return finish();
        render(next || choose());
      }, tempo.slow ? 560 : 300);
    }

    // ---------- knoppen ----------
    fg.querySelector('#ok').onclick = confirm;
    fg.querySelector('#undo').onclick = () => {
      if (locked) return;
      buzz(5);
      const a = undoLast();
      if (!a) { toast('Niets om te herstellen.'); return; }
      progress(); toast('Vorige rij teruggedraaid.');
      render(a.type === 'row' ? a.ids : choose());
    };
    fg.querySelector('#skip').onclick = () => {
      if (locked) return;
      buzz(4);
      commit(rowToComparisons(row).map(c => ({ ...c, outcome: 'skip' })), cmode, { type: 'skip', ids: row });
      render(choose());
    };
    fg.querySelector('#close').onclick = () => (s.actions.some(a => a.type !== 'skip') ? finish() : (abandonSession('gestopt'), go('')));

    async function finish() {
      if (ended) return; ended = true; locked = true;
      fg.querySelector('.lightsout').classList.add('on'); sound.drumroll(.8);
      await Promise.all([endSession(), new Promise(r => setTimeout(r, 750))]);
      go('affiche');
    }

    const key = e => {
      if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); confirm(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); fg.querySelector('#undo').click(); return; }
      if (e.key === 'Escape') { fg.querySelector('#close').click(); return; }
    };
    addEventListener('keydown', key);

    sound.liftHill();
    progress();
    const first = choose(); await warm(first, 350); if (fg.isConnected && !fg.closest('.out')) render(first);
    return () => { removeEventListener('keydown', key); timers.forEach(clearTimeout); document.body.classList.remove('ranking'); if (!ended && session.current === s) abandonSession(); };
  },
};

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
