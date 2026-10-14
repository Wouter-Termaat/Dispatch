// Ranking: je lijst, met filters, sorteren en (uitgebreid) per baan bereik, duels, winst% en Luca's plek.
// Tabs Banen, Parken, Fabrikanten. Ook Luca's ranking (alleen lezen).
import { model, meKey, nameOf, coaster, catalog, compsOf, entriesOf, mySettings, saveSetting, on, profiles } from '../state.js';
import { groupStats } from '../model.js';
import { esc, meta, openSheet, closeSheet, buzz } from '../ui.js';
import { openCoaster } from '../baankaart.js';
import { backdrop } from '../stage.js';

const VIEW_KEY = 'dispatch.rankview';
const FRESH = () => ({ parks: [], mans: [], status: 'alle', zeker: 'alle', luca: 'alle', from: '', to: '', reride: false, note: false, moved: false, nodu: false });
let view = (() => { try { return { tab: 'banen', q: '', sort: 'plek', f: FRESH(), ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }; } catch { return { tab: 'banen', q: '', sort: 'plek', f: FRESH() }; } })();
view.f = { ...FRESH(), ...view.f };
const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ tab: view.tab, sort: view.sort, f: view.f })); } catch { /* */ } };

const SORTS = [['plek', 'Plek'], ['onzeker', 'Onzekerst'], ['zeker', 'Zekerst'], ['duels', 'Meeste duels'], ['winst', 'Winst%'], ['luca', 'Verschil met de ander'], ['stijg', 'Stijgers'], ['daal', 'Dalers'], ['naam', 'Naam'], ['park', 'Park']];
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
    let key = params.get('wie') || meKey();
    if (!profiles().some(p => p.key === key)) key = meKey();
    if (params.get('baan')) { view.tab = 'banen'; view.q = ''; view.f = FRESH(); view.sort = 'plek'; }
    backdrop(bg, 'dim');
    fg.innerHTML = `<div class="page rk-page">
      <header class="p-head">
        <div><div class="eyebrow" id="who"></div><h1 class="h-title big">Ranking</h1></div>
        <div class="pills" id="pers">${profiles().map(p => `<button data-k="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
      </header>
      <nav class="seg tabs" id="seg"><button data-t="banen">Banen</button><button data-t="park">Parken</button><button data-t="manufacturer">Fabrikanten</button></nav>
      <div class="rk-tools">
        <label class="search"><input class="input" id="q" type="search" placeholder="Zoek op naam, park of fabrikant" autocomplete="off" enterkeyhint="search"></label>
        <div class="rk-btns" id="btns">
          <button class="tool" id="fbtn"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filters<b id="fcount"></b></button>
          <button class="tool" id="sbtn"><svg viewBox="0 0 24 24"><path d="M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3"/></svg><span id="slabel">Plek</span></button>
          <button class="tool" id="vbtn" aria-label="Uitgebreide weergave"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span id="vlabel">Compact</span></button>
        </div>
      </div>
      <div class="chips active" id="active"></div>
      <p class="rk-stats" id="stats"></p>
      <div class="list" id="list"></div>
    </div>`;
    const list = fg.querySelector('#list'), q = fg.querySelector('#q');
    q.value = view.q;
    let R = [];

    const filtered = () => {
      const f = view.f, needle = view.q.trim().toLowerCase();
      const from = +f.from || 1, to = +f.to || Infinity;
      return R.filter(r => {
        const c = r.c;
        if (needle && !(`${c.name} ${c.park || ''} ${c.manufacturer || ''}`.toLowerCase().includes(needle))) return false;
        if (f.parks.length && !f.parks.includes(c.park)) return false;
        if (f.mans.length && !f.mans.includes(c.manufacturer)) return false;
        if (f.status === 'aan' && c.operational === false) return false;
        if (f.status === 'uit' && c.operational !== false) return false;
        if (f.zeker === 'zeker' && r.hw > .5) return false;
        if (f.zeker === 'onzeker' && r.hw <= model(key).stableHW) return false;
        if (f.luca === 'beide' && r.oRank === null) return false;
        if (f.luca === 'alleen' && r.oRank !== null) return false;
        if (r.p + 1 < from || r.p + 1 > to) return false;
        if (f.reride && !r.e?.reridden_at) return false;
        if (f.note && !r.e?.note) return false;
        if (f.moved && !r.move) return false;
        if (f.nodu && r.n) return false;
        return true;
      });
    };
    const sorted = list => {
      const by = { plek: (a, b) => a.p - b.p, onzeker: (a, b) => b.hw - a.hw || a.p - b.p, zeker: (a, b) => a.hw - b.hw || a.p - b.p, duels: (a, b) => b.n - a.n || a.p - b.p,
        winst: (a, b) => (b.win ?? -1) - (a.win ?? -1) || b.n - a.n, luca: (a, b) => Math.abs(gap(b)) - Math.abs(gap(a)), stijg: (a, b) => b.move - a.move || a.p - b.p,
        daal: (a, b) => a.move - b.move || a.p - b.p, naam: (a, b) => a.c.name.localeCompare(b.c.name), park: (a, b) => (a.c.park || '').localeCompare(b.c.park || '') || a.p - b.p }[view.sort];
      return [...list].sort(by);
    };
    const otherName = () => nameOf(profiles().find(p => p.key !== key)?.key);
    const gap = r => (r.oRank === null ? -Infinity : (r.p + 1) / (model(key).n) - r.oRank / r.oN);

    function activeChips() {
      const f = view.f, out = [];
      f.parks.forEach(v => out.push(['parks', v, v])); f.mans.forEach(v => out.push(['mans', v, v]));
      if (f.status !== 'alle') out.push(['status', '', f.status === 'aan' ? 'In gebruik' : 'Niet meer in gebruik']);
      if (f.zeker !== 'alle') out.push(['zeker', '', f.zeker === 'zeker' ? 'Zeker' : 'Onzeker']);
      if (f.luca !== 'alle') out.push(['luca', '', f.luca === 'beide' ? 'Ook gereden door de ander' : 'Alleen bij ' + nameOf(key)]);
      if (f.from || f.to) out.push(['range', '', `Plek ${f.from || 1} tot ${f.to || 'eind'}`]);
      if (f.reride) out.push(['reride', '', 'Herreden']); if (f.note) out.push(['note', '', 'Met notitie']);
      if (f.moved) out.push(['moved', '', 'Verschoven']); if (f.nodu) out.push(['nodu', '', 'Nog nooit vergeleken']);
      return out;
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
      fg.querySelector('#btns').hidden = false;
      fg.querySelector('#fbtn').hidden = fg.querySelector('#sbtn').hidden = view.tab !== 'banen';
      fg.querySelector('#slabel').textContent = view.sort === 'luca' ? 'Verschil met ' + otherName() : SORTS.find(s => s[0] === view.sort)?.[1] || 'Plek';
      const chips = view.tab === 'banen' ? activeChips() : [];
      fg.querySelector('#fcount').textContent = chips.length ? chips.length : '';
      fg.querySelector('#active').innerHTML = chips.map(([k, v, l]) => `<button class="chip on" data-k="${k}" data-v="${esc(v)}">${esc(l)} <span aria-hidden="true">✕</span></button>`).join('') + (chips.length > 1 ? '<button class="link" data-k="all">Wis alles</button>' : '');

      if (view.tab === 'banen') {
        const shown = sorted(filtered());
        const zeker = shown.filter(r => r.hw <= .5).length;
        const parks = new Map(); shown.forEach(r => parks.set(r.c.park, (parks.get(r.c.park) || 0) + 1));
        const topPark = [...parks].sort((a, b) => b[1] - a[1])[0];
        fg.querySelector('#stats').innerHTML = shown.length === R.length
          ? `${m.n} banen · ${Math.round(m.certainty * 100)}% zeker · gem. bereik ± ${m.meanHalfWidth.toFixed(1)}${topPark ? ` · meeste uit ${esc(topPark[0])}` : ''}`
          : `<b>${shown.length}</b> van ${m.n} banen · ${zeker} zeker${topPark ? ` · meeste uit ${esc(topPark[0])} (${topPark[1]})` : ''}`;
        const span = Math.max(1, m.n - 1);
        list.innerHTML = shown.map(r => {
          const cls = r.p === 0 ? 'g' : r.p === 1 ? 's' : r.p === 2 ? 'b' : '';
          const mv = r.move ? `<span class="${r.move > 0 ? 'up' : 'dn'}">${r.move > 0 ? '▲' : '▼'} ${Math.abs(r.move)}</span>` : '';
          const cert = r.hw <= .5 ? 'zeker' : '± ' + Math.round(r.hw);
          const flags = (r.e?.reridden_at ? '<i title="Herreden">↻</i>' : '') + (r.e?.note ? '<i title="Notitie">✎</i>' : '');
          const extRow = `<div class="xrow"><span class="rng"><i style="left:${((r.lo - 1) / span * 100).toFixed(1)}%;width:${Math.max(1.5, (r.hi - r.lo) / span * 100).toFixed(1)}%"></i><b style="left:${(r.p / span * 100).toFixed(1)}%"></b></span>
            <span>${r.n ? `${r.w}-${r.l}${r.t ? '-' + r.t : ''} · ${Math.round(r.win * 100)}%` : 'geen duels'}</span>
            <span>${other ? (r.oRank ? `${esc(other.name)} ${r.oRank}` : `${esc(other.name)} niet`) : ''}</span></div>`;
          return `<button class="li ${cls}${r.c.operational === false ? ' closed' : ''}" data-id="${esc(r.id)}"><div class="rk">${r.p + 1}</div>
            <div class="mid"><div class="nm">${esc(r.c.name)} ${flags}</div><div class="pk">${meta(r.c)}</div>${extRow}</div>
            <div class="side">${mv}<span class="cert">${cert}</span></div></button>`;
        }).join('') || `<p class="empty">Geen banen met deze filters.</p>`;
        if (mine) list.insertAdjacentHTML('beforeend', '<div class="list-end"><button class="ghost" id="add">Baan toevoegen</button></div>');
        list.querySelector('#add')?.addEventListener('click', () => go('toevoegen'));
      } else {
        const field = view.tab, needle = view.q.trim().toLowerCase();
        const stats = groupStats(m, catalog(), field);
        fg.querySelector('#stats').textContent = `${stats.length} ${field === 'park' ? 'parken' : 'fabrikanten'}, gesorteerd op hoe hoog hun banen staan.`;
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

    list.addEventListener('click', e => {
      const li = e.target.closest('.li'); if (!li) return; buzz(4);
      if (li.dataset.id) openCoaster(li.dataset.id, key);
      else if (li.dataset.g) openGroup(li.dataset.g, view.tab, key);
    });
    fg.querySelector('#active').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k, v = b.dataset.v, f = view.f;
      if (k === 'all') view.f = FRESH();
      else if (k === 'parks' || k === 'mans') f[k] = f[k].filter(x => x !== v);
      else if (k === 'range') { f.from = ''; f.to = ''; }
      else if (['status', 'zeker', 'luca'].includes(k)) f[k] = 'alle'; else f[k] = false;
      saveView(); render();
    };
    fg.querySelector('#seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; view.tab = b.dataset.t; saveView(); list.scrollTop = 0; render(); };
    fg.querySelector('#pers').onclick = e => { const b = e.target.closest('button'); if (!b) return; key = b.dataset.k; list.scrollTop = 0; render(); };
    fg.querySelector('#vbtn').onclick = () => { buzz(4); saveSetting({ showCertainty: !mySettings().showCertainty }); };
    fg.querySelector('#sbtn').onclick = () => {
      const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Sorteren</div><h3 class="h-title">Volgorde van de lijst</h3>
        <div class="opt-list">${SORTS.map(([k, l]) => `<button class="opt${k === view.sort ? ' on' : ''}" data-s="${k}">${k === 'luca' ? 'Verschil met ' + esc(otherName()) : l}</button>`).join('')}</div></div>`);
      body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { view.sort = b.dataset.s; saveView(); closeSheet(); list.scrollTop = 0; render(); });
    };
    fg.querySelector('#fbtn').onclick = () => openFilters(key, () => { saveView(); list.scrollTop = 0; render(); });
    let qt = 0; q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { view.q = q.value; render(); }, 80); };

    render();
    const hl = params.get('baan');
    if (hl) requestAnimationFrame(() => { const el = list.querySelector(`[data-id="${CSS.escape(hl)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } });
    return on(w => { if (w === 'model' || w === 'settings' || w === 'data') render(); });
  },
};

function openFilters(key, apply) {
  const f = JSON.parse(JSON.stringify(view.f));
  const ents = entriesOf(key).map(e => coaster(e.coaster_id)).filter(Boolean);
  const count = field => { const m = new Map(); ents.forEach(c => c[field] && m.set(c[field], (m.get(c[field]) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
  const parks = count('park'), mans = count('manufacturer');
  const seg = (name, opts) => `<div class="pills wide" data-f="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${f[name] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (name, l) => `<button class="tog${f[name] ? ' on' : ''}" data-t="${name}"><i></i>${l}</button>`;
  const body = openSheet(`<div class="sheet-pad filters">
    <div class="eyebrow">Filters</div><h3 class="h-title">Wat wil je zien?</h3>
    <h4>Plek</h4><div class="range"><input class="input" type="number" min="1" id="from" placeholder="van" value="${esc(f.from)}"><span>tot</span><input class="input" type="number" min="1" id="to" placeholder="tot en met" value="${esc(f.to)}">
      <div class="chips"><button class="chip" data-top="10">Top 10</button><button class="chip" data-top="25">Top 25</button><button class="chip" data-top="50">Top 50</button></div></div>
    <h4>Status</h4>${seg('status', [['alle', 'Alle'], ['aan', 'In gebruik'], ['uit', 'Niet meer']])}
    <h4>Zekerheid</h4>${seg('zeker', [['alle', 'Alle'], ['zeker', 'Zeker'], ['onzeker', 'Onzeker']])}
    <h4>De ander</h4>${seg('luca', [['alle', 'Alle'], ['beide', 'Ook gereden'], ['alleen', 'Alleen ik']])}
    <h4>Extra</h4><div class="togs">${tog('reride', 'Herreden')}${tog('note', 'Met notitie')}${tog('moved', 'Verschoven sinds vorige sessie')}${tog('nodu', 'Nog nooit vergeleken')}</div>
    <h4>Park</h4><div class="chips" data-m="parks">${parks.map(([p, n]) => `<button class="chip${f.parks.includes(p) ? ' on' : ''}" data-v="${esc(p)}">${esc(p)} <small>${n}</small></button>`).join('')}</div>
    <h4>Fabrikant</h4><div class="chips" data-m="mans">${mans.map(([p, n]) => `<button class="chip${f.mans.includes(p) ? ' on' : ''}" data-v="${esc(p)}">${esc(p)} <small>${n}</small></button>`).join('')}</div>
    <div class="row-btns sticky"><button class="ghost" id="clear">Wis alles</button><button class="btn" id="apply">Toon resultaat</button></div></div>`);
  body.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const segEl = t.closest('[data-f]'), multi = t.closest('[data-m]');
    if (segEl) { f[segEl.dataset.f] = t.dataset.v; segEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); }
    else if (multi) { const arr = f[multi.dataset.m]; const v = t.dataset.v; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); t.classList.toggle('on'); }
    else if (t.dataset.t) { f[t.dataset.t] = !f[t.dataset.t]; t.classList.toggle('on'); }
    else if (t.dataset.top) { body.querySelector('#from').value = 1; body.querySelector('#to').value = t.dataset.top; }
    else if (t.id === 'clear') { Object.assign(f, FRESH()); view.f = f; closeSheet(); apply(); return; }
    else if (t.id === 'apply') { f.from = body.querySelector('#from').value; f.to = body.querySelector('#to').value; view.f = f; closeSheet(); apply(); return; }
    buzz(3);
  });
}

function openGroup(name, field, key) {
  const m = model(key);
  const ids = m.ranking.filter(id => (coaster(id)?.[field] || '?').trim() === name);
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">${field === 'park' ? 'Park' : 'Fabrikant'} · ${esc(nameOf(key))}</div><h3 class="h-title">${esc(name)}</h3>
    <div class="mini-list">${ids.map(id => { const c = coaster(id); const p = m.position[m.idx.get(id)]; return `<button class="li" data-id="${esc(id)}"><div class="rk">${p + 1}</div><div class="mid"><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div><div></div></button>`; }).join('')}</div>
    ${field === 'park' && key === meKey() && ids.length >= 2 ? `<div class="row-btns"><button class="btn" id="pa">Park-avond: ${esc(name)}</button></div>` : ''}</div>`);
  body.addEventListener('click', e => { const li = e.target.closest('.li'); if (li) openCoaster(li.dataset.id, key); });
  body.querySelector('#pa')?.addEventListener('click', () => { closeSheet(); location.hash = '#/duel?mode=park&park=' + encodeURIComponent(name); });
}
