// Dispatch: opstart, router en navigatie.
import { createStore } from './store.js';
import { S, fitAll, mySettings, meKey, on } from './state.js';
import { initStage, light } from './stage.js';
import { closeSheet, toast } from './ui.js';
import * as sound from './sound.js';

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

  // oud scherm uit
  const bgL = document.getElementById('bg'), fgL = document.getElementById('screen');
  if (current) {
    try { current.cleanup?.(); } catch (e) { console.error(e); }
    const oldFg = fgL.firstElementChild, oldBg = bgL.firstElementChild;
    oldFg?.classList.add('out'); oldBg?.classList.add('out');
    const instant = current.fast || mod.fast;
    setTimeout(() => { oldFg?.remove(); oldBg?.remove(); }, instant ? 0 : 230);
  }
  // nieuw scherm in
  const bg = document.createElement('div'); bg.className = 'bgset';
  const fg = document.createElement('div'); fg.className = 'scr scr-' + (name || 'plein');
  bgL.appendChild(bg); fgL.appendChild(fg);
  const nav = document.getElementById('nav');
  nav.classList.toggle('away', !mod.nav);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === mod.nav));
  light(mod.light || {});
  let cleanup;
  try { cleanup = await mod.mount({ bg, fg, params, go }); } catch (e) { console.error(e); toast('Er ging iets mis bij het openen van dit scherm.'); }
  current = { cleanup, fast: mod.fast };
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
  // geluid volgt de instelling
  const syncSound = () => { if (meKey()) sound.setSound(mySettings().sound); };
  on(w => { if (w === 'settings') syncSound(); });
  syncSound();
  addEventListener('pointerdown', () => sound.unlock(), { once: true });

  if (!S.store.needsLogin) await fitAll();
  S.store.addEventListener('error', e => toast('Opslaan lukte niet: ' + (e.detail?.message || 'onbekende fout')));
  addEventListener('hashchange', route);
  await route();
  document.getElementById('boot').classList.add('gone');
  setTimeout(() => document.getElementById('boot')?.remove(), 700);
  import('./music.js').then(m => m.initMusic()).catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

/** Na inloggen of profielkeuze: modellen fitten en naar het plein. */
export async function afterLogin() {
  sound.setSound(mySettings().sound);
  await fitAll();
  go('');
}

boot();
