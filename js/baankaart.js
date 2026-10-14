// De baankaart: bottom sheet met alles over één baan in iemands lijst.
import { model, me, meKey, otherKey, nameOf, coaster, compsOf, entriesOf, refit, S, emit } from './state.js';
import { coasterInfo } from './model.js';
import { esc, meta, artFor, openSheet, closeSheet, confirmSheet, toast, buzz, dateShort } from './ui.js';

export function openCoaster(id, key = meKey()) {
  const c = coaster(id); if (!c) return;
  const m = model(key); const mine = key === meKey();
  const entry = entriesOf(key).find(e => e.coaster_id === id);
  const info = entry && m ? coasterInfo(m, id, compsOf(key)) : null;
  const otherK = mine ? otherKey() : meKey();
  const om = model(otherK); const oi = om?.idx.get(id);
  const iHave = entriesOf(meKey()).some(e => e.coaster_id === id);

  let body = '';
  body += `<div class="bk-art">${artFor(c, 560, 300)}<div class="bk-cap"><div class="eyebrow">${esc(nameOf(key))}${mine ? '' : ' · alleen lezen'}</div><h2>${esc(c.name)}</h2><div class="mt">${meta(c)}${c.operational === false ? ' · niet meer in gebruik' : ''}</div></div></div>`;
  body += '<div class="sheet-pad">';
  if (info) {
    const n = m.n; const span = Math.max(1, n - 1);
    const lo = (info.lo - 1) / span * 100, hi = (info.hi - 1) / span * 100, at = (info.rank - 1) / span * 100;
    body += `<div class="bk-rank"><div><span class="eyebrow">Plek</span><b>${info.rank}</b><small>van ${n}</small></div>
      <dl class="bk-stats"><div><dt>duels</dt><dd>${info.duels}</dd></div><div><dt>gewonnen</dt><dd>${info.wins.length}</dd></div><div><dt>verloren</dt><dd>${info.losses.length}</dd></div><div><dt>gelijk</dt><dd>${info.ties.length}</dd></div></dl></div>
      <div class="bk-range"><div class="bar"><i style="left:${lo}%;width:${Math.max(1.2, hi - lo)}%"></i><b style="left:${at}%"></b></div>
      <p>${info.lo === info.hi ? `Zeker op plek ${info.rank}.` : `Waarschijnlijk tussen plek ${info.lo} en ${info.hi}.`}</p></div>`;
    const pos = x => m.position[m.idx.get(x)] ?? 9999;
    const uniq = a => [...new Set(a)].filter(x => m.idx.has(x));
    const wins = uniq(info.wins).sort((a, b) => pos(a) - pos(b)).slice(0, 4);
    const losses = uniq(info.losses).sort((a, b) => pos(b) - pos(a)).slice(0, 4);
    const chip = x => `<button class="chip" data-id="${esc(x)}">${esc(coaster(x)?.name || x)} <small>${pos(x) + 1}</small></button>`;
    body += '<section class="bk-why"><h4 class="eyebrow">Waarom hier</h4>';
    if (!info.duels) body += `<p class="sheet-text">Nog geen duels. Deze plek komt uit ${entry.prior_strength < 1 ? 'de plaatsing' : 'je Excel'}.</p>`;
    else {
      if (wins.length) body += `<p class="why-l">Won van</p><div class="chips">${wins.map(chip).join('')}</div>`;
      if (losses.length) body += `<p class="why-l">Verloor van</p><div class="chips">${losses.map(chip).join('')}</div>`;
    }
    body += '</section>';
    const notes = [];
    if (oi !== undefined) notes.push(`Bij ${esc(nameOf(otherK))}: plek ${om.position[oi] + 1} van ${om.n}.`);
    else notes.push(`${esc(nameOf(otherK))} heeft hem nog niet gereden.`);
    if (entry.reridden_at) notes.push(`Herreden op ${dateShort(new Date(entry.reridden_at))}. Oudere duels tellen voor de helft.`);
    body += `<p class="bk-note">${notes.join(' ')}</p>`;
    if (entry.note) body += `<blockquote class="bk-quote">${esc(entry.note)}</blockquote>`;
  } else {
    body += `<p class="sheet-text">${esc(nameOf(key))} heeft deze baan niet op de lijst.${oi !== undefined ? ` Bij ${esc(nameOf(otherK))} staat hij op plek ${om.position[oi] + 1}.` : ''}</p>`;
  }
  body += '<div class="bk-actions">';
  if (mine && entry) body += `<button class="ghost" data-a="reride">${entry.reridden_at ? 'Herreden wissen' : 'Herreden'}</button><button class="ghost" data-a="note">Notitie</button><button class="ghost" data-a="edit">Wijzig</button><button class="ghost danger" data-a="remove">Uit mijn lijst</button>`;
  else body += `<button class="ghost" data-a="edit">Wijzig</button>${iHave ? '' : '<button class="btn" data-a="add">Op mijn lijst zetten</button>'}`;
  body += '</div><div id="bk-form"></div></div>';

  const el = openSheet(body, { cls: 'bk' });
  el.addEventListener('click', async e => {
    const chip = e.target.closest('.chip[data-id]'); if (chip) { openCoaster(chip.dataset.id, key); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; buzz(4);
    const a = b.dataset.a, form = el.querySelector('#bk-form');
    if (a === 'reride') {
      await S.store.upsertEntry({ user_id: me().id, coaster_id: id, reridden_at: entry.reridden_at ? null : new Date().toISOString() });
      await refit(); toast(entry.reridden_at ? 'Herreden gewist.' : 'Gemarkeerd als herreden. Oudere duels met deze baan tellen nu voor de helft.', 3600);
      openCoaster(id, key);
    } else if (a === 'note') {
      form.innerHTML = `<label class="field"><span>Notitie</span><textarea id="nt" maxlength="500" placeholder="Wat moet je onthouden over deze baan?">${esc(entry.note || '')}</textarea></label><div class="row-btns"><button class="btn" id="ntok">Bewaar</button></div>`;
      form.querySelector('#nt').focus();
      form.querySelector('#ntok').onclick = async () => { await S.store.upsertEntry({ user_id: me().id, coaster_id: id, note: form.querySelector('#nt').value.trim() || null }); emit('data'); toast('Notitie bewaard.'); openCoaster(id, key); };
    } else if (a === 'edit') {
      form.innerHTML = coasterForm(c) + '<div class="row-btns"><button class="btn" id="cfok">Bewaar</button></div><p class="fine">De catalogus is gedeeld: dit verandert de baan ook voor ' + esc(nameOf(otherKey())) + '.</p>';
      form.querySelector('#cfok').onclick = async () => {
        const v = readCoasterForm(form); if (!v.name || !v.park) { toast('Naam en park zijn nodig.'); return; }
        await S.store.upsertCoaster({ id, ...v }); emit('data'); toast('Baan bijgewerkt.'); openCoaster(id, key);
      };
    } else if (a === 'remove') {
      if (!(await confirmSheet('Uit je lijst halen?', `${c.name} verdwijnt uit je programma. Je duels blijven bewaard en tellen weer mee als je hem terugzet.`, 'Haal weg', 'Laat staan'))) return;
      await S.store.deleteEntry(me().id, id); await refit(); toast(`${c.name} is van je lijst gehaald.`);
    } else if (a === 'add') {
      closeSheet(); location.hash = '#/toevoegen?id=' + encodeURIComponent(id);
    }
  });
}

export function coasterForm(c = {}) {
  const parks = [...new Set(S.store.data.coasters.map(x => x.park).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const mans = [...new Set(S.store.data.coasters.map(x => x.manufacturer).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<div class="cf">
    <label class="field"><span>Naam</span><input name="name" value="${esc(c.name || '')}" required autocomplete="off"></label>
    <label class="field"><span>Park</span><input name="park" value="${esc(c.park || '')}" list="dl-parks" required autocomplete="off"></label>
    <label class="field"><span>Fabrikant</span><input name="manufacturer" value="${esc(c.manufacturer || '')}" list="dl-mans" autocomplete="off"></label>
    <label class="field"><span>Foto-URL (mag leeg)</span><input name="photo_url" value="${esc(c.photo_url || '')}" inputmode="url" autocomplete="off" placeholder="https://"></label>
    <button type="button" class="tog${c.operational === false ? '' : ' on'}" data-op><i></i>In gebruik</button>
    <datalist id="dl-parks">${parks.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    <datalist id="dl-mans">${mans.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>`;
}
export function readCoasterForm(root) {
  const v = k => root.querySelector(`[name=${k}]`).value.trim();
  return { name: v('name'), park: v('park'), manufacturer: v('manufacturer') || null, photo_url: v('photo_url') || null, operational: root.querySelector('[data-op]').classList.contains('on') };
}
// schakelaar "In gebruik" in het formulier
document.addEventListener('click', e => { const t = e.target.closest('.cf [data-op]'); if (t) t.classList.toggle('on'); });

