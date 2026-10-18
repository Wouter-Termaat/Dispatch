// Nieuwe baan toevoegen: kies uit de catalogus (of voeg een nieuwe toe), gok een plek,
// daarna ~7 plaatsingsduels (binair zoeken). Opslaan met een zwak anker (1/3).
import { warm } from '../photos.js';
import { S, me, meKey, model, coaster, entriesOf, refit } from '../state.js';
import { Placement } from '../model.js';
import { commit } from '../session.js';
import { backdrop } from '../stage.js';
import { rankTop } from './duel.js';
import { esc, meta, cardHtml, buzz, toast, slug, artFor, deal } from '../ui.js';
import { coasterForm, readCoasterForm } from '../baankaart.js';
import * as sound from '../sound.js';

/** Placement met een gok: het eerste duel is tegen de baan op de gokplek. */
class GuessPlacement extends Placement {
  constructor(model, id, guess) { super(model, id); this.guess = Math.max(0, Math.min(this.ranking.length - 1, guess)); }
  next() { if (this.steps === 0 && this.ranking.length) { this.mid = this.guess; return this.ranking[this.mid]; } return super.next(); }
}

export default {
  nav: null, title: 'Baan toevoegen', fast: false,
  mount({ bg, fg, params, go }) {
    document.body.classList.add('ranking');
    backdrop(bg, 'stage');
    fg.innerHTML = `${rankTop('Baan toevoegen', '', 'Terug')}
      <div class="add" id="add"></div>`;
    const root = fg.querySelector('#add');
    fg.querySelector('#close').onclick = () => go('programma');
    const prog = (k, n) => { fg.querySelector('#prog').style.width = (k / n * 100) + '%'; fg.querySelector('#count').textContent = n && k < n ? `duel ${k + 1}` : ''; };
    let keyH = null, alive = true, showT = 0;

    // ---------- 1. kiezen ----------
    function pickStep() {
      prog(0, 0);
      const have = new Set(entriesOf(meKey()).map(e => e.coaster_id));
      const pool = S.store.data.coasters.filter(c => !have.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
      root.innerHTML = `<div class="add-in"><div class="eyebrow">Nieuw op het programma</div><h2 class="h-title">Welke baan?</h2>
        <label class="search"><input class="input" id="q" type="search" placeholder="Zoek in de catalogus" autocomplete="off" enterkeyhint="search"></label>
        <div class="results" id="res"></div>
        <button class="link" id="new">Staat hij er niet tussen? Nieuwe baan in de catalogus ›</button></div>`;
      const q = root.querySelector('#q'), res = root.querySelector('#res');
      const show = () => {
        const n = q.value.trim().toLowerCase();
        const hits = pool.filter(c => !n || c.name.toLowerCase().includes(n) || c.park.toLowerCase().includes(n)).slice(0, 40);
        res.innerHTML = hits.length ? hits.map(c => `<button class="res" data-id="${esc(c.id)}"><div class="ck-art">${artFor(c, 120, 80, { mini: true })}</div><div><b>${esc(c.name)}</b><small>${meta(c)}</small></div></button>`).join('')
          : `<p class="empty">Geen baan gevonden${n ? ` voor “${esc(q.value)}”` : ''}.</p>`;
      };
      q.oninput = show; show(); setTimeout(() => q.focus(), 300);
      res.onclick = e => { const b = e.target.closest('.res'); if (b) { buzz(5); guessStep(b.dataset.id); } };
      root.querySelector('#new').onclick = () => newStep(q.value);
    }

    // ---------- 1b. nieuwe baan in de catalogus ----------
    function newStep(name = '') {
      root.innerHTML = `<div class="add-in"><div class="eyebrow">Catalogus</div><h2 class="h-title">Nieuwe baan</h2>${coasterForm({ name })}
        <div class="row-btns"><button class="ghost" id="back">Terug</button><button class="btn" id="ok">Verder</button></div></div>`;
      root.querySelector('#back').onclick = pickStep;
      root.querySelector('#ok').onclick = async () => {
        const v = readCoasterForm(root); if (!v.name || !v.park) { toast('Naam en park zijn nodig.'); return; }
        const dupe = S.store.data.coasters.find(c => c.name.toLowerCase() === v.name.toLowerCase() && c.park.toLowerCase() === v.park.toLowerCase());
        if (dupe) { toast('Die staat al in de catalogus.'); return guessStep(dupe.id); }
        let id = slug(`${v.name} ${v.park}`) || 'baan'; let k = 2; while (coaster(id)) id = slug(`${v.name} ${v.park}`) + '-' + k++;
        await S.store.upsertCoaster({ id, ...v, created_by: me().id });
        guessStep(id);
      };
    }

    // ---------- 2. gok-plek ----------
    function guessStep(id) {
      const m = model(), c = coaster(id), n = m.n;
      let g = Math.round(n / 2);
      root.innerHTML = `<div class="add-in"><div class="eyebrow">${esc(c.name)}</div><h2 class="h-title">Waar ongeveer?</h2>
        <p class="sheet-text">Een gok is genoeg. Daarna volgen een paar duels die hem precies plaatsen.</p>
        <div class="guess"><b id="gv"></b><input type="range" id="gr" min="1" max="${n + 1}" value="${g}" aria-label="Gok-plek"><p id="gn"></p></div>
        <div class="row-btns"><button class="ghost" id="back">Andere baan</button><button class="btn" id="go">Begin met plaatsen</button></div></div>`;
      const r = root.querySelector('#gr');
      const upd = () => {
        g = +r.value; root.querySelector('#gv').textContent = `Plek ${g}`;
        const above = m.ranking[g - 2], below = m.ranking[g - 1];
        root.querySelector('#gn').innerHTML = !above && !below ? 'je eerste baan' : above && below ? `ongeveer tussen <i>${esc(coaster(above).name)}</i> en <i>${esc(coaster(below).name)}</i>` : above ? `onder <i>${esc(coaster(above).name)}</i>` : `boven <i>${esc(coaster(below).name)}</i>`;
      };
      r.oninput = upd; upd();
      root.querySelector('#back').onclick = pickStep;
      root.querySelector('#go').onclick = () => duelStep(id, g - 1);
    }

    // ---------- 3. plaatsingsduels ----------
    function duelStep(id, guess) {
      const P = new GuessPlacement(model(), id, guess);
      warm([id]);
      const total = Math.ceil(Math.log2(P.ranking.length + 1)) + 1;
      root.innerHTML = `<div class="d-head"><div class="eyebrow">Plaatsing</div></div><div class="d-wrap"><div class="d-stage" id="stage"></div></div>
        <div class="d-foot"><button class="ghost" id="tie">Gelijk</button></div><div class="d-line">Welke vind je beter?</div>`;
      const stage = root.querySelector('#stage'); let busy = false;
      const show = () => {
        const opp = P.next(); if (!opp) return finish(P);
        prog(P.steps, Math.max(total, P.steps + 1)); busy = false;
        stage.innerHTML = cardHtml(coaster(id), 'a enter', 320, 240) + cardHtml(coaster(opp), 'b enter', 320, 240) + '<div class="or">of</div><span class="new-tag">Nieuw</span>';
        const [A, B] = stage.querySelectorAll('.card');
        deal([A, B], { stagger: 60 });
        A.onclick = () => ans('new', A, B); B.onclick = () => ans('old', B, A);
      };
      const ans = (w, win, lose) => {
        if (busy) return; busy = true; P.answer(w); buzz(8); sound.bell();
        if (win) { win.classList.add('win'); lose.classList.add('lose'); }
        showT = setTimeout(() => alive && show(), 250);
      };
      root.querySelector('#tie').onclick = () => ans('tie');
      keyH = e => { if (e.key === 'ArrowUp') ans('new', ...stage.querySelectorAll('.card')); else if (e.key === 'ArrowDown') { const [A, B] = stage.querySelectorAll('.card'); ans('old', B, A); } else if (e.key === ' ') { e.preventDefault(); ans('tie'); } };
      addEventListener('keydown', keyH);
      show();
    }

    // ---------- 4. opslaan ----------
    async function finish(P) {
      removeEventListener('keydown', keyH);
      const id = P.newId;
      await S.store.upsertEntry({ user_id: me().id, coaster_id: id, initial_rank: P.initialRank, prior_strength: 1 / 3, reridden_at: null, note: null });
      if (P.results.length) commit(P.results, 'plaatsing', { type: 'plaatsing', ids: [id] });
      const m = await refit();
      const rank = m.position[m.idx.get(id)] + 1;
      sound.applause(1.2); buzz([10, 40, 10]);
      prog(1, 1);
      root.innerHTML = `<div class="add-in center"><div class="eyebrow">Geplaatst</div><h2 class="h-title">${esc(coaster(id).name)}</h2>
        <div class="placed"><span class="eyebrow">Plek</span><b>${rank}</b><small>van ${m.n}</small></div>
        <p class="sheet-text">Na ${P.steps} ${P.steps === 1 ? 'duel' : 'duels'}. De plek wordt nauwkeuriger naarmate je verder rankt.</p>
        <div class="row-btns"><button class="ghost" id="more">Nog een baan</button><button class="btn" id="prog2">Naar het programma</button></div></div>`;
      root.querySelector('#more').onclick = pickStep;
      root.querySelector('#prog2').onclick = () => go('programma?baan=' + encodeURIComponent(id));
    }

    const pre = params.get('id');
    if (pre && coaster(pre) && !entriesOf(meKey()).some(e => e.coaster_id === pre)) guessStep(pre); else pickStep();
    return () => { alive = false; clearTimeout(showT); document.body.classList.remove('ranking'); if (keyH) removeEventListener('keydown', keyH); };
  },
};
