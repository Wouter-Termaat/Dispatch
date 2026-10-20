// Logboek: legt stilletjes vast wat er gebeurt, voor latere statistieken en prestaties. Niets hiervan is zichtbaar in de app.
// Gebeurtenissen gaan in een buffer en worden in groepjes naar de tabel 'events' gestuurd (zie sql/stats.sql).
// Bestaat die tabel nog niet, dan worden ze overgeslagen. Ranken wacht hier nooit op.
//
// Typen: app_open, login, logout, screen, session_start, choice, undo, session_end, champion, ticket, dot, dots_reset,
//        setting, music, coaster_add, entry_add, coaster_edit, entry_remove, note, export, baankaart, photo_fail, js_error
import { S, me } from './state.js';

export const APP_VERSION = 'v16';   // gelijk houden met CACHE in sw.js
let sessionId = null;
export function setTrackSession(id) { sessionId = id; }

/** Leg een gebeurtenis vast. data: alles wat later interessant kan zijn (klein houden: id's, getallen, korte teksten). */
export function track(type, data = {}) {
  try {
    const st = S.store, u = me();
    if (!st?.log || !u) return;
    st.log({ type, session: sessionId, data, created_at: new Date().toISOString(), user_id: u.id });
  } catch (e) { console.warn('track', e); }
}

// hoe kies je: vinger, muis, pen of toetsenbord (voor de keuzes)
let lastInput = 'onbekend';
addEventListener('pointerdown', e => { lastInput = e.pointerType || 'pointer'; }, { capture: true, passive: true });
addEventListener('keydown', () => { lastInput = 'toets'; }, { capture: true, passive: true });
export const inputKind = () => lastInput;

/** Eenmalig bij het openen: apparaat en omstandigheden. */
export function trackOpen() {
  const nav = navigator, c = nav.connection;
  track('app_open', {
    version: APP_VERSION,
    standalone: matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    touch: matchMedia('(pointer: coarse)').matches,
    lite: document.documentElement.classList.contains('lite'),
    w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    platform: nav.userAgentData?.platform || (/(iPhone|iPad|Android|Windows|Mac)/.exec(nav.userAgent) || [])[1] || 'onbekend',
    browser: (/(Edg|Chrome|Firefox|Safari)\//.exec(nav.userAgent) || [])[1] || 'onbekend',
    lang: nav.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, hour: new Date().getHours(), weekday: new Date().getDay(),
    net: c?.effectiveType || null, saveData: !!c?.saveData, online: nav.onLine,
    dark: matchMedia('(prefers-color-scheme: dark)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    queued: S.store?.pending || 0,
  });
}

// schermen: welk scherm, hoe lang je er was
let screen = null, screenAt = 0;
export function trackScreen(name, params) {
  const now = performance.now();
  if (screen !== null) track('screen', { name: screen.name, params: screen.params, ms: Math.round(now - screenAt), next: name });
  screen = { name: name || 'plein', params: params ? Object.fromEntries(params) : {} }; screenAt = now;
}
addEventListener('pagehide', () => { if (screen) { track('screen', { name: screen.name, params: screen.params, ms: Math.round(performance.now() - screenAt), next: null }); screen = null; } S.store?.flushLog?.(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) S.store?.flushLog?.(); });
// een foto die niet laadt (verlopen link, offline): handig om later te zien of dat vaak gebeurt
document.addEventListener('error', e => { const t = e.target; if (t?.matches?.('img.ph')) track('photo_fail', { id: t.closest('[data-id]')?.dataset.id || null, online: navigator.onLine }); }, true);
// fouten in de app zelf, zodat we later weten waar het misgaat
addEventListener('error', e => { if (e.message) track('js_error', { msg: String(e.message).slice(0, 200), src: (e.filename || '').split('/').pop(), line: e.lineno }); });
addEventListener('unhandledrejection', e => track('js_error', { msg: String(e.reason?.message || e.reason).slice(0, 200), promise: true }));
