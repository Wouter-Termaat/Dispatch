// Inloggen: "Toon je kaartje". In demomodus: kies wie je bent.
import { S } from '../state.js';
import { backdrop } from '../stage.js';
import { buildScene } from '../scene.js';
import { esc, buzz } from '../ui.js';

export default {
  nav: null, title: 'Toon je kaartje',
  async mount({ bg, fg, go }) {
    if (!S.store.needsLogin) { go(''); return; }
    backdrop(bg, 'dim');
    const demo = S.store.kind === 'demo';
    fg.innerHTML = `<div class="login">
      <div class="emblem" id="emblem"></div>
      <div class="login-head"><h1 class="neon">Dispatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div></div>
      <div class="ticket"><i class="t-bulbs"></i>
        <div class="ticket-in">
          <div class="eyebrow">${demo ? 'Demovoorstelling' : 'Entree'}</div>
          <h2 class="h-title">${demo ? 'Wie ben jij vanavond?' : 'Toon je kaartje'}</h2>
          ${demo ? `<div class="who">${S.store.data.profiles.map(p => `<button class="btn" data-key="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
             <p class="fine">Demomodus: alles blijft in deze browser.</p>`
          : `<form id="lf" autocomplete="on" onsubmit="return false">
              <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" required inputmode="email"></label>
              <label class="field"><span>Wachtwoord</span><input type="password" name="password" autocomplete="current-password" required></label>
              <p class="err" id="err" role="alert"></p>
              <button class="btn" type="submit" id="go">Naar binnen</button>
            </form>
            <p class="fine">Je blijft op dit apparaat ingelogd.</p>`}
        </div>
      </div></div>`;
    if (!demo) {
      const f = fg.querySelector('#lf'), err = fg.querySelector('#err'), btn = fg.querySelector('#go');
      f.onsubmit = async e => {
        e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Even kijken';
        try {
          await S.store.signIn(f.email.value, f.password.value);
          buzz([8, 30, 8]); await (await import('../app.js')).afterLogin();
        } catch (ex) {
          console.warn(ex);
          err.textContent = /invalid|credentials/i.test(ex?.message || '') ? 'Dat kaartje klopt niet. Controleer je e-mail en wachtwoord.' : 'Geen verbinding met de kassa. Probeer het zo opnieuw.';
          btn.disabled = false; btn.textContent = 'Naar binnen';
        }
      };
    }
    const scene = await buildScene(fg.querySelector('#emblem'), { only: ['wm-body', 'wm-roof', 'SAILS', 'wm-hub'], focus: [300, 330, 834, 990], mini: true });
    const { afterLogin } = await import('../app.js');
    if (demo) fg.querySelectorAll('[data-key]').forEach(b => b.onclick = async () => { buzz(8); await S.store.chooseProfile(b.dataset.key); await afterLogin(); });
    return () => scene.stop();
  },
};
