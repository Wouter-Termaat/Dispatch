// Geluid, gesynthetiseerd met WebAudio (geen bestanden). Kort en subtiel.
// liftHill(): zacht ratelen bij het laden · bell(): heldere stationsbel bij een keuze
// whoosh(): bij een verrassende uitslag · applause(): kort applaus na een sessie
let ctx = null, master = null, enabled = true;

export function setSound(on) { enabled = !!on; }
function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Na de eerste aanraking mag audio starten (browserregel)
export function unlock() { if (enabled) ac(); }

let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function bell(pitch = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  [[1318.5, .16], [2637, .06], [3951, .03]].forEach(([f, g]) => {
    const o = c.createOscillator(), v = c.createGain(); o.type = 'sine'; o.frequency.value = f * pitch;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .004); v.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(v).connect(master); o.start(t); o.stop(t + 1);
  });
}

export function tick() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), v = c.createGain(); o.type = 'triangle'; o.frequency.value = 1900;
  v.gain.setValueAtTime(.05, t); v.gain.exponentialRampToValueAtTime(.0001, t + .05);
  o.connect(v).connect(master); o.start(t); o.stop(t + .06);
}

export function liftHill(dur = 1.3) {
  const c = ac(); if (!c) return; const t0 = c.currentTime; let t = 0, gap = .085;
  while (t < dur) {
    const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 500; f.Q.value = 6;
    const v = c.createGain(); const at = t0 + t;
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(.22 * (1 - t / dur * .5), at + .003); v.gain.exponentialRampToValueAtTime(.0001, at + .03);
    s.connect(f).connect(v).connect(master); s.start(at, Math.random()); s.stop(at + .04);
    t += gap; gap *= 1.02;
  }
}

export function whoosh() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noise(c);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .35); f.frequency.exponentialRampToValueAtTime(600, t + .7);
  const v = c.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.16, t + .25); v.gain.exponentialRampToValueAtTime(.0001, t + .75);
  s.connect(f).connect(v).connect(master); s.start(t); s.stop(t + .8);
}

export function applause(dur = 2.2) {
  const c = ac(); if (!c) return; const t0 = c.currentTime;
  for (let k = 0; k < 160; k++) {
    const at = t0 + Math.random() * dur * Math.random() ** .3; const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.5;
    const v = c.createGain(); const env = Math.sin(Math.PI * Math.min(1, (at - t0) / dur)) * .09 + .01;
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(env, at + .002); v.gain.exponentialRampToValueAtTime(.0001, at + .045);
    s.connect(f).connect(v).connect(master); s.start(at, Math.random() * 1.5); s.stop(at + .06);
  }
}
