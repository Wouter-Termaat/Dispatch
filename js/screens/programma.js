// Programma: rustige lijst van je ranking. Tabs Banen, Parken, Fabrikanten. Ook Luca's programma (alleen lezen).
import { model, meKey, nameOf, coaster, catalog, mySettings, saveSetting, on, profiles } from '../state.js';
import { groupStats } from '../model.js';
import { esc, meta, openSheet, buzz } from '../ui.js';
import { openCoaster } from '../baankaart.js';

let view = { key: null, tab: 'banen', q: '' };

function beforeMap(key) { try { return JSON.parse(localStorage.getItem('dispatch.before.' + key) || 'null'); } catch { return null; } }

export default {
  nav: 'programma', title: 'Programma',
  light: { fogH: .25, fog: .6, beams: [{ x: .15, y: 1.1, a: Math.PI - .35, w: .09, i: .25, sway: .08 }] },
  mount({ bg, fg, params, go }) {
    view.key = params.get('wie') || meKey();
    if (!profiles().some(p => p.key === view.key)) view.key = meKey();
    if (params.get('baan')) { view.tab = 'banen'; view.q = ''; }
    bg.innerHTML = '<div class="theatre dim"></div>';
    fg.innerHTML = `<div class="page">
      <header class="p-head">
        <div><div class="eyebrow" id="who"></div><h1 class="h-title big">Programma</h1></div>
        <div class="p-tools">
          <div class="pills" id="pers">${profiles().map(p => `<button data-k="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
          <button class="tog" id="cert"><i></i>Zekerheid</button>
        </div>
      </header>
      <div class="p-bar">
        <nav class="seg" id="seg"><button data-t="banen">Banen</button><button data-t="park">Parken</button><button data-t="manufacturer">Fabrikanten</button></nav>
        <label class="search"><input class="input" id="q" type="search" placeholder="Zoek op naam of park" autocomplete="off" enterkeyhint="search"></label>
      </div>
      <div class="list" id="list"></div>
    </div>`;
    const list = fg.querySelector('#list'), q = fg.querySelector('#q');
    q.value = view.q;

    function render() {
      const key = view.key, m = model(key); if (!m) return;
      const mine = key === meKey();
      fg.querySelector('#who').textContent = `${nameOf(key)} · ${m.n} banen${mine ? '' : ' · alleen lezen'}`;
      fg.querySelectorAll('#pers button').forEach(b => b.classList.toggle('on', b.dataset.k === key));
      fg.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === view.tab));
      const showCert = mySettings().showCertainty;
      fg.querySelector('#cert').classList.toggle('on', showCert);
      list.classList.toggle('showcert', showCert);
      const needle = view.q.trim().toLowerCase();
      const match = c => !needle || c.name.toLowerCase().includes(needle) || (c.park || '').toLowerCase().includes(needle) || (c.manufacturer || '').toLowerCase().includes(needle);

      if (view.tab === 'banen') {
        const before = mine ? beforeMap(key) : null;
        let h = '';
        m.ranking.forEach((id, p) => {
          const c = coaster(id); if (!c || !match(c)) return;
          const i = m.idx.get(id); const hw = (m.hi[i] - m.lo[i]) / 2;
          const cls = p === 0 ? 'g' : p === 1 ? 's' : p === 2 ? 'b' : '';
          let mv = '';
          if (before && before[id] !== undefined && before[id] !== p) { const d = before[id] - p; mv = `<div class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲ ' + d : '▼ ' + -d}</div>`; }
          h += `<button class="li ${cls}${c.operational === false ? ' closed' : ''}" data-id="${esc(id)}"><div class="rk">${p + 1}</div><div><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div>
            <div class="side">${mv}<div class="cert">${hw <= .5 ? 'zeker' : '± ' + Math.round(hw)}</div></div></button>`;
        });
        list.innerHTML = (h || `<p class="empty">Niets gevonden voor “${esc(view.q)}”.</p>`) + (mine ? '<div class="list-end"><button class="ghost" id="add">Baan toevoegen</button></div>' : '');
        list.querySelector('#add')?.addEventListener('click', () => go('toevoegen'));
      } else {
        const stats = groupStats(m, catalog(), view.tab);
        let h = '';
        stats.forEach((g, k) => {
          if (needle && !g.name.toLowerCase().includes(needle)) return;
          const ids = m.ids.filter(id => (coaster(id)?.[view.tab] || '?').trim() === g.name);
          const avg = ids.reduce((s, id) => s + m.position[m.idx.get(id)] + 1, 0) / ids.length;
          const cls = k === 0 ? 'g' : k === 1 ? 's' : k === 2 ? 'b' : '';
          h += `<button class="li ${cls}" data-g="${esc(g.name)}"><div class="rk">${k + 1}</div><div><div class="nm">${esc(g.name)}</div>
            <div class="pk">${g.count} ${g.count === 1 ? 'baan' : 'banen'} · beste: ${esc(coaster(g.best)?.name || '')}</div></div><div class="side"><div class="avg">gem. plek ${Math.round(avg)}</div></div></button>`;
        });
        list.innerHTML = h || `<p class="empty">Niets gevonden.</p>`;
      }
    }

    list.addEventListener('click', e => {
      const li = e.target.closest('.li'); if (!li) return; buzz(4);
      if (li.dataset.id) openCoaster(li.dataset.id, view.key);
      else if (li.dataset.g) openGroup(li.dataset.g, view.tab, view.key);
    });
    fg.querySelector('#seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; view.tab = b.dataset.t; list.scrollTop = 0; render(); };
    fg.querySelector('#pers').onclick = e => { const b = e.target.closest('button'); if (!b) return; view.key = b.dataset.k; list.scrollTop = 0; render(); };
    fg.querySelector('#cert').onclick = () => { buzz(4); saveSetting({ showCertainty: !mySettings().showCertainty }); };
    let qt = 0; q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { view.q = q.value; render(); }, 80); };

    render();
    const hl = params.get('baan');
    if (hl) requestAnimationFrame(() => { const el = list.querySelector(`[data-id="${CSS.escape(hl)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } });
    const off = on(w => { if (w === 'model' || w === 'settings' || w === 'data') render(); });
    return off;
  },
};

function openGroup(name, field, key) {
  const m = model(key);
  const ids = m.ranking.filter(id => (coaster(id)?.[field] || '?').trim() === name);
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">${field === 'park' ? 'Park' : 'Fabrikant'} · ${nameOf(key)}</div><h3 class="h-title">${esc(name)}</h3>
    <div class="mini-list">${ids.map(id => { const c = coaster(id); const p = m.position[m.idx.get(id)]; return `<button class="li" data-id="${esc(id)}"><div class="rk">${p + 1}</div><div><div class="nm">${esc(c.name)}</div><div class="pk">${meta(c)}</div></div><div></div></button>`; }).join('')}</div></div>`);
  body.addEventListener('click', e => { const li = e.target.closest('.li'); if (li) openCoaster(li.dataset.id, key); });
}

