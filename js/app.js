// Dispatch: opstart, router en navigatie.
import { createStore } from './store.js';
import { initPhotos, photosNeedRefresh } from './photos.js';
import { S, fitAll, mySettings, meKey, on, emit } from './state.js';
import { session } from './session.js';
import { initStage } from './stage.js';
import { closeSheet, toast } from './ui.js';
import * as sound from './sound.js';
import './stippen.js';

const ROUTES = {
  '': () => import('./screens/plein.js'),
  plein: () => import('./screens/plein.js'),
  rangee: () => import('./screens/rangee.js'),
  duel: () => import('./screens/duel.js'),
  affiche: () => import('./screens/affiche.js'),
  programma: () => import('./screens/programma.js'),
  samen: () => import('./screens/samen.js'),
  meer: () => import('./screens/meer.js'),
  toevoegen: () => import('./screens/toevoegen.js'),
  toernooi: () => import('./screens/toernooi.js'),
  achter: () => import('./screens/achter.js'),
  login: () => import('./screens/login.js'),
};
const notFound = () => import('./screens/notfound.js');

let current = null, navToken = 0;

export function go(path) { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; }

function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, qs] = h.split('?');
  return { name: name || '', params: new URLSearchParams(qs || '') };
}

async function route() {
  const token = ++navToken;
  let { name, params } = parse();
  if (S.store.needsLogin && name !== 'login') { name = 'login'; }
  let mod;
  try { mod = (await (ROUTES[name] || notFound)()).default; } catch (e) { console.error(e); mod = (await notFound()).default; }
  if (token !== navToken) return;
  closeSheet(true);

  // oud scherm (en eventueel een half geladen scherm) uit
  const bgL = document.getElementById('bg'), fgL = document.getElementById('screen');
  if (current) { try { current.cleanup?.(); } catch (e) { console.error(e); } }
  const instant = current?.fast || mod.fast;
  current = null;
  for (const el of [...bgL.children, ...fgL.children]) {
    if (el.classList.contains('out')) continue;
    el.classList.add('out'); setTimeout(() => el.remove(), instant ? 0 : 230);
  }
  // nieuw scherm in
  const bg = document.createElement('div'); bg.className = 'bgset';
  const fg = document.createElement('div'); fg.className = 'scr scr-' + (name || 'plein');
  bgL.appendChild(bg); fgL.appendChild(fg);
  const nav = document.getElementById('nav');
  nav.classList.toggle('away', !mod.nav);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === mod.nav));
  let cleanup;
  try { cleanup = await mod.mount({ bg, fg, params, go }); } catch (e) { console.error(e); toast('Er ging iets mis bij het openen van dit scherm.'); }
  if (token !== navToken) { try { cleanup?.(); } catch (e) { console.error(e); } return; }  // intussen al verder genavigeerd
  current = { cleanup, fast: mod.fast };
  import('./music.js').then(m => m.duck(!mod.nav)).catch(() => {});
  document.title = mod.title ? `${mod.title} · Dispatch` : 'Dispatch';
}

async function boot() {
  initStage();
  try {
    S.store = await createStore();
  } catch (e) {
    console.error(e);
    document.querySelector('#boot .eyebrow').textContent = 'Geen verbinding met de kassa. Probeer het zo opnieuw.';
    return;
  }
  initPhotos(S.store);   // uit de kopie meteen klaar, anders op de achtergrond
  // geluid volgt de instelling
  const syncSound = () => { if (meKey()) sound.setSound(mySettings().sound); };
  on(w => { if (w === 'settings') syncSound(); });
  syncSound();
  addEventListener('pointerdown', () => sound.unlock(), { once: true });
  document.addEventListener('click', e => { if (e.target.closest('.seg button, .pills button, .chip, .mode-t, .label, #nav a, .tool')) sound.select(); });

  if (!S.store.needsLogin) await fitAll();
  S.store.addEventListener('error', e => toast('Opslaan lukte niet: ' + (e.detail?.message || 'onbekende fout')));
  S.store.addEventListener('signedout', () => go('login'));
  watchQueue();
  // terug in de app na een tijdje weg: verse data ophalen (zo zie je wat Luca intussen deed)
  document.addEventListener('visibilitychange', async () => {
    const st = S.store;
    if (document.hidden || st.kind !== 'supabase' || st.needsLogin) return;
    if (photosNeedRefresh()) initPhotos(st);   // getekende foto-links bijna verlopen: nieuwe ophalen
    if (session.current) return;
    if (Date.now() - (st.loadedAt || 0) < 120000) return;
    try { await st.load(); await fitAll(); emit('data'); } catch (e) { console.warn(e); }
  });
  addEventListener('hashchange', route);
  await route();
  document.getElementById('boot').classList.add('gone');
  setTimeout(() => document.getElementById('boot')?.remove(), 700);
  import('./music.js').then(m => m.initMusic()).catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Kleine indicator als er wijzigingen wachten op verbinding
function watchQueue() {
  const pill = document.createElement('div'); pill.className = 'netpill'; pill.hidden = true;
  document.getElementById('app').appendChild(pill);
  const upd = () => {
    const n = S.store.pending;
    pill.hidden = !(n && S.store.offline);
    pill.textContent = `${n} ${n === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} op verbinding`;
  };
  S.store.addEventListener('queue', upd); upd();
}

/** Na inloggen of profielkeuze: modellen fitten en naar het plein. */
export async function afterLogin() {
  initPhotos(S.store);
  sound.setSound(mySettings().sound);
  await fitAll();
  go('');
}

boot();
