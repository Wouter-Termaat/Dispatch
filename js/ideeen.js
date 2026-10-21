// De ideeënbus: een brievenbus linksonder op elk scherm. Wouter en Luca posten er ideeën en bugs in en zien samen wat erin zit.
// In een sessie met Claude gaan we de bus langs; status en antwoord staan in de tabel ideas (sql/ideeen.sql).
// Bij een briefje gaat vanzelf mee op welk scherm je zat en op welk apparaat, zodat een bug terug te vinden is.
import { S, me, meKey, profileById, on } from './state.js';
import { openSheet, closeSheet, esc, uuid, toast, reduceMotion, buzz } from './ui.js';
import { track, APP_VERSION } from './track.js';
import * as sound from './sound.js';

const BOX = '<svg class="ib-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V9.5a7 7 0 0 1 14 0V21z"/><path d="M8.5 10.5h7"/><rect x="9.5" y="14" width="5" height="3.2" rx=".6"/><path d="M3.5 21h17"/></svg>';
const BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z"/></svg>';
const BUG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.5a3 3 0 0 1 6 0"/><rect x="7" y="7.5" width="10" height="12" rx="5"/><path d="M12 11v8.5M3 13.5h4M17 13.5h4M4.5 8l2.8 2.2M19.5 8l-2.8 2.2M4.5 19.5l2.8-2M19.5 19.5l-2.8-2"/></svg>';

const KINDS = {
  idee: { t: 'Idee', sub: 'Iets nieuws of iets beters', icon: BULB, q: 'Wat is je idee?', ph: 'Bijvoorbeeld: een spelvorm waarin je alleen banen van één park speelt...' },
  bug: { t: 'Bug', sub: 'Er klopt iets niet', icon: BUG, q: 'Wat ging er mis?', ph: 'Wat deed je, wat gebeurde er, en wat had je verwacht?' },
};
const STATUS = [['nieuw', 'Nieuw'], ['gepland', 'Op de planning'], ['gedaan', 'Gedaan'], ['niet', 'Niet gedaan']];
const MAX = 1000;
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

let btn = null, draft = { kind: 'idee', text: '' };
const ideas = () => S.store?.data.ideas || [];
const seenKey = () => 'dispatch.ideas.seen.' + meKey();
const getSeen = () => { try { return localStorage.getItem(seenKey()) || ''; } catch { return ''; } };
const setSeen = () => { try { localStorage.setItem(seenKey(), new Date().toISOString()); } catch { /* geen opslag */ } };

/** Nieuw voor jou: briefjes van de ander die je nog niet zag, en je eigen briefjes die intussen een andere status kregen. */
function unseen() {
  const u = me(); if (!u) return 0; const seen = getSeen();
  return ideas().filter(x => (x.user_id !== u.id ? x.created_at > seen : x.status !== 'nieuw' && (x.updated_at || '') > seen)).length;
}

export function initIdeas() {
  btn = document.createElement('button');
  btn.className = 'ib-btn'; btn.id = 'ideabtn'; btn.setAttribute('aria-label', 'Ideeënbus'); btn.title = 'Ideeënbus';
  btn.innerHTML = `${BOX}<b class="ib-badge" hidden></b>`;
  document.getElementById('app').appendChild(btn);
  btn.onclick = () => openBus();
  on(w => { if (w === 'data' || w === 'settings') refreshIdeas(); });
  S.store.addEventListener('change', e => { if (/idea/i.test(e.detail?.t || '')) refreshIdeas(); });
  refreshIdeas();
}

/** Knop tonen (alleen ingelogd) en het rode cijfertje bijwerken. */
export function refreshIdeas() {
  if (!btn) return;
  btn.hidden = !me() || S.store.needsLogin;
  const n = unseen(), b = btn.querySelector('.ib-badge');
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  btn.setAttribute('aria-label', n ? `Ideeënbus, ${n} nieuw` : 'Ideeënbus');
}

function context(screen) {
  const nav = navigator;
  return {
    screen, version: APP_VERSION, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, touch: matchMedia('(pointer: coarse)').matches,
    platform: nav.userAgentData?.platform || (/(iPhone|iPad|Android|Windows|Mac)/.exec(nav.userAgent) || [])[1] || 'onbekend',
    browser: (/(Edg|Chrome|Firefox|Safari)\//.exec(nav.userAgent) || [])[1] || 'onbekend',
    standalone: matchMedia('(display-mode: standalone)').matches || nav.standalone === true, online: nav.onLine,
  };
}
const device = c => [c.browser === 'Edg' ? 'Edge' : c.browser, c.platform].filter(x => x && x !== 'onbekend').join(' op ');

function when(iso) {
  const d = new Date(iso), t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (days === 0) return 'vandaag'; if (days === 1) return 'gisteren';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

export function openBus(tab = 'post') {
  const screen = document.title.split(' · ')[0] || 'Dispatch';
  let filter = 'alles', fresh = null;
  const body = openSheet(`<div class="sheet-pad ib">
      <div class="ib-head"><span class="ib-box" id="ibbox">${BOX}</span><div><div class="eyebrow">Brievenbus</div><h3 class="h-title">De ideeënbus</h3></div></div>
      <p class="sheet-text">Iets bedacht, of iets kapot? Post het hier. Wouter en Claude gaan de bus af en toe samen langs, en dan zie je hier wat ermee gebeurt.</p>
      <div class="seg ib-tabs" role="tablist"><button role="tab" data-t="post">Posten</button><button role="tab" data-t="bus">In de bus <i id="ibn"></i></button></div>
      <div class="ib-pane" id="ibpane"></div></div>`, { cls: 'ib-sheet', onClose: () => refreshIdeas() });

  const pane = body.querySelector('#ibpane');
  const setTab = t => {
    tab = t;
    body.querySelectorAll('.ib-tabs button').forEach(b => { const o = b.dataset.t === t; b.classList.toggle('on', o); b.setAttribute('aria-selected', o); });
    if (t === 'post') renderPost(); else { renderBus(); setSeen(); refreshIdeas(); }
  };
  body.querySelector('.ib-tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); };
  const count = () => { const n = ideas().filter(x => x.status === 'nieuw' || x.status === 'gepland').length; body.querySelector('#ibn').textContent = n || ''; };

  function renderPost() {
    const k = KINDS[draft.kind], c = context(screen);
    pane.innerHTML = `<div class="ib-kinds" role="radiogroup" aria-label="Soort briefje">${Object.entries(KINDS).map(([key, v]) =>
        `<button role="radio" class="ib-kind k-${key}" data-k="${key}" aria-checked="${key === draft.kind}">${v.icon}<b>${v.t}</b><small>${v.sub}</small></button>`).join('')}</div>
      <label class="field ib-field"><span>${k.q}</span><textarea id="ibtext" maxlength="${MAX}" rows="4" placeholder="${esc(k.ph)}">${esc(draft.text)}</textarea></label>
      <div class="ib-under"><span class="ib-ctx">${draft.kind === 'bug' ? `Gaat vanzelf mee: scherm ${esc(screen)}, ${esc(device(c) || 'je apparaat')}, ${APP_VERSION}.` : `Gepost vanaf ${esc(screen)}.`}</span><span class="ib-count" id="ibcount"></span></div>
      <button class="btn ib-send" id="ibsend">Post in de bus <span aria-hidden="true">›</span></button>`;
    const ta = pane.querySelector('#ibtext'), send = pane.querySelector('#ibsend');
    const upd = () => { draft.text = ta.value; const n = ta.value.trim().length; send.disabled = n < 3; pane.querySelector('#ibcount').textContent = ta.value.length > MAX * .8 ? `${ta.value.length}/${MAX}` : ''; };
    ta.oninput = upd; upd();
    pane.querySelector('.ib-kinds').onclick = e => { const b = e.target.closest('[data-k]'); if (!b || b.dataset.k === draft.kind) return; draft.kind = b.dataset.k; renderPost(); pane.querySelector('#ibtext').focus(); };
    send.onclick = () => post(ta, send);
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => ta.focus({ preventScroll: true }), 350);
  }

  async function post(ta, send) {
    const text = ta.value.trim(); if (text.length < 3) return;
    send.disabled = true;
    const row = { id: uuid(), user_id: me().id, kind: draft.kind, text: text.slice(0, MAX), status: 'nieuw', reply: null, context: context(screen), created_at: new Date().toISOString() };
    await flyLetter(ta);
    S.store.addIdea(row);
    track('idea', { kind: row.kind, len: row.text.length, screen });
    sound.confirm(); buzz(8);
    draft = { kind: draft.kind, text: '' }; fresh = row.id;
    toast(row.kind === 'bug' ? 'In de bus. Dank je, we zoeken het uit.' : 'In de bus. Dank je voor je idee!');
    count(); setTab('bus');
  }

  // het briefje vliegt als envelopje in de gleuf van de brievenbus bovenin
  async function flyLetter(from) {
    const box = body.querySelector('#ibbox');
    if (reduceMotion() || !box) return;
    const a = from.getBoundingClientRect(), b = box.getBoundingClientRect();
    const env = document.createElement('i'); env.className = 'ib-env';
    env.style.left = a.left + a.width / 2 - 36 + 'px'; env.style.top = a.top + a.height / 2 - 24 + 'px';
    document.body.appendChild(env); from.classList.add('sent');
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height * .42 - (a.top + a.height / 2);
    sound.swoosh();
    await env.animate([
      { transform: 'translate(0,0) scale(.6) rotate(0deg)', opacity: 0 },
      { transform: 'translate(0,-14px) scale(1) rotate(-4deg)', opacity: 1, offset: .25 },
      { transform: `translate(${dx}px,${dy}px) scale(.22) rotate(8deg)`, opacity: 1, offset: .9 },
      { transform: `translate(${dx}px,${dy + 6}px) scale(.12) rotate(8deg)`, opacity: 0 },
    ], { duration: 720, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.catch(() => {});
    env.remove();
    box.classList.remove('gulp'); void box.offsetWidth; box.classList.add('gulp');
  }

  function renderBus() {
    const u = me(), all = ideas(), seen = getSeen();
    const n = k => all.filter(x => k === 'alles' || x.kind === k).length;
    const list = all.filter(x => filter === 'alles' || x.kind === filter).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    const groups = STATUS.map(([s, t]) => [s, t, list.filter(x => (x.status || 'nieuw') === s)]).filter(g => g[2].length);
    pane.innerHTML = `<div class="ib-bar"><div class="pills" id="ibf">${[['alles', 'Alles'], ['idee', 'Ideeën'], ['bug', 'Bugs']].map(([k, t]) =>
        `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${t} <i>${n(k)}</i></button>`).join('')}</div>
        ${all.length ? '<button class="link ib-copy" id="ibcopy">Kopieer voor Claude</button>' : ''}</div>
      ${groups.length ? groups.map(([s, t, xs]) => `<section class="ib-group s-${s}"><h4 class="eyebrow">${t} <i>${xs.length}</i></h4>${xs.map(x => card(x, u, seen)).join('')}</section>`).join('')
        : `<div class="ib-empty">${BOX}<p>${all.length ? 'Hier zit nog niets in.' : 'De bus is nog leeg.'}</p><button class="link" id="ibfirst">Post het eerste briefje ›</button></div>`}`;
    pane.querySelector('#ibf').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderBus(); } };
    pane.querySelector('#ibfirst')?.addEventListener('click', () => setTab('post'));
    pane.querySelector('#ibcopy')?.addEventListener('click', copyAll);
    pane.querySelectorAll('.ib-card').forEach(el => {
      el.querySelector('.ib-main').onclick = () => { const o = !el.classList.contains('open'); pane.querySelectorAll('.ib-card.open').forEach(x => x.classList.remove('open')); el.classList.toggle('open', o); el.querySelector('.ib-main').setAttribute('aria-expanded', o); };
      el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
        const s = b.dataset.s; if (s === el.dataset.s) return;
        S.store.setIdea(el.dataset.id, { status: s, updated_at: new Date().toISOString() });
        track('idea_status', { id: el.dataset.id, status: s }); sound.select();
        fresh = el.dataset.id; renderBus(); count();
      });
      const del = el.querySelector('[data-del]');
      if (del) del.onclick = () => {
        if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'Zeker? Tik nog eens'; setTimeout(() => { if (del.isConnected) { del.classList.remove('sure'); del.textContent = 'Terughalen'; } }, 3000); return; }
        S.store.deleteIdea(el.dataset.id); track('idea_delete', { id: el.dataset.id });
        renderBus(); count();
      };
    });
    if (fresh) { const el = pane.querySelector(`.ib-card[data-id="${fresh}"]`); if (el) { el.classList.add('fresh'); el.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); } fresh = null; }
  }

  function card(x, u, seen) {
    const k = KINDS[x.kind] || KINDS.idee, mine = x.user_id === u.id, c = x.context || {};
    const isNew = !mine ? x.created_at > seen : x.status !== 'nieuw' && (x.updated_at || '') > seen;
    const meta = [profileById(x.user_id)?.name || 'Onbekend', when(x.created_at), c.screen && `op ${c.screen}`].filter(Boolean).map(esc).join(' · ');
    const tech = x.kind === 'bug' && c.version ? `<p class="ib-tech">${esc([device(c), c.w && `${c.w}×${c.h}`, c.version].filter(Boolean).join(' · '))}</p>` : '';
    return `<article class="ib-card k-${x.kind} s-${x.status || 'nieuw'}${mine ? ' mine' : ''}" data-id="${esc(x.id)}" data-s="${esc(x.status || 'nieuw')}">
      <button class="ib-main" aria-expanded="false">
        <span class="ib-stamp">${k.icon}<span>${k.t}</span></span>
        ${isNew ? '<span class="ib-new">nieuw</span>' : ''}
        <span class="ib-text">${esc(x.text)}</span>
        <span class="ib-meta">${meta}</span>
        ${x.reply ? `<span class="ib-reply"><b>Antwoord</b>${esc(x.reply)}</span>` : ''}
      </button>
      <div class="ib-acts">${tech}<div class="ib-status" role="radiogroup" aria-label="Status">${STATUS.map(([s, t]) => `<button role="radio" data-s="${s}" aria-checked="${s === (x.status || 'nieuw')}">${t}</button>`).join('')}</div>
        ${mine && (x.status || 'nieuw') === 'nieuw' ? '<button class="link ib-del" data-del>Terughalen</button>' : ''}</div>
    </article>`;
  }

  // de open briefjes als platte tekst, om in een sessie met Claude te plakken
  async function copyAll() {
    const all = ideas().slice().sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    const open = all.filter(x => x.status === 'nieuw' || x.status === 'gepland');
    const line = x => { const c = x.context || {}; return `[${(KINDS[x.kind]?.t || x.kind).toUpperCase()}, ${x.status}] ${profileById(x.user_id)?.name || '?'}, ${when(x.created_at)}, scherm ${c.screen || '?'} (${[device(c), c.w && `${c.w}x${c.h}`, c.version].filter(Boolean).join(', ')})\nid ${x.id}\n${x.text}${x.reply ? `\nAntwoord: ${x.reply}` : ''}`; };
    const txt = `Ideeënbus Dispatch, ${open.length} open van ${all.length} briefjes\n\n${(open.length ? open : all).map(line).join('\n\n')}\n`;
    try { await navigator.clipboard.writeText(txt); toast('Gekopieerd. Plak het in je sessie met Claude.'); }
    catch { toast('Kopiëren lukte niet in deze browser.'); }
    track('idea_copy', { n: open.length });
  }

  count(); setTab(tab);
  return { close: closeSheet };
}
