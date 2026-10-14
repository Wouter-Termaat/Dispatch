// Achtergrondmuziek. Standaard het draaiorgel (eigen walsje, js/orgel.js). Na de Witte Stip kan ook de
// Spotify-playlist "Witte Stip. Inspiratie" in een kleine, inklapbare speler die over schermen heen blijft staan.
import { SPOTIFY_PLAYLIST } from './config.js';
import { on, mySettings, meKey } from './state.js';
import { startOrgel, stopOrgel, duckOrgel, orgelPlaying } from './orgel.js';

const ID = SPOTIFY_PLAYLIST.split('/playlist/')[1]?.split('?')[0];
let box = null, unlocked = false, paused = false;

function render() {
  box = document.getElementById('music');
  const mode = meKey() ? mySettings().music : 'none';
  // draaiorgel
  if (mode === 'orgel' && unlocked && !paused) startOrgel(); else stopOrgel();
  // speler (knop) tonen
  if (mode === 'none') { box.hidden = true; box.innerHTML = ''; delete box.dataset.mode; return; }
  box.hidden = false;
  if (box.dataset.mode === mode) { box.classList.toggle('paused', paused); return; }
  box.dataset.mode = mode;
  if (mode === 'orgel') {
    box.innerHTML = `<button class="music-btn orgel" aria-label="Muziek aan of uit" title="Draaiorgel"><svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg></button>`;
    box.querySelector('.music-btn').onclick = () => { paused = !paused; unlocked = true; render(); };
  } else {
    box.innerHTML = `<button class="music-btn" aria-label="Muziek" title="Witte Stip. Inspiratie"><i></i></button>
      <div class="music-panel"><div class="music-head"><span class="eyebrow">Witte Stip. Inspiratie</span><button class="link" data-close>Inklappen</button></div>
      <iframe title="Spotify: Witte Stip. Inspiratie" src="https://open.spotify.com/embed/playlist/${ID}?utm_source=generator&theme=0" width="100%" height="152" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
    box.querySelector('.music-btn').onclick = () => box.classList.toggle('open');
    box.querySelector('[data-close]').onclick = () => box.classList.remove('open');
  }
  box.classList.toggle('paused', paused);
}

export function initMusic() {
  render();
  on(w => { if (w === 'settings' || w === 'model') render(); });
  // browsers laten geluid pas toe na een aanraking
  addEventListener('pointerdown', () => { if (!unlocked) { unlocked = true; render(); } }, { once: true });
}
export function openMusic() { render(); box?.classList.add('open'); }
/** Tijdens het spelen zachter. */
export function duck(on) { duckOrgel(on); }
export { orgelPlaying };
