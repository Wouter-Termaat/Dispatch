// 404: de attractie is tijdelijk gesloten.
import { NIET_GEVONDEN } from '../copy.js';

export default {
  nav: 'plein', title: 'Gesloten',
  light: { fogH: .4, fog: 1, beams: [{ x: .5, y: 1.1, a: Math.PI, w: .12, i: .25, sway: .05 }] },
  mount({ bg, fg }) {
    bg.innerHTML = '<div class="theatre dim"></div><div class="floor"></div>';
    fg.innerHTML = `<div class="closed-sign"><div class="eyebrow">Storing</div><h1 class="logo-sm">404</h1>
      <p class="serif it">${NIET_GEVONDEN}</p><a class="ghost" href="#/">Terug naar het plein</a></div>`;
  },
};
