// Kleine UI-helpers: escapen, baanprofiel-art (uit de mockup), kaarten, toast, bottom sheet, haptiek.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}

export function slug(s) {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const dateNl = (d = new Date()) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const dateShort = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- baanprofiel (gegenereerd, uniek per baan, kleur per park) ----------
const HUES = { 'Hansa-Park': 205, 'Energylandia': 320, 'Plopsaland Belgium': 28, 'Plopsaland': 28, 'Walibi Holland': 285, 'Phantasialand': 18, 'Europa-Park': 215, 'PortAventura': 12,
  'Parque Warner': 235, 'Walibi Belgium': 300, 'Ferrari Land': 0, 'Toverland': 150, 'Thorpe Park': 190, 'Heide Park': 120, 'Alton Towers': 265, 'Tripsdrill': 40,
  'Efteling': 345, 'Movie Park': 250, 'Movie Park Germany': 250, 'Prater': 40, 'Slagharen': 30, 'Bobbejaanland': 55, 'Parque de Atracciones': 8 };
export function art(name, park, w = 320, h = 260) {
  const r = rng(hash(name)), hu = HUES[park] ?? hash(park) % 360, id = 'a' + hash(name + w + h);
  // zonnestralen zoals op de poster, in de kleur van het park
  const cx = w * (.3 + r() * .4), cy = h * (.42 + r() * .12), R = Math.hypot(w, h);
  let rays = '';
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * Math.PI * 2 + r() * .05, a1 = a0 + Math.PI / 18;
    rays += `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)}L${(cx + Math.cos(a0) * R).toFixed(1)} ${(cy + Math.sin(a0) * R).toFixed(1)}L${(cx + Math.cos(a1) * R).toFixed(1)} ${(cy + Math.sin(a1) * R).toFixed(1)}Z" fill="hsl(${hu} 40% ${k % 2 ? 22 : 30}%)" opacity="${k % 2 ? .5 : .35}"/>`;
  }
  let x = -10, y = h * .64 + r() * 20, d = `M${x} ${y} L${w * .12} ${y} `; const pts = []; const lift = h * .2 + r() * h * .14;
  d += `Q${w * .17} ${y} ${w * .22} ${lift} `; x = w * .22; y = lift; pts.push([x, y]);
  while (x < w + 20) { const nx = x + w * .1 + r() * w * .15, ny = h * .26 + r() * h * .48; d += `Q${(x + nx) / 2} ${ny > y ? y - 8 : ny + h * .12} ${nx} ${ny} `; x = nx; y = ny; pts.push([x, y]); }
  const sup = pts.map(p => `<line x1="${p[0].toFixed(1)}" y1="${(p[1] + 3).toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${h}" stroke="#07040a" stroke-width="1.6"/>`).join('');
  const lights = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${(p[1] - 4).toFixed(1)}" r="1.5" fill="#ffe2a6"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hu} 34% 9%)"/><stop offset=".62" stop-color="hsl(${hu} 30% 19%)"/><stop offset="1" stop-color="hsl(${(hu + 25) % 360} 48% 34%)"/></linearGradient>
  <radialGradient id="${id}g" cx="${(cx / w).toFixed(2)}" cy="${(cy / h).toFixed(2)}" r=".7"><stop offset="0" stop-color="#ffd38f" stop-opacity=".55"/><stop offset=".5" stop-color="#ffc77d" stop-opacity=".12"/><stop offset="1" stop-color="#ffc77d" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>${rays}<rect width="${w}" height="${h}" fill="url(#${id}g)"/>
  <circle cx="${(w * (w < h ? .38 : .18) + r() * w * .12).toFixed(1)}" cy="${(h * .14).toFixed(1)}" r="${(h * .035).toFixed(1)}" fill="#f6ead0" opacity=".85"/>${sup}
  <path d="${d}" fill="none" stroke="#07040a" stroke-width="6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f0cf8f" stroke-width="1.1" opacity=".6" transform="translate(0 -2.6)"/>${lights}
  <rect width="${w}" height="${h}" fill="url(#${id}f)"/></svg>`;
}
export function artFor(c, w, h) {
  if (c?.photo_url) return `<img src="${esc(c.photo_url)}" alt="" loading="lazy" decoding="async">`;
  return art(c?.name || '?', c?.park || '', w, h);
}
export function meta(c) { return [c?.park, c?.manufacturer].filter(Boolean).map(esc).join(' · '); }
export function cardHtml(c, cls = '', w = 320, h = 260) {
  return `<div class="card ${cls}" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}"><i class="bulbs"></i><div class="flip">
    <div class="face front"><div class="art">${artFor(c, w, h)}</div><div class="sheen"></div><div class="sweep"></div><div class="frame"></div><div class="cap"><div class="nm">${esc(c.name)}</div><div class="mt">${meta(c)}</div></div><div class="num"></div></div>
    <div class="face back"></div></div></div>`;
}

/** Kaarten binnen laten komen: omdraaien met een kleine vertraging per kaart (blokkeert nooit een tik). */
export function deal(cards, { stagger = 50, slow = false } = {}) {
  cards.forEach((el, i) => {
    if (slow) el.style.setProperty('--slow', '1');
    setTimeout(() => { el.classList.remove('enter'); el.classList.add('shine'); }, 16 + i * (slow ? stagger * 3 : stagger));
  });
}

// kantelen onder de muis (laptop) of vinger (telefoon), plus meelopende glans
if (typeof document !== 'undefined') {
  const fine = matchMedia('(hover: hover)').matches;
  const tilt = (el, x, y, k = 1) => {
    const r = el.getBoundingClientRect(); const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    el.style.setProperty('--ry', ((px - .5) * 14 * k).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - py) * 12 * k).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  };
  const reset = el => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
  if (fine) {
    document.addEventListener('pointermove', e => { const el = e.target.closest?.('.card'); if (el && !reduceMotion()) tilt(el, e.clientX, e.clientY); }, { passive: true });
    document.addEventListener('pointerout', e => { const el = e.target.closest?.('.card'); if (el && !el.contains(e.relatedTarget)) reset(el); }, { passive: true });
  } else {
    document.addEventListener('pointerdown', e => { const el = e.target.closest?.('.card'); if (el && !reduceMotion()) { tilt(el, e.clientX, e.clientY, .7); setTimeout(() => reset(el), 260); } }, { passive: true });
  }
}

export const SPARKLE = `<svg viewBox="0 0 40 40"><path d="M20 0 L21.3 18.7 L40 20 L21.3 21.3 L20 40 L18.7 21.3 L0 20 L18.7 18.7Z" fill="#fff4dc"/><circle cx="20" cy="20" r="2.4" fill="#fff"/></svg>`;

// ---------- toast ----------
let toastT = 0;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- haptiek ----------
export function buzz(p = 6) { try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(p); } catch { /* niet ondersteund */ } }

// ---------- bottom sheet ----------
let sheetClose = null, sheetHist = false;
addEventListener('popstate', () => { if (sheetHist) { sheetHist = false; closeSheet(false, true); } });
export function openSheet(html, { onClose, cls = '' } = {}) {
  closeSheet(true, false, true);
  const wrap = document.getElementById('sheet');
  wrap.innerHTML = `<div class="sheet-back"></div><section class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div><div class="sheet-body"></div></section>`;
  const body = wrap.querySelector('.sheet-body');
  if (typeof html === 'string') body.innerHTML = html; else body.appendChild(html);
  wrap.hidden = false; requestAnimationFrame(() => wrap.classList.add('open'));
  // Android-terugknop sluit eerst het blad
  if (!sheetHist) { try { history.pushState({ sheet: 1 }, ''); sheetHist = true; } catch { /* */ } }
  const close = () => closeSheet();
  wrap.querySelector('.sheet-back').onclick = close;
  wrap.querySelector('.sheet-grip').onclick = close;
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  sheetClose = () => { document.removeEventListener('keydown', key); onClose?.(); };
  // omlaag vegen om te sluiten
  const sheet = wrap.querySelector('.sheet'); let y0 = null, dy = 0;
  sheet.addEventListener('touchstart', e => { if (body.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sheet.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; sheet.style.transform = ''; if (dy > 90) close(); });
  return body;
}
export function closeSheet(instant = false, fromBack = false, keepHist = false) {
  const wrap = document.getElementById('sheet'); if (wrap.hidden) return;
  // zelf gesloten (niet via terug): de extra geschiedenisstap weer opruimen, behalve bij een schermwissel
  if (sheetHist && !fromBack && !instant) {
    sheetHist = false; const h = location.hash;
    // alleen terugstappen als er niet meteen daarna genavigeerd wordt (anders zou terug die navigatie ongedaan maken)
    setTimeout(() => { if (location.hash === h && history.state?.sheet) history.back(); }, 0);
  }
  else if (instant && !keepHist) sheetHist = false;
  const fn = sheetClose; sheetClose = null;
  wrap.classList.remove('open');
  const done = () => { wrap.hidden = true; wrap.innerHTML = ''; };
  if (instant || reduceMotion()) done(); else setTimeout(done, 320);
  fn?.();
}
export const sheetOpen = () => !document.getElementById('sheet').hidden;

// eenvoudige bevestiging in een sheet
export function confirmSheet(title, text, yes = 'Ja', no = 'Annuleer') {
  return new Promise(res => {
    let answered = false;
    const body = openSheet(`<div class="sheet-pad center"><h3 class="h-title">${esc(title)}</h3><p class="sheet-text">${esc(text)}</p>
      <div class="row-btns"><button class="ghost" data-a="no">${esc(no)}</button><button class="btn" data-a="yes">${esc(yes)}</button></div></div>`,
    { onClose: () => { if (!answered) res(false); } });
    body.querySelector('[data-a=yes]').onclick = () => { answered = true; res(true); closeSheet(); };
    body.querySelector('[data-a=no]').onclick = () => { answered = true; res(false); closeSheet(); };
  });
}
