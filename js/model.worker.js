// Draait fitModel in een Web Worker, zodat animaties nooit haperen.
// Bewaart per persoon het vorige model als warme start.
import { fitModel } from './model.js';

const warm = {};
self.onmessage = e => {
  const { id, key, entries, comparisons, settings } = e.data;
  try {
    const t0 = performance.now();
    const model = fitModel({ entries, comparisons, settings, warm: warm[key] });
    warm[key] = model;
    self.postMessage({ id, key, model, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, key, error: String(err?.stack || err) });
  }
};
