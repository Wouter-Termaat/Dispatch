// Achtergrondmuziek: Spotify-embed van "Witte Stip. Inspiratie" in een kleine, inklapbare speler
// die over schermen heen blijft staan (hij zit buiten de schermlaag).
import { SPOTIFY_PLAYLIST } from './config.js';
import { on, mySettings, meKey } from './state.js';

const ID = SPOTIFY_PLAYLIST.split('/playlist/')[1]?.split('?')[0];
let box = null;

function render() {
  box = document.getElementById('music');
  const want = meKey() && mySettings().music === 'wittestip';
  if (!want) { box.hidden = true; box.innerHTML = ''; return; }
  if (box.dataset.ready) { box.hidden = false; return; }
  box.dataset.ready = '1'; box.hidden = false;
  box.innerHTML = `<button class="music-btn" aria-label="Muziek" title="Witte Stip. Inspiratie"><i></i></button>
    <div class="music-panel"><div class="music-head"><span class="eyebrow">Witte Stip. Inspiratie</span><button class="link" data-close>Inklappen</button></div>
    <iframe title="Spotify: Witte Stip. Inspiratie" src="https://open.spotify.com/embed/playlist/${ID}?utm_source=generator&theme=0" width="100%" height="152" frameborder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
  box.querySelector('.music-btn').onclick = () => box.classList.toggle('open');
  box.querySelector('[data-close]').onclick = () => box.classList.remove('open');
}

export function initMusic() { render(); on(w => { if (w === 'settings' || w === 'model') render(); }); }
export function openMusic() { render(); box?.classList.add('open'); }
