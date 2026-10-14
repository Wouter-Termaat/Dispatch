// Inloggen: "Toon je kaartje". In demomodus: kies wie je bent.
import { S } from '../state.js';
import { light } from '../stage.js';
import { esc, buzz } from '../ui.js';

export default {
  nav: null, title: 'Toon je kaartje',
  light: { fogH: .35, fog: .9, beams: [{ x: .5, y: 1.12, a: Math.PI, w: .2, i: .45 }], pool2: [.5, .5], pool2I: .25 },
  async mount({ bg, fg, go }) {
    if (!S.store.needsLogin) { go(''); return; }
    bg.innerHTML = '<div class="theatre"></div><div class="floor"></div>';
    const demo = S.store.kind === 'demo';
    fg.innerHTML = `<div class="login">
      <div class="login-head"><h1 class="logo-sm">Dispatch</h1><div class="eyebrow">Cabaret des Montagnes Russes</div></div>
      <div class="ticket">
        <div class="ticket-in">
          <div class="eyebrow">${demo ? 'Demovoorstelling' : 'Entree'}</div>
          <h2 class="h-title">${demo ? 'Wie ben jij vanavond?' : 'Toon je kaartje'}</h2>
          ${demo ? `<div class="who">${S.store.data.profiles.map(p => `<button class="btn" data-key="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
             <p class="fine">Demomodus: alles blijft in deze browser.</p>`
          : `<form id="lf" autocomplete="on">
              <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" required inputmode="email"></label>
              <label class="field"><span>Wachtwoord</span><input type="password" name="password" autocomplete="current-password" required></label>
              <p class="err" id="err" role="alert"></p>
              <button class="btn" type="submit" id="go">Naar binnen</button>
            </form>
            <p class="fine">Je blijft op dit apparaat ingelogd.</p>`}
        </div>
      </div></div>`;
    const { afterLogin } = await import('../app.js');
    if (demo) {
      fg.querySelectorAll('[data-key]').forEach(b => b.onclick = async () => { buzz(8); await S.store.chooseProfile(b.dataset.key); await afterLogin(); });
      return;
    }
    const f = fg.querySelector('#lf'), err = fg.querySelector('#err'), btn = fg.querySelector('#go');
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Even kijken';
      try {
        await S.store.signIn(f.email.value, f.password.value);
        buzz([8, 30, 8]); await afterLogin();
      } catch (ex) {
        console.warn(ex);
        err.textContent = /invalid|credentials/i.test(ex?.message || '') ? 'Dat kaartje klopt niet. Controleer je e-mail en wachtwoord.' : 'Geen verbinding met de kassa. Probeer het zo opnieuw.';
        btn.disabled = false; btn.textContent = 'Naar binnen';
      }
    };
  },
};
