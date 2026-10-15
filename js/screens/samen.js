// Samen: Wouter & Luca. Smaakmatch als boog van lampjes, plagerige kaarten, gezamenlijke ranking, verlanglijst.
import { model, catalog, coaster, nameOf, meKey, on, profiles, entriesOf } from '../state.js';
import { compare } from '../model.js';
import { esc, meta, pick, buzz, reduceMotion } from '../ui.js';
import { ROAST, fill } from '../copy.js';
import { openCoaster } from '../baankaart.js';
import { dot } from '../stippen.js';

const AN = 27; let tab = 'verhalen';

import { backdrop } from '../stage.js';

export default {
  nav: 'samen', title: 'Samen',
  mount({ bg, fg }) {
    backdrop(bg, 'dim');
    const A = 'wouter', B = 'luca';
    if (!model(A) || !model(B) || !entriesOf(A).length || !entriesOf(B).length) {
      fg.innerHTML = `<div class="page center-msg"><h1 class="h-title">Samen</h1><p class="sheet-text">Er zijn twee lijsten nodig om te vergelijken.</p></div>`; return;
    }
    fg.innerHTML = `<div class="page samen">
      <header class="c-head"><h1>${esc(nameOf(A))}<em>&amp;</em>${esc(nameOf(B))}</h1><div class="eyebrow" id="shared"></div></header>
      <button class="arc" id="arc" aria-label="Smaakmatch opnieuw afspelen"><svg viewBox="0 0 250 140" id="arcsvg"></svg><div class="pct"><b id="pct">0%</b><span class="eyebrow">smaakmatch</span></div>${dot('boog', 'arcdot', 'span')}</button>
      <nav class="seg center" id="seg"><button data-t="verhalen">Verhalen</button><button data-t="samen">Gezamenlijk</button><button data-t="bucket">Nog te rijden</button></nav>
      <div class="notes-c" id="notes"></div></div>`;
    const svg = fg.querySelector('#arcsvg'), pctEl = fg.querySelector('#pct'), notes = fg.querySelector('#notes');
    let s = '';
    for (let i = 0; i < AN; i++) { const a = Math.PI - (i / (AN - 1)) * Math.PI, x = 125 + 108 * Math.cos(a), y = 124 - 108 * Math.sin(a); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="#3a2a44"/>`; }
    svg.innerHTML = s;
    let C = null, timers = [];

    function playArc() {
      timers.forEach(clearTimeout); timers = [];
      const cs = [...svg.querySelectorAll('circle')]; const P = (C.match ?? 0) / 100; const n = Math.round(AN * P);
      cs.forEach(c => { c.setAttribute('fill', '#3a2a44'); c.style.filter = 'none'; });
      if (reduceMotion()) { cs.slice(0, n).forEach(c => c.setAttribute('fill', '#ffe3a8')); pctEl.textContent = Math.round(P * 100) + '%'; return; }
      pctEl.textContent = '0%';
      cs.forEach((c, i) => { if (i < n) timers.push(setTimeout(() => { c.setAttribute('fill', '#ffe3a8'); c.style.filter = 'drop-shadow(0 0 5px rgba(255,200,110,.95))'; pctEl.textContent = Math.round((i + 1) / n * P * 100) + '%'; if (i % 3 === 0) buzz(2); }, 300 + Math.pow(i / n, 1.6) * 1600)); });
      if (!n) pctEl.textContent = Math.round(P * 100) + '%';
    }

    const nm = id => `<button class="nl" data-id="${esc(id)}">${esc(coaster(id)?.name || id)}</button>`;
    function stories() {
      const a = nameOf(A), b = nameOf(B), out = [];
      const vars = { a, b };
      if (C.bothTop.length) out.push(['Eensgezind', fill(pick(ROAST.eensgezind), { ...vars, baan: nm(C.bothTop[0]) })]);
      else {
        const close = C.disagreements.filter(d => d.rankA <= 25 && d.rankB <= 25).sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap) || (x.rankA + x.rankB) - (y.rankA + y.rankB))[0];
        if (close) out.push(['Eensgezind', fill(pick(ROAST.eensgezindBijna), { ...vars, baan: nm(close.id), plekA: close.rankA, plekB: close.rankB })]);
      }
      const tw = C.disagreements[0];
      if (tw) { const aHigh = tw.rankA < tw.rankB; out.push(['De grootste twist', fill(pick(ROAST.twist), { baan: nm(tw.id), hoog: aHigh ? a : b, laag: aHigh ? b : a, plekHoog: Math.min(tw.rankA, tw.rankB), plekLaag: Math.max(tw.rankA, tw.rankB) })]); }
      // geheime liefdes: baan die de ander veel lager zet
      const loveB = C.disagreements.filter(d => d.gap < 0 && d.id !== tw?.id)[0];
      const loveA = C.disagreements.filter(d => d.gap > 0 && d.id !== tw?.id)[0];
      const gen = n => (/[aeiouy]$/i.test(n) ? n + "'s" : n + 's');
      if (loveB) out.push([`${gen(b)} geheime liefde`, fill(pick(ROAST.geheimeLiefde), { baan: nm(loveB.id), wie: b, ander: a, verschil: loveB.rankA - loveB.rankB })]);
      if (loveA) out.push([`${gen(a)} geheime liefde`, fill(pick(ROAST.geheimeLiefde), { baan: nm(loveA.id), wie: a, ander: b, verschil: loveA.rankB - loveA.rankA })]);
      if (C.bucketA[0]) out.push([`Nog te rijden, ${a}`, fill(pick(ROAST.bucket), { baan: nm(C.bucketA[0]), wie: a, ander: b })]);
      if (C.bucketB[0]) out.push([`Nog te rijden, ${b}`, fill(pick(ROAST.bucket), { baan: nm(C.bucketB[0]), wie: b, ander: a })]);
      const pm = C.perManufacturer.filter(x => x.manufacturer && x.manufacturer !== '?');
      if (pm.length) out.push(['Per fabrikant', fill(pick(ROAST.fabrikantEens), { fabrikant: esc(pm[0].manufacturer), pct: pm[0].match }) + (pm.length > 1 ? ' ' + fill(pick(ROAST.fabrikantOneens), { fabrikant: esc(pm[pm.length - 1].manufacturer), pct: pm[pm.length - 1].match }) : '')]);
      return out.map(([t, p], i) => `<div class="note" style="--i:${i}"><div class="eyebrow">${esc(t)}</div><p>${p}</p></div>`).join('');
    }
    function joint() {
      const mA = model(A), mB = model(B);
      return `<p class="sheet-text">${C.shared.length} gedeelde banen, op jullie gemiddelde score.</p><div class="mini-list">` + C.joint.map((id, k) => {
        const c = coaster(id); const cls = k === 0 ? 'g' : k === 1 ? 's' : k === 2 ? 'b' : '';
        return `<button class="li ${cls}" data-id="${esc(id)}"><div class="rk">${k + 1}</div><div><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div>
          <div class="side duo"><span>${esc(nameOf(A)[0])} ${mA.position[mA.idx.get(id)] + 1}</span><span>${esc(nameOf(B)[0])} ${mB.position[mB.idx.get(id)] + 1}</span></div></button>`;
      }).join('') + '</div>';
    }
    function bucket() {
      const block = (who, other, ids) => `<h3 class="eyebrow b-h">Voor ${esc(nameOf(who))}: ${ids.length} ${ids.length === 1 ? 'baan' : 'banen'} van ${esc(nameOf(other))}</h3>` + (ids.length
        ? `<div class="mini-list">${ids.map(id => { const c = coaster(id); const om = model(other); return `<button class="li" data-id="${esc(id)}" data-k="${other}"><div class="rk">${om.position[om.idx.get(id)] + 1}</div><div><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div><div></div></button>`; }).join('')}</div>`
        : `<p class="sheet-text">Niets. ${esc(nameOf(who))} heeft alles van ${esc(nameOf(other))} al gereden.</p>`);
      return block(A, B, C.bucketA) + block(B, A, C.bucketB);
    }
    function render(replay = false) {
      C = compare(model(A), model(B), catalog());
      // nog te rijden: alles van de ander dat jij nog niet hebt (niet alleen de top 30), op hun volgorde
      C.bucketA = model(B).ranking.filter(id => !model(A).idx.has(id));
      C.bucketB = model(A).ranking.filter(id => !model(B).idx.has(id));
      fg.querySelector('#shared').textContent = `${C.shared.length} banen samen gereden`;
      fg.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
      notes.innerHTML = tab === 'verhalen' ? stories() : tab === 'samen' ? joint() : bucket();
      if (replay) playArc(); else { const P = C.match ?? 0; pctEl.textContent = P + '%'; [...svg.querySelectorAll('circle')].forEach((c, i) => { const on = i < Math.round(AN * P / 100); c.setAttribute('fill', on ? '#ffe3a8' : '#3a2a44'); c.style.filter = on ? 'drop-shadow(0 0 5px rgba(255,200,110,.95))' : 'none'; }); }
    }
    fg.querySelector('#arc').onclick = () => { buzz(4); playArc(); };
    fg.querySelector('#seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; notes.scrollTop = 0; render(); };
    notes.addEventListener('click', e => {
      const t = e.target.closest('[data-id]'); if (!t) return; buzz(4);
      const id = t.dataset.id; const key = t.dataset.k || (entriesOf(meKey()).some(x => x.coaster_id === id) ? meKey() : profiles().find(p => entriesOf(p.key).some(x => x.coaster_id === id))?.key);
      openCoaster(id, key || meKey());
    });
    render(true);
    const off = on(w => { if (w === 'model' || w === 'data') render(); });
    return () => { off(); timers.forEach(clearTimeout); };
  },
};
