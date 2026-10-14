// Ranking: je lijst. Slim zoeken (stelt ook parken en fabrikanten voor), één rij snelfilters, sorteren,
// en een uitgebreide weergave met bereik, duels, winst% en de plek bij de ander. Ook Luca's ranking (alleen lezen).
import { model, meKey, nameOf, coaster, catalog, compsOf, entriesOf, mySettings, saveSetting, on, profiles } from '../state.js';
import { groupStats } from '../model.js';
import { esc, meta, openSheet, closeSheet, buzz } from '../ui.js';
import { openCoaster } from '../baankaart.js';
import { backdrop } from '../stage.js';

const VIEW_KEY = 'dispatch.rankview.v2';
const FRESH = () => ({ parks: [], mans: [], top: 0, zeker: '', luca: '', uit: false });
let view = (() => { try { return { tab: 'banen', q: '', sort: 'plek', f: FRESH(), ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }; } catch { return { tab: 'banen', q: '', sort: 'plek', f: FRESH() }; } })();
view.f = { ...FRESH(), ...view.f };
const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ sort: view.sort, f: view.f })); } catch { /* */ } };

const SORTS = [['plek', 'Plek'], ['onzeker', 'Onzekerst eerst'], ['zeker', 'Zekerst eerst'], ['duels', 'Meeste duels'], ['winst', 'Hoogste winst%'], ['luca', 'Grootste verschil met de ander'], ['stijg', 'Stijgers'], ['daal', 'Dalers'], ['naam', 'Naam'], ['park', 'Park']];
function beforeMap(key) { try { return JSON.parse(localStorage.getItem('dispatch.before.' + key) || 'null'); } catch { return null; } }

/** Alle cijfers per baan, één keer per render. */
function rows(key) {
  const m = model(key); if (!m) return [];
  const other = profiles().find(p => p.key !== key)?.key; const om = other && model(other);
  const tally = new Map();
  for (const c of compsOf(key)) {
    if (c.outcome === 'skip') continue;
    for (const [id, w] of [[c.a, c.outcome === 'a'], [c.b, c.outcome === 'b']]) {
      const t = tally.get(id) || { w: 0, l: 0, t: 0 }; if (c.outcome === 'tie') t.t++; else if (w) t.w++; else t.l++; tally.set(id, t);
    }
  }
  const ents = new Map(entriesOf(key).map(e => [e.coaster_id, e]));
  const before = beforeMap(key);
  return m.ranking.map((id, p) => {
    const i = m.idx.get(id), c = coaster(id) || { id, name: id }; const t = tally.get(id) || { w: 0, l: 0, t: 0 };
    const n = t.w + t.l + t.t; const oi = om?.idx.get(id);
    return { id, c, p, lo: m.lo[i] + 1, hi: m.hi[i] + 1, hw: (m.hi[i] - m.lo[i]) / 2, ...t, n, win: n ? (t.w + t.t / 2) / n : null,
      oRank: oi === undefined ? null : om.position[oi] + 1, oN: om?.n, move: before && before[id] !== undefined ? before[id] - p : 0, e: ents.get(id) };
  });
}

export default {
  nav: 'programma', title: 'Ranking',
  mount({ bg, fg, params, go }) {
    view.tab = 'banen'; view.q = '';
    let key = params.get('wie') || meKey();
    if (!profiles().some(p => p.key === key)) key = meKey();
    if (params.get('baan')) { view.tab = 'banen'; view.q = ''; view.f = FRESH(); view.sort = 'plek'; }
    const otherName = () => nameOf(profiles().find(p => p.key !== key)?.key);
    backdrop(bg, 'dim');
    fg.innerHTML = `<div class="page rk-page">
      <header class="p-head">
        <div><div class="eyebrow" id="who"></div><h1 class="h-title big">Ranking</h1></div>
        <div class="pills" id="pers">${profiles().map(p => `<button data-k="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
      </header>
      <nav class="seg tabs" id="seg"><button data-t="banen">Banen</button><button data-t="park">Parken</button><button data-t="manufacturer">Fabrikanten</button></nav>
      <div class="rk-search">
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input class="input" id="q" type="search" placeholder="Zoek baan, park of fabrikant" autocomplete="off" enterkeyhint="search"></label>
        <div class="suggest" id="sugg" hidden></div>
      </div>
      <div class="quick" id="quick"></div>
      <div class="rk-bar"><div class="labels" id="labels"></div>
        <div class="rk-right"><label class="sortsel"><span>Sorteer</span><select id="sort">${SORTS.map(([k, l]) => `<option value="${k}">${k === 'luca' ? 'Grootste verschil met ' + esc(otherName()) : l}</option>`).join('')}</select></label>
        <button class="tool" id="vbtn" aria-label="Uitgebreide weergave" title="Uitgebreide weergave"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span id="vlabel"></span></button></div></div>
      <p class="rk-stats" id="stats"></p>
      <div class="list" id="list"></div>
    </div>`;
    const list = fg.querySelector('#list'), q = fg.querySelector('#q'), sugg = fg.querySelector('#sugg'), sortEl = fg.querySelector('#sort');
    q.value = view.q; sortEl.value = view.sort;
    let R = [];

    const QUICK = () => [
      ['top', 10, 'Top 10'], ['top', 25, 'Top 25'], ['top', 50, 'Top 50'],
      ['zeker', 'onzeker', 'Onzeker'], ['zeker', 'zeker', 'Zeker'],
      ['luca', 'beide', 'Ook bij ' + otherName()], ['luca', 'alleen', 'Alleen ik'], ['uit', true, 'Niet meer in gebruik'],
    ];

    const filtered = () => {
      const f = view.f, needle = view.q.trim().toLowerCase(), m = model(key);
      return R.filter(r => {
        const c = r.c;
        if (needle && !(`${c.name} ${c.park || ''} ${c.manufacturer || ''}`.toLowerCase().includes(needle))) return false;
        if (f.parks.length && !f.parks.includes(c.park)) return false;
        if (f.mans.length && !f.mans.includes(c.manufacturer)) return false;
        if (f.top && r.p >= f.top) return false;
        if (f.zeker === 'zeker' && r.hw > .5) return false;
        if (f.zeker === 'onzeker' && r.hw <= m.stableHW) return false;
        if (f.luca === 'beide' && r.oRank === null) return false;
        if (f.luca === 'alleen' && r.oRank !== null) return false;
        if (f.uit && c.operational !== false) return false;
        return true;
      });
    };
    const gap = r => (r.oRank === null ? -Infinity : (r.p + 1) / model(key).n - r.oRank / r.oN);
    const sorted = arr => {
      const by = { plek: (a, b) => a.p - b.p, onzeker: (a, b) => b.hw - a.hw || a.p - b.p, zeker: (a, b) => a.hw - b.hw || a.p - b.p, duels: (a, b) => b.n - a.n || a.p - b.p,
        winst: (a, b) => (b.win ?? -1) - (a.win ?? -1) || b.n - a.n, luca: (a, b) => Math.abs(gap(b)) - Math.abs(gap(a)), stijg: (a, b) => b.move - a.move || a.p - b.p,
        daal: (a, b) => a.move - b.move || a.p - b.p, naam: (a, b) => a.c.name.localeCompare(b.c.name), park: (a, b) => (a.c.park || '').localeCompare(b.c.park || '') || a.p - b.p }[view.sort] || ((a, b) => a.p - b.p);
      return [...arr].sort(by);
    };

    // suggesties: parken en fabrikanten die op de zoektekst lijken
    function suggest() {
      const needle = view.q.trim().toLowerCase();
      if (view.tab !== 'banen' || needle.length < 2) { sugg.hidden = true; return; }
      const count = field => { const mm = new Map(); R.forEach(r => { const v = r.c[field]; if (v && v.toLowerCase().includes(needle)) mm.set(v, (mm.get(v) || 0) + 1); }); return [...mm].sort((a, b) => b[1] - a[1]).slice(0, 3); };
      const ps = count('park').filter(([v]) => !view.f.parks.includes(v)), ms = count('manufacturer').filter(([v]) => !view.f.mans.includes(v));
      const h = [...ps.map(([v, n]) => `<button data-s="parks" data-v="${esc(v)}"><em>Park</em>${esc(v)}<small>${n}</small></button>`),
        ...ms.map(([v, n]) => `<button data-s="mans" data-v="${esc(v)}"><em>Fabrikant</em>${esc(v)}<small>${n}</small></button>`)].join('');
      sugg.innerHTML = h; sugg.hidden = !h;
    }

    function render() {
      const m = model(key); if (!m) return;
      const mine = key === meKey(), other = profiles().find(p => p.key !== key);
      R = rows(key);
      fg.querySelector('#who').textContent = `${nameOf(key)}${mine ? '' : ' · alleen lezen'}`;
      fg.querySelectorAll('#pers button').forEach(b => b.classList.toggle('on', b.dataset.k === key));
      fg.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === view.tab));
      const ext = mySettings().showCertainty;
      fg.querySelector('#vlabel').textContent = ext ? 'Uitgebreid' : 'Compact';
      fg.querySelector('#vbtn').classList.toggle('on', ext);
      list.classList.toggle('ext', ext);
      const banen = view.tab === 'banen';
      fg.querySelector('#quick').hidden = !banen; fg.querySelector('.rk-bar').hidden = !banen;
      q.placeholder = banen ? 'Zoek baan, park of fabrikant' : view.tab === 'park' ? 'Zoek een park' : 'Zoek een fabrikant';
      // snelfilters en labels
      fg.querySelector('#quick').innerHTML = QUICK().map(([k, v, l]) => `<button class="chip${view.f[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${esc(l)}</button>`).join('');
      const labels = [...view.f.parks.map(v => ['parks', v]), ...view.f.mans.map(v => ['mans', v])];
      fg.querySelector('#labels').innerHTML = labels.map(([k, v]) => `<button class="label" data-k="${k}" data-v="${esc(v)}">${esc(v)}<span aria-label="weghalen">✕</span></button>`).join('')
        + (labels.length || view.f.top || view.f.zeker || view.f.luca || view.f.uit ? '<button class="link" data-k="all">Wis filters</button>' : '');
      suggest();

      if (banen) {
        const shown = sorted(filtered());
        const zeker = shown.filter(r => r.hw <= .5).length;
        fg.querySelector('#stats').innerHTML = shown.length === R.length
          ? `${m.n} banen · ${Math.round(m.certainty * 100)}% zeker · gem. bereik ± ${m.meanHalfWidth.toFixed(1)}`
          : `<b>${shown.length}</b> van ${m.n} banen · ${zeker} zeker`;
        const span = Math.max(1, m.n - 1);
        list.innerHTML = shown.map(r => {
          const cls = r.p === 0 ? 'g' : r.p === 1 ? 's' : r.p === 2 ? 'b' : '';
          const mv = r.move ? `<span class="${r.move > 0 ? 'up' : 'dn'}">${r.move > 0 ? '▲' : '▼'} ${Math.abs(r.move)}</span>` : '';
          const cert = r.hw <= .5 ? 'zeker' : '± ' + Math.round(r.hw);
          const flags = r.e?.note ? '<i title="Notitie">✎</i>' : '';
          const extRow = `<div class="xrow"><span class="rng"><i style="left:${((r.lo - 1) / span * 100).toFixed(1)}%;width:${Math.max(1.5, (r.hi - r.lo) / span * 100).toFixed(1)}%"></i><b style="left:${(r.p / span * 100).toFixed(1)}%"></b></span>
            <span>${r.n ? `${r.w}-${r.l}${r.t ? '-' + r.t : ''} · ${Math.round(r.win * 100)}%` : 'geen duels'}</span>
            <span>${other ? (r.oRank ? `${esc(other.name)} ${r.oRank}` : `${esc(other.name)} niet`) : ''}</span></div>`;
          return `<button class="li ${cls}${r.c.operational === false ? ' closed' : ''}" data-id="${esc(r.id)}"><div class="rk">${r.p + 1}</div>
            <div class="mid"><div class="nm">${esc(r.c.name)} ${flags}</div><div class="pk">${meta(r.c)}</div>${extRow}</div>
            <div class="side">${mv}<span class="cert">${cert}</span></div></button>`;
        }).join('') || `<p class="empty">Geen banen gevonden. <button class="link" data-k="all">Wis filters</button></p>`;
        if (mine) list.insertAdjacentHTML('beforeend', '<div class="list-end"><button class="ghost" id="add">Baan toevoegen</button></div>');
        list.querySelector('#add')?.addEventListener('click', () => go('toevoegen'));
      } else {
        const field = view.tab, needle = view.q.trim().toLowerCase();
        const stats = groupStats(m, catalog(), field);
        fg.querySelector('#stats').textContent = `${stats.length} ${field === 'park' ? 'parken' : 'fabrikanten'}, op volgorde van hoe hoog hun banen staan.`;
        list.innerHTML = stats.filter(g => !needle || g.name.toLowerCase().includes(needle)).map((g, k) => {
          const rs = R.filter(r => (r.c[field] || '?').trim() === g.name);
          const avg = rs.reduce((s, r) => s + r.p + 1, 0) / rs.length;
          const z = rs.filter(r => r.hw <= .5).length;
          const cls = k === 0 ? 'g' : k === 1 ? 's' : k === 2 ? 'b' : '';
          return `<button class="li ${cls}" data-g="${esc(g.name)}"><div class="rk">${k + 1}</div><div class="mid"><div class="nm">${esc(g.name)}</div>
            <div class="pk">${g.count} ${g.count === 1 ? 'baan' : 'banen'} · beste: ${esc(coaster(g.best)?.name || '')}${g.operational < g.count ? ` · ${g.count - g.operational} dicht` : ''}</div></div>
            <div class="side"><span class="avg">gem. plek ${Math.round(avg)}</span><span class="cert">${z ? z + ' zeker' : ''}</span></div></button>`;
        }).join('') || `<p class="empty">Niets gevonden.</p>`;
      }
    }

    const clearAll = () => { view.f = FRESH(); view.q = ''; q.value = ''; };
    list.addEventListener('click', e => {
      if (e.target.closest('[data-k=all]')) { clearAll(); saveView(); render(); return; }
      const li = e.target.closest('.li'); if (!li) return; buzz(4);
      if (li.dataset.id) openCoaster(li.dataset.id, key);
      else if (li.dataset.g) openGroup(li.dataset.g, view.tab, key);
    });
    fg.querySelector('#quick').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return; buzz(3);
      const k = b.dataset.k, raw = b.dataset.v, v = k === 'top' ? +raw : k === 'uit' ? true : raw;
      view.f[k] = view.f[k] === v ? FRESH()[k] : v;
      saveView(); list.scrollTop = 0; render();
    };
    fg.querySelector('#labels').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      if (b.dataset.k === 'all') clearAll(); else view.f[b.dataset.k] = view.f[b.dataset.k].filter(x => x !== b.dataset.v);
      saveView(); render();
    };
    sugg.onclick = e => {
      const b = e.target.closest('[data-s]'); if (!b) return; buzz(4);
      view.f[b.dataset.s].push(b.dataset.v); view.q = ''; q.value = '';
      saveView(); list.scrollTop = 0; render();
    };
    sortEl.onchange = () => { view.sort = sortEl.value; saveView(); list.scrollTop = 0; render(); };
    fg.querySelector('#seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; view.tab = b.dataset.t; view.q = ''; q.value = ''; saveView(); list.scrollTop = 0; render(); };
    fg.querySelector('#pers').onclick = e => { const b = e.target.closest('button'); if (!b) return; key = b.dataset.k; list.scrollTop = 0; render(); };
    fg.querySelector('#vbtn').onclick = () => { buzz(4); saveSetting({ showCertainty: !mySettings().showCertainty }); };
    let qt = 0; q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { view.q = q.value; render(); }, 80); };
    q.onkeydown = e => { if (e.key === 'Enter') { const first = sugg.querySelector('[data-s]'); if (first && !sugg.hidden) { e.preventDefault(); first.click(); } q.blur(); } };

    render();
    const hl = params.get('baan');
    if (hl) requestAnimationFrame(() => { const el = list.querySelector(`[data-id="${CSS.escape(hl)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } });
    return on(w => { if (w === 'model' || w === 'settings' || w === 'data') render(); });
  },
};

function openGroup(name, field, key) {
  const m = model(key);
  const ids = m.ranking.filter(id => (coaster(id)?.[field] || '?').trim() === name);
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">${field === 'park' ? 'Park' : 'Fabrikant'} · ${esc(nameOf(key))}</div><h3 class="h-title">${esc(name)}</h3>
    <div class="mini-list">${ids.map(id => { const c = coaster(id); const p = m.position[m.idx.get(id)]; return `<button class="li" data-id="${esc(id)}"><div class="rk">${p + 1}</div><div class="mid"><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div><div></div></button>`; }).join('')}</div>
    ${field === 'park' && key === meKey() && ids.length >= 2 ? `<div class="row-btns"><button class="btn" id="pa">Park-avond: ${esc(name)}</button></div>` : ''}</div>`);
  body.addEventListener('click', e => { const li = e.target.closest('.li'); if (li) openCoaster(li.dataset.id, key); });
  body.querySelector('#pa')?.addEventListener('click', () => { closeSheet(); location.hash = '#/duel?mode=park&park=' + encodeURIComponent(name); });
}
