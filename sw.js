// Service worker: de app blijft openen zonder netwerk. Eerst het netwerk (altijd de nieuwste versie), anders de kopie.
const CACHE = 'dispatch-v5';
const SHELL = ['./', 'index.html', 'css/app.css', 'css/screens.css', 'css/ranking.css', 'css/pages.css', 'css/scene.css', 'css/cards.css', 'css/spelen.css', 'js/app.js', 'js/scene.js', 'js/pick.js', 'js/stippen.js', 'js/orgel.js', 'js/config.js', 'js/store.js', 'js/state.js',
  'js/model.js', 'js/model.worker.js', 'js/ui.js', 'js/stage.js', 'js/fx/lightfog.js', 'js/session.js', 'js/sound.js', 'js/copy.js', 'js/modes.js', 'js/music.js',
  'js/baankaart.js', 'js/screens/plein.js', 'js/screens/rangee.js', 'js/screens/duel.js', 'js/screens/affiche.js', 'js/screens/login.js',
  'assets/windmill.jpg', 'assets/scene/scene.json', ...['sunburst', 'wm-body', 'wm-roof', 'wm-sails', 'wm-hub', 'bulbs-sails', 'bulbs-front', 'moulin', 'couple', 'inside', 'fence', 'street', 'lamp-l', 'lamp-r', 'cars-l', 'cars-r', 'buildings-l', 'buildings-r'].map(n => `assets/scene/${n}.webp`), 'data/seed.json', 'manifest.webmanifest'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET') return;
  const own = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!own && !fonts) return;   // Supabase en Spotify nooit cachen
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (own || fonts)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: own }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
