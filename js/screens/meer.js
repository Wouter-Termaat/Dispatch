// Meer: instellingen, export, baan toevoegen, achter de schermen, ticketjes, uitloggen.
import { S, me, meKey, nameOf, mySettings, saveSetting, model, catalog, compsOf, profiles, profileByKey, on } from '../state.js';
import { esc, toast, buzz, openSheet, closeSheet, confirmSheet } from '../ui.js';
import { TICKETS, WITTE_STIP } from '../copy.js';

const pills = (name, opts, cur) => `<div class="pills" data-set="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;

export default {
  nav: 'meer', title: 'Meer',
  light: { fogH: .25, fog: .6, beams: [{ x: .85, y: 1.1, a: Math.PI + .35, w: .09, i: .25, sway: .08 }] },
  mount({ bg, fg, go }) {
    bg.innerHTML = '<div class="theatre dim"></div>';
    const demo = S.store.kind === 'demo';

    function render() {
      const st = mySettings(); const n = compsOf(meKey()).filter(c => c.outcome !== 'skip').length;
      const pend = S.store.pending;
      fg.innerHTML = `<div class="page"><div class="meer">
        <header><div class="eyebrow">${esc(me().name)}${demo ? ' · demo' : ''}</div><h1 class="h-title big">Meer</h1></header>

        <section class="m-sec"><h2 class="eyebrow">Instellingen <button class="stip${st.musicUnlocked ? ' found' : ''}" id="stip" aria-label="Een witte stip"></button></h2>
          <div class="m-row"><div><b>Ankersterkte</b><small>Hoe zwaar je startvolgorde (je Excel) meetelt.</small></div>${pills('anchorDuels', [[1, 'Licht'], [3, 'Gemiddeld'], [8, 'Sterk']], st.anchorDuels)}</div>
          <div class="m-row"><div><b>Sessielengte</b><small>Rijen of duels per voorstelling.</small></div>${pills('sessionLength', [[8, '8'], [12, '12'], [20, '20']], st.sessionLength)}</div>
          <div class="m-row"><div><b>Geluid</b><small>Stationsbel, liftheuvel en applaus.</small></div><button class="tog${st.sound ? ' on' : ''}" data-tog="sound"><i></i>${st.sound ? 'Aan' : 'Uit'}</button></div>
          <div class="m-row"><div><b>Zekerheid tonen</b><small>Het bereik per baan in het programma.</small></div><button class="tog${st.showCertainty ? ' on' : ''}" data-tog="showCertainty"><i></i>${st.showCertainty ? 'Aan' : 'Uit'}</button></div>
          ${st.musicUnlocked ? `<div class="m-row"><div><b>Achtergrondmuziek</b><small>Spotify, in een kleine speler die blijft staan.</small></div>${pills('music', [['none', 'Geen'], ['wittestip', 'Witte Stip.']], st.music)}</div>` : ''}
        </section>

        <section class="m-sec"><h2 class="eyebrow">Voorstelling</h2>
          <button class="m-link" id="add"><b>Baan toevoegen</b><small>Uit de catalogus of helemaal nieuw, met plaatsingsduels.</small><em>›</em></button>
          <button class="m-link" id="xls"><b>Exporteer naar Excel</b><small>Je lijst in je eigen format, met formules en al.</small><em>›</em></button>
          <button class="m-link" id="achter"><b>Achter de schermen</b><small>Waarom Dispatch werkt zoals het werkt.</small><em>›</em></button>
        </section>

        <section class="m-sec"><h2 class="eyebrow">Ticketjes</h2><p class="m-count">${n} vergelijkingen tot nu toe.</p>
          <div class="tickets">${TICKETS.map(t => `<div class="tk${n >= t.at ? ' got' : ''}"><span class="eyebrow">${t.at}</span><b>${esc(t.naam)}</b><small>${n >= t.at ? esc(t.tekst) : `Nog ${t.at - n} te gaan.`}</small></div>`).join('')}</div>
        </section>

        <section class="m-sec"><h2 class="eyebrow">Kassa</h2>
          <p class="m-count">${demo ? 'Demomodus: alles blijft in deze browser.' : pend ? `${pend} ${pend === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} op verbinding.` : 'Alles is opgeslagen.'}</p>
          <div class="row-btns left">${demo ? '<button class="ghost" id="switch">Wissel van profiel</button><button class="ghost danger" id="reset">Demo opnieuw</button>' : '<button class="ghost" id="logout">Uitloggen</button>'}</div>
        </section>
        <p class="m-foot">Dispatch · Cabaret des Montagnes Russes</p>
      </div></div>`;
    }
    render();

    fg.addEventListener('click', async e => {
      const pill = e.target.closest('.pills[data-set] button');
      if (pill) {
        const k = pill.parentElement.dataset.set; const raw = pill.dataset.v; const v = isNaN(+raw) ? raw : +raw;
        buzz(4); await saveSetting({ [k]: v });
        if (k === 'anchorDuels') toast('Ankersterkte aangepast. Je ranking wordt opnieuw berekend.');
        return;
      }
      const tog = e.target.closest('[data-tog]');
      if (tog) { buzz(4); await saveSetting({ [tog.dataset.tog]: !mySettings()[tog.dataset.tog] }); return; }
      const id = e.target.closest('button')?.id; if (!id) return;
      if (id === 'stip') {
        buzz([6, 40, 6]);
        if (!mySettings().musicUnlocked) { await saveSetting({ musicUnlocked: true, music: 'wittestip' }); toast(`${WITTE_STIP.titel} ${WITTE_STIP.sub}.`); (await import('../music.js')).openMusic(); }
        else toast(WITTE_STIP.titel);
      }
      else if (id === 'add') go('toevoegen');
      else if (id === 'achter') go('achter');
      else if (id === 'xls') exportSheet();
      else if (id === 'logout') { if (await confirmSheet('Uitloggen?', 'Je moet daarna opnieuw je kaartje laten zien.', 'Uitloggen', 'Blijf')) { await S.store.signOut(); go('login'); } }
      else if (id === 'switch') { await S.store.signOut(); go('login'); }
      else if (id === 'reset') { if (await confirmSheet('Demo opnieuw beginnen?', 'Alle demovergelijkingen in deze browser worden gewist.', 'Begin opnieuw', 'Laat maar')) { localStorage.clear(); location.reload(); } }
    });

    const off = on(w => { if (w === 'settings' || w === 'model' || w === 'data') render(); });
    return off;
  },
};

function canShareFiles() {
  try { return !!navigator.canShare?.({ files: [new File(['x'], 'x.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] }); } catch { return false; }
}

function exportSheet() {
  const body = openSheet(`<div class="sheet-pad"><div class="eyebrow">Excel</div><h3 class="h-title">Welke lijst?</h3>
    <p class="sheet-text">In de huidige volgorde, in het eigen format, met formules.</p>
    <div class="pills xls-who">${profiles().map(p => `<button data-k="${esc(p.key)}" class="${p.key === meKey() ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
    <div class="row-btns">${canShareFiles() ? '<button class="ghost" data-x="share">Delen of in Drive</button>' : ''}<button class="btn" data-x="dl">Downloaden</button></div>
    ${canShareFiles() ? '<p class="fine">Delen opent het deelmenu van je telefoon. Kies daar Opslaan in Drive (of mail, WhatsApp).</p>' : '<p class="fine">Wil je hem in Google Drive? Sleep het gedownloade bestand naar drive.google.com.</p>'}</div>`);
  let key = meKey();
  body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { key = b.dataset.k; body.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); });
  body.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const p = profileByKey(key); const m = model(key); const label = b.textContent;
    b.disabled = true; b.textContent = 'Even inpakken';
    try {
      const { exportExcel } = await import('../export.js');
      const file = await exportExcel({ key, name: p.name, dynamics: p.dynamics, ranking: m.ranking, catalog: catalog(), share: b.dataset.x === 'share' });
      if (file) { closeSheet(); toast(`${file} staat klaar.`); } else { b.disabled = false; b.textContent = label; }
    } catch (err) { console.error(err); toast('De export lukte niet. Probeer het opnieuw.'); b.disabled = false; b.textContent = label; }
  });
}
