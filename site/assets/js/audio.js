// Bruitages synthétisés (Web Audio) : aucun fichier son à télécharger.
// Le son ne démarre qu'après une action du visiteur et peut être coupé.

import { $, store } from './util.js';

let ctx = null;
let master = null;
let enabled = store.get('at-sound', 'on') === 'on';
const loops = new Map();

function audio(allowStart) {
  if (!enabled) return null;
  if (!ctx) {
    if (!allowStart) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    if (!allowStart) return null;
    ctx.resume();
  }
  return ctx;
}

function tone(ac, { f = 440, to = null, type = 'sine', dur = 0.1, vol = 0.3, at = 0 }) {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuffer = null;
function noiseSource(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function noise(ac, { dur = 0.05, freq = 2000, q = 1, type = 'bandpass', vol = 0.3, at = 0 }) {
  const t0 = ac.currentTime + at;
  const src = noiseSource(ac);
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  click: (ac) => { noise(ac, { dur: 0.025, freq: 3500, vol: 0.5 }); tone(ac, { f: 1900, dur: 0.02, type: 'square', vol: 0.06 }); },
  clack: (ac) => { noise(ac, { dur: 0.05, freq: 900, q: 2, vol: 0.7 }); tone(ac, { f: 260, dur: 0.04, type: 'triangle', vol: 0.2 }); },
  snap: (ac) => { tone(ac, { f: 2600, dur: 0.035, vol: 0.18 }); noise(ac, { dur: 0.03, freq: 5000, vol: 0.3 }); },
  pop: (ac) => tone(ac, { f: 420, to: 1500, dur: 0.09, vol: 0.25 }),
  tink: (ac) => { tone(ac, { f: 3100, dur: 0.12, vol: 0.14 }); tone(ac, { f: 4650, dur: 0.08, vol: 0.06 }); },
  zap: (ac) => { tone(ac, { f: 1300, to: 90, dur: 0.22, type: 'sawtooth', vol: 0.07 }); noise(ac, { dur: 0.1, freq: 6000, vol: 0.12 }); },
  stamp: (ac) => { noise(ac, { dur: 0.14, freq: 380, type: 'lowpass', vol: 0.9 }); tone(ac, { f: 95, dur: 0.14, vol: 0.4 }); },
  whoosh: (ac) => noise(ac, { dur: 0.45, freq: 900, q: 0.7, vol: 0.25 }),
  chime: (ac) => [660, 880, 1320].forEach((f, i) => tone(ac, { f, dur: 0.22, type: 'triangle', vol: 0.18, at: i * 0.09 })),
  fanfare: (ac) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(ac, { f, dur: 0.2, type: 'triangle', vol: 0.16, at: i * 0.1 })),
  buzz: (ac) => tone(ac, { f: 140, dur: 0.28, type: 'sawtooth', vol: 0.1 }),
  ok: (ac) => { tone(ac, { f: 880, dur: 0.1, vol: 0.15 }); tone(ac, { f: 1320, dur: 0.14, vol: 0.15, at: 0.08 }); },
  hiss: (ac) => noise(ac, { dur: 0.5, freq: 4500, q: 0.8, vol: 0.18 }),
};

/** Joue un bruitage. passive = n'ouvre pas le son si le visiteur n'a encore rien touché. */
export function sfx(name, { passive = false } = {}) {
  const ac = audio(!passive);
  if (ac && SOUNDS[name]) SOUNDS[name](ac);
}

/** Sons continus (bip de continuité, grésillement du fer). */
export function loopStart(name) {
  const ac = audio(true);
  if (!ac || loops.has(name)) return;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.connect(master);
  let src;
  if (name === 'beep') {
    src = ac.createOscillator();
    src.type = 'square';
    src.frequency.value = 2400;
    src.connect(g);
    g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.01);
  } else {
    src = noiseSource(ac);
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5200;
    filter.Q.value = 0.9;
    src.connect(filter).connect(g);
    g.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.15);
  }
  src.start();
  loops.set(name, { src, g });
}

export function loopStop(name) {
  const loop = loops.get(name);
  if (!loop || !ctx) return;
  loops.delete(name);
  loop.g.gain.cancelScheduledValues(ctx.currentTime);
  loop.g.gain.setValueAtTime(Math.max(loop.g.gain.value, 0.0001), ctx.currentTime);
  loop.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
  loop.src.stop(ctx.currentTime + 0.06);
}

export function initAudio() {
  const btn = $('.sound-toggle');
  if (!btn) return;
  const render = () => {
    btn.setAttribute('aria-pressed', String(enabled));
    btn.title = enabled ? 'Couper le son' : 'Activer le son';
  };
  render();
  btn.addEventListener('click', () => {
    enabled = !enabled;
    store.set('at-sound', enabled ? 'on' : 'off');
    if (!enabled) for (const name of [...loops.keys()]) loopStop(name);
    render();
    if (enabled) sfx('click');
  });
}
