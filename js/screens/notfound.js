// 404: de attractie is tijdelijk gesloten.
import { NIET_GEVONDEN } from '../copy.js';
import { backdrop } from '../stage.js';

export default {
  nav: 'plein', title: 'Gesloten',
  mount({ bg, fg }) {
    backdrop(bg, 'dim');
    fg.innerHTML = `<div class="closed-sign"><div class="eyebrow">Storing</div><h1 class="logo-sm">404</h1>
      <p class="serif it">${NIET_GEVONDEN}</p><a class="ghost" href="#/">Terug naar Spelen</a></div>`;
  },
};
