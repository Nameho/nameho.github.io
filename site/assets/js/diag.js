// « Trouve la panne » : un vrai petit circuit série simulé + un multimètre.
// Pile 9 V → SW1 → F1 → R1 (470 Ω) → D1 (LED) → W1 (strap) → retour pile.
// Une panne aléatoire est cachée ; le visiteur mesure, trouve, remplace, vérifie.

import { $, $$, svg, el, clamp, reducedMotion } from './util.js';
import { sfx, loopStart, loopStop } from './audio.js';
import { achieve, discover } from './hud.js';
import { openRework } from './rework.js';

const NODES = ['A', 'B', 'C', 'D', 'E', 'F'];
const CHAIN = ['SW1', 'F1', 'R1', 'D1', 'W1']; // CHAIN[i] relie NODES[i] et NODES[i + 1]
const RES = { SW1: 0.05, F1: 0.3, R1: 470, W1: 0.01 };
const LED_VF = 1.9;
const LED_RD = 12;
const BAT_V = 9.4;
const BAT_DEAD = 1.3;
const BAT_RI = 1.2;
const LEADS = 0.2; // résistance des cordons

// Chaque panne indique la pièce à remplacer (part), une zone pour le dernier indice et une astuce de pro.
const FAULTS = {
  C1: {
    part: 'C1',
    name: 'le condensateur C1, gonflé et en court-circuit',
    zone: 'du côté de la pile… et regarde bien la forme de C1',
    tip: "Un condensateur gonflé se repère souvent à l'œil : en atelier, l'inspection visuelle vient avant toute mesure. En court-circuit, il fait s'effondrer la tension d'alimentation (ici ≈ 0 V au lieu de 9 V).",
  },
  D1R: {
    part: 'D1',
    name: 'la LED D1, montée à l’envers',
    zone: 'entre TP4 et TP5… regarde de quel côté est le méplat de la LED',
    tip: 'Le méplat (côté plat) et la patte la plus courte indiquent la cathode (−). Montée à l’envers, la LED bloque le courant : 9 V à ses bornes, et le test diode ne répond que pointes inversées.',
  },
  BAT1: {
    part: 'BAT1',
    name: 'la pile 9 V, à plat',
    zone: 'la pile elle-même (entre TP1 et TP6)',
    tip: "Toujours commencer par l'alimentation : une pile 9 V neuve mesure environ 9,5 V. Ici 1,3 V, trop peu pour allumer une LED rouge (≈ 1,9 V).",
  },
  F1: {
    part: 'F1',
    name: 'le fusible F1, grillé',
    zone: 'entre TP2 et TP3',
    tip: 'En atelier, on ne se contente pas de changer un fusible : on cherche aussi pourquoi il a grillé (court-circuit, surconsommation…).',
  },
  R1: {
    part: 'R1',
    name: 'la résistance R1, coupée',
    zone: 'entre TP3 et TP4',
    tip: "Une résistance coupée a souvent chauffé : on vérifie au passage qu'elle est bien dimensionnée (470 Ω : jaune, violet, marron).",
  },
  D1: {
    part: 'D1',
    name: 'la LED D1, hors service',
    zone: 'entre TP4 et TP5',
    tip: 'Le mode test diode du multimètre allume faiblement une LED saine : pratique pour la vérifier sans alimenter le montage.',
  },
  W1: {
    part: 'W1',
    name: 'une soudure fissurée sur le strap W1',
    zone: 'entre TP5 et TP6',
    tip: 'Les soudures sèches ou fissurées sont un grand classique : invisibles à l’œil nu, mais 9 V à leurs bornes ne mentent pas.',
  },
};

// Pièces soudées sur la carte (remplacées au poste de soudure) ; la pile est sur un clip, le fusible dans un porte-fusible
const SOLDERED = new Set(['C1', 'R1', 'D1', 'W1']);

const PART_NAMES = { BAT1: 'la pile BAT1', C1: 'le condensateur C1', F1: 'le fusible F1', R1: 'la résistance R1', D1: 'la LED D1', W1: 'le strap W1' };

const SNAP_LABELS = {
  'bat+': 'BAT1 (+)', 'bat-': 'BAT1 (−)', 'c1+': 'C1 (+)', 'c1-': 'C1 (−)', 'sw1-1': 'SW1 patte 1', 'sw1-2': 'SW1 patte 2',
  'f1-1': 'F1 patte 1', 'f1-2': 'F1 patte 2', 'r1-1': 'R1 patte 1', 'r1-2': 'R1 patte 2',
  'd1-a': 'D1 anode (+)', 'd1-k': 'D1 cathode (−)', 'w1-1': 'W1 patte 1', 'w1-2': 'W1 patte 2',
};

const HINTS = [
  'Avant de mesurer, regarde la carte : un composant abîmé ou monté à l’envers se voit parfois à l’œil nu.',
  "Commence par l'alimentation : en mode V, pointe rouge sur TP1, pointe noire sur TP6.",
  'Mesure ensuite la tension aux bornes de chaque composant, un par un (rouge côté pile +, noire côté pile −).',
  'Dans un circuit série coupé, toute la tension se retrouve aux bornes de l’élément ouvert. Cherche où sont passés les volts !',
];

const SEG_MAP = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  ' ': '', '-': 'g', O: 'abcdef', L: 'def', E: 'adefg', r: 'eg', o: 'cdeg', n: 'ceg', F: 'aefg',
};

const PROBE_COLORS = {
  red: { body: '#d63a2f', dark: '#8e1d16', angle: 18 },
  black: { body: '#2c3032', dark: '#0f1011', angle: -18 },
};

export function initDiag() {
  const bench = $('.bench');
  if (!bench) return;
  const board = $('.diag-svg', bench);
  const overlay = $('.bench-overlay', bench);
  const lcdSvg = $('.lcd-svg', bench);
  const lcdBox = $('.lcd', bench);
  const pop = $('.replace-pop', bench);
  const success = $('.bench-success', bench);
  const msgEl = $('.bench-msg');
  const live = $('[data-meter-live]', bench);
  const knob = $('.dial-knob', bench);
  const led = $('[data-part="D1"]', board);
  const sw = $('[data-part="SW1"]', board);
  const cap = $('[data-part="C1"]', board);
  // Indices visuels : condensateur gonflé, LED montée à l'envers
  const showVisualFault = () => {
    cap.classList.toggle('is-bulged', st.fault === 'C1');
    led.classList.toggle('is-reversed', st.fault === 'D1R');
  };
  const stats = Object.fromEntries($$('[data-stat]').map((n) => [n.dataset.stat, n]));
  const selects = Object.fromEntries($$('.probe-select select', bench).map((s) => [s.dataset.probe, s]));
  const reduce = reducedMotion();

  const snaps = new Map($$('[data-snap]', board).map((n) => [n.dataset.snap, { el: n, node: n.dataset.node }]));

  const st = {
    fault: null,
    solved: null,
    lastFault: null,
    power: true,
    mode: $('input[name="meter-mode"]:checked', bench)?.value ?? 'v',
    pending: null,
    capReversed: false, // condensateur neuf monté à l'envers : il lâchera à la mise sous tension
    measures: 0,
    lastKey: '',
    wasted: 0,
    t0: 0,
    timer: 0,
    done: false,
    hint: 0,
  };

  /* =========================================================
     Simulation électrique
     ========================================================= */
  const conducts = (part) => {
    if (part === 'SW1') return st.power;
    if (part === 'D1' && st.fault === 'D1R') return false; // LED à l'envers : bloquée
    return part !== st.fault;
  };
  // C1 en court-circuit fait s'effondrer la tension de la pile
  const vbat = () => (st.fault === 'BAT1' ? BAT_DEAD : st.fault === 'C1' ? 0.04 : BAT_V);

  function solve() {
    const V = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    const vb = vbat();
    const open = CHAIN.map((p) => !conducts(p));
    if (!open.some(Boolean) && vb > LED_VF) {
      const I = (vb - LED_VF) / (BAT_RI + RES.SW1 + RES.F1 + RES.R1 + LED_RD + RES.W1);
      let v = vb - I * BAT_RI;
      V.A = v;
      v -= I * RES.SW1; V.B = v;
      v -= I * RES.F1; V.C = v;
      v -= I * RES.R1; V.D = v;
      v -= LED_VF + I * LED_RD; V.E = v;
      V.F = 0;
      return { V, I };
    }
    if (!open.some(Boolean)) open[3] = true; // LED bloquée : tension trop faible
    V.A = vb;
    for (let i = 0; i < CHAIN.length && !open[i]; i++) V[NODES[i + 1]] = vb;
    for (let i = CHAIN.length - 1; i >= 0 && !open[i]; i--) V[NODES[i]] = 0;
    return { V, I: 0 };
  }

  function measure() {
    const red = st.probes.red;
    const black = st.probes.black;
    if (st.mode === 'off') return { off: true, spoken: 'multimètre éteint' };
    if (!red || !black) {
      return st.mode === 'v' ? { text: '0.00', unit: 'V', spoken: '0 volt' } : { text: 'O.L', unit: 'ohm', spoken: 'circuit ouvert' };
    }
    const nr = snaps.get(red).node;
    const nb = snaps.get(black).node;

    if (st.mode === 'v') {
      const { V } = solve();
      const v = V[nr] - V[nb];
      const a = Math.abs(v);
      const text = a < 10 ? a.toFixed(2) : a.toFixed(1);
      return { text, neg: v < -0.004, unit: 'V', spoken: `${v < -0.004 ? 'moins ' : ''}${text.replace('.', ',')} ${a < 2 ? 'volt' : 'volts'}` };
    }

    // Secret : les deux pointes sur la même pastille = test des cordons (on lit leur résistance)
    if (red === black && (st.mode === 'ohm' || st.mode === 'cont')) {
      return { text: LEADS.toFixed(1), unit: 'ohm', beep: st.mode === 'cont', leadsTest: true, spoken: `${LEADS.toFixed(1).replace('.', ',')} ohm : test des cordons` };
    }

    if (st.power) return { text: 'Err', warn: 'power', spoken: 'erreur : circuit sous tension' };
    const pair = [nr, nb].sort().join('');
    if (pair === 'AF') return { text: 'Err', warn: 'battery', spoken: 'erreur : mesure aux bornes de la pile' };

    const i = NODES.indexOf(nr);
    const j = NODES.indexOf(nb);
    const parts = CHAIN.slice(Math.min(i, j), Math.max(i, j));
    const isOpen = parts.some((p) => !conducts(p));
    const sumR = parts.reduce((s, p) => s + (RES[p] ?? 0), 0) + LEADS;

    if (st.mode === 'diode') {
      // La LED se teste selon son sens de montage : on regarde les autres éléments à part
      if (parts.some((p) => p !== 'D1' && !conducts(p)) || (parts.includes('D1') && st.fault === 'D1')) {
        return { text: 'O.L', unit: 'diode', spoken: 'circuit ouvert' };
      }
      if (parts.includes('D1')) {
        const redOnBatteryPlusSide = i < j;
        const forward = st.fault === 'D1R' ? !redOnBatteryPlusSide : redOnBatteryPlusSide;
        if (!forward) return { text: 'O.L', unit: 'diode', spoken: 'circuit ouvert, diode en inverse' };
        const v = 1.85 + (sumR - LEADS) * 0.001;
        return { text: v.toFixed(3), unit: 'diode', ledDim: true, spoken: `${v.toFixed(3).replace('.', ',')} volt, la LED s'éclaire faiblement` };
      }
      const v = sumR * 0.001;
      return { text: v.toFixed(3), unit: 'diode', beep: v < 0.05, spoken: `${v.toFixed(3).replace('.', ',')} volt` };
    }

    if (isOpen || parts.includes('D1')) return { text: 'O.L', unit: 'ohm', spoken: 'circuit ouvert' };
    const ohms = `${sumR.toFixed(1).replace('.', ',')} ${sumR < 2 ? 'ohm' : 'ohms'}`;
    if (st.mode === 'cont') {
      return sumR < 400
        ? { text: sumR.toFixed(1), unit: 'ohm', beep: sumR < 30, spoken: `${ohms}${sumR < 30 ? ', bip' : ''}` }
        : { text: 'O.L', unit: 'ohm', spoken: 'pas de continuité' };
    }
    return { text: sumR.toFixed(1), unit: 'ohm', spoken: ohms };
  }

  /* =========================================================
     Écran LCD 7 segments
     ========================================================= */
  const lcd = buildLcd(lcdSvg);

  function renderLcd(m) {
    lcdBox.classList.toggle('is-off', !!m.off);
    const cells = [];
    for (const ch of m.off ? '' : m.text) {
      if (ch === '.') {
        if (cells.length) cells[cells.length - 1].dp = true;
      } else cells.push({ ch, dp: false });
    }
    while (cells.length < 4) cells.unshift({ ch: ' ', dp: false });
    cells.slice(-4).forEach((c, k) => {
      const on = SEG_MAP[c.ch] ?? '';
      for (const s of 'abcdefg') lcd.digits[k].segs[s].classList.toggle('on', on.includes(s));
      lcd.digits[k].dp.classList.toggle('on', c.dp);
    });
    lcd.minus.classList.toggle('on', !!m.neg);
    const ann = {
      AUTO: !m.off && st.mode !== 'diode',
      DC: !m.off && st.mode === 'v',
      BEEP: !m.off && st.mode === 'cont',
      DIODE: !m.off && st.mode === 'diode',
      OHM: !m.off && (st.mode === 'ohm' || st.mode === 'cont'),
      V: !m.off && (st.mode === 'v' || st.mode === 'diode'),
    };
    for (const [k, on] of Object.entries(ann)) lcd.ann[k].classList.toggle('on', on);
  }

  /* =========================================================
     Mise à jour générale
     ========================================================= */
  let liveTimer = 0;
  function update({ count = false } = {}) {
    const m = measure();
    renderLcd(m);

    const both = st.probes.red && st.probes.black;
    if (m.beep && both) loopStart('beep');
    else loopStop('beep');

    const { I } = solve();
    const lit = I > 0.002;
    led.classList.toggle('is-lit', lit);
    led.classList.toggle('is-dim', !lit && !!m.ledDim);
    bench.classList.toggle('is-live', lit);

    if (m.warn === 'power') say("Coupe d'abord l'alimentation avec SW1 : on ne mesure jamais une résistance sous tension.", 'warn');
    else if (m.warn === 'battery') say("On ne mesure pas une pile à l'ohmmètre : passe en V pour vérifier sa tension.", 'warn');
    else if (m.leadsTest) {
      say('Bon réflexe : on vérifie toujours ses cordons avant de mesurer ! 0,2 Ω, c’est la résistance des fils : à retrancher des petites mesures.', 'good');
      discover('cordons');
    }

    if (count && both && st.mode !== 'off') {
      const key = `${st.mode}|${st.probes.red}|${st.probes.black}|${st.power}|${st.fault}`;
      if (key !== st.lastKey) {
        st.lastKey = key;
        st.measures++;
        renderStats();
      }
    }
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = `Lecture : ${m.spoken}`; }, 250);
  }

  function say(text, kind = '') {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.toggle('is-warn', kind === 'warn');
    msgEl.classList.toggle('is-good', kind === 'good');
  }

  function renderStats() {
    stats.measures && (stats.measures.textContent = String(st.measures));
    stats.wasted && (stats.wasted.textContent = String(st.wasted));
    stats.time && (stats.time.textContent = fmtTime(elapsed()));
  }
  const elapsed = () => (st.t0 ? (st.done ? st.doneAt : Date.now()) - st.t0 : 0);
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  function startClock() {
    if (st.t0 || st.done) return;
    st.t0 = Date.now();
    st.timer = setInterval(renderStats, 1000);
  }

  /* =========================================================
     Sondes (glisser-déposer + câbles souples)
     ========================================================= */
  st.probes = { red: null, black: null };
  const probes = {};
  const cablesG = svg('g', {}, overlay);
  const ring = svg('circle', { class: 'snap-ring', r: 16, cx: -50, cy: -50 }, overlay);
  for (const which of ['black', 'red']) {
    const c = PROBE_COLORS[which];
    const cable = svg('path', { class: `cable cable-${which}`, 'stroke-width': 5 }, cablesG);
    const shine = svg('path', { class: 'cable-shine' }, cablesG);
    const g = svg('g', { class: `probe probe-${which}`, tabindex: '-1' }, overlay);
    svg('rect', { class: 'probe-grab', x: -18, y: -104, width: 36, height: 112, rx: 10 }, g);
    svg('path', { d: 'M0 0 L-1.4 -5 L-1.4 -22 L1.4 -22 L1.4 -5 Z', fill: '#dfe2de' }, g);
    svg('rect', { x: -8, y: -28, width: 16, height: 7, rx: 2, fill: c.dark }, g);
    svg('rect', { x: -5.5, y: -86, width: 11, height: 60, rx: 5.5, fill: c.body }, g);
    for (let k = 0; k < 5; k++) svg('rect', { x: -5.5, y: -76 + k * 8, width: 11, height: 2, fill: c.dark, opacity: 0.6 }, g);
    svg('rect', { x: -4, y: -100, width: 8, height: 16, rx: 3, fill: c.dark }, g);
    probes[which] = {
      which, g, cable, shine,
      x: 0, y: 0, angle: 0, targetAngle: 0,
      sag: 40, sv: 0, vx: 0,
      anim: null, dragging: false,
      jack: $(which === 'red' ? '.jack-v i' : '.jack-com i', bench),
      dock: $(which === 'red' ? '.dock-red' : '.dock-black', bench),
    };
  }

  const ref = () => overlay.getBoundingClientRect();
  function centerOf(node) {
    const a = node.getBoundingClientRect();
    const b = ref();
    return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
  }
  function restPos(p) {
    const a = p.dock.getBoundingClientRect();
    const b = ref();
    return { x: a.left + a.width / 2 - b.left, y: a.bottom - b.top - 8 };
  }
  function homeOf(p) {
    const id = st.probes[p.which];
    return id ? { ...centerOf(snaps.get(id).el), angle: PROBE_COLORS[p.which].angle } : { ...restPos(p), angle: 0 };
  }

  function drawProbe(p) {
    p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
    const rad = (p.angle * Math.PI) / 180;
    const bx = p.x + Math.sin(rad) * 100;
    const by = p.y - Math.cos(rad) * 100;
    const j = centerOf(p.jack);
    const dist = Math.hypot(j.x - bx, j.y - by);
    const c1x = bx + Math.sin(rad) * Math.min(80, dist * 0.35);
    const c1y = by - Math.cos(rad) * Math.min(80, dist * 0.35) + p.sag * 0.6;
    const c2x = j.x;
    const c2y = j.y + 60 + p.sag;
    const d = `M${bx.toFixed(1)} ${by.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${j.x.toFixed(1)} ${j.y.toFixed(1)}`;
    p.cable.setAttribute('d', d);
    p.shine.setAttribute('d', d);
  }

  function layout() {
    const r = ref();
    overlay.setAttribute('viewBox', `0 0 ${r.width.toFixed(0)} ${r.height.toFixed(0)}`);
    for (const p of Object.values(probes)) {
      if (p.dragging || p.anim) continue;
      const h = homeOf(p);
      p.x = h.x; p.y = h.y; p.angle = h.angle; p.targetAngle = h.angle;
      drawProbe(p);
    }
  }

  // Petite boucle d'animation : trajets des sondes + balancement des câbles
  let raf = 0;
  let lastT = 0;
  function tick(t) {
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    let busy = false;
    for (const p of Object.values(probes)) {
      if (p.anim) {
        const k = clamp((t - p.anim.t0) / p.anim.dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        p.x = p.anim.from.x + (p.anim.to.x - p.anim.from.x) * e;
        p.y = p.anim.from.y + (p.anim.to.y - p.anim.from.y) * e;
        p.angle = p.anim.from.angle + (p.anim.to.angle - p.anim.from.angle) * e;
        if (k >= 1) { p.anim = null; p.targetAngle = p.angle; }
        busy = true;
      } else if (p.dragging) {
        p.angle += (p.targetAngle - p.angle) * Math.min(1, dt * 10);
        busy = true;
      }
      const j = centerOf(p.jack);
      const target = clamp(Math.hypot(j.x - p.x, j.y - p.y) * 0.22, 24, 120);
      p.sv += (target - p.sag) * 60 * dt;
      p.sv *= Math.pow(0.02, dt);
      p.sag += p.sv * dt;
      if (Math.abs(p.sv) > 0.5 || Math.abs(target - p.sag) > 0.5) busy = true;
      drawProbe(p);
    }
    raf = busy ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => {
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  };

  function moveProbe(which, snapId, { animate = true } = {}) {
    const p = probes[which];
    st.probes[which] = snapId;
    const to = homeOf(p);
    if (animate && !reduce) {
      p.anim = { from: { x: p.x, y: p.y, angle: p.angle }, to, t0: performance.now(), dur: 320 };
      p.sv -= 80;
      kick();
    } else {
      p.x = to.x; p.y = to.y; p.angle = to.angle;
      drawProbe(p);
    }
    if (selects[which]) selects[which].value = snapId ?? '';
    if (snapId) {
      sfx('snap');
      const c = centerOf(snaps.get(snapId).el);
      const spark = svg('circle', { class: 'spark', cx: c.x, cy: c.y, r: 6 }, overlay);
      setTimeout(() => spark.remove(), 500);
    }
    update({ count: true });
  }

  function nearestSnap(x, y) {
    let best = null;
    let bestD = 40;
    for (const [id, s] of snaps) {
      const c = centerOf(s.el);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  for (const p of Object.values(probes)) {
    let off = { x: 0, y: 0 };
    let pid = null;
    let lastX = 0;
    let cand = null;
    p.g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pid = e.pointerId;
      try { p.g.setPointerCapture(pid); } catch { /* capture indisponible : on suit la fenêtre */ }
      const r = ref();
      off = { x: e.clientX - r.left - p.x, y: e.clientY - r.top - p.y };
      lastX = e.clientX;
      p.dragging = true;
      p.anim = null;
      p.g.classList.add('is-drag');
      if (st.probes[p.which]) {
        st.probes[p.which] = null;
        if (selects[p.which]) selects[p.which].value = '';
        update();
      }
      startClock();
      closePop();
      kick();
    });
    const onMove = (e) => {
      if (e.pointerId !== pid) return;
      const r = ref();
      p.x = e.clientX - r.left - off.x;
      p.y = e.clientY - r.top - off.y;
      p.vx = e.clientX - lastX;
      lastX = e.clientX;
      p.targetAngle = PROBE_COLORS[p.which].angle + clamp(p.vx * 1.6, -28, 28);
      p.sv += p.vx * 0.6;
      cand = nearestSnap(p.x, p.y);
      $$('.is-target', board).forEach((n) => n.classList.remove('is-target'));
      if (cand) {
        const s = snaps.get(cand);
        s.el.classList.add('is-target');
        const c = centerOf(s.el);
        ring.setAttribute('cx', c.x);
        ring.setAttribute('cy', c.y);
        ring.classList.add('is-on');
      } else ring.classList.remove('is-on');
      kick();
    };
    const end = (e) => {
      if (pid === null || e.pointerId !== pid) return;
      if (e.type === 'pointerup') onMove(e); // position finale exacte
      pid = null;
      p.dragging = false;
      p.g.classList.remove('is-drag');
      ring.classList.remove('is-on');
      $$('.is-target', board).forEach((n) => n.classList.remove('is-target'));
      moveProbe(p.which, cand);
      cand = null;
    };
    p.g.addEventListener('pointermove', onMove);
    window.addEventListener('pointermove', (e) => { if (!p.g.hasPointerCapture?.(e.pointerId)) onMove(e); });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    p.g.addEventListener('lostpointercapture', (e) => setTimeout(() => end({ type: 'lost', pointerId: e.pointerId }), 0));
  }

  // Alternative clavier / mobile : listes déroulantes
  for (const [which, sel] of Object.entries(selects)) {
    const group = el('optgroup', { attrs: { label: 'Pattes des composants' } });
    for (const [id, label] of Object.entries(SNAP_LABELS)) group.appendChild(el('option', { text: label, attrs: { value: id } }));
    sel.appendChild(group);
    sel.addEventListener('change', () => {
      startClock();
      moveProbe(which, sel.value || null);
    });
  }

  /* =========================================================
     Multimètre : calibre, rétroéclairage
     ========================================================= */
  const ANGLES = { off: -72, v: -36, ohm: 0, cont: 36, diode: 72 };
  const setKnob = () => knob.style.setProperty('--knob', `${ANGLES[st.mode]}deg`);
  $$('input[name="meter-mode"]', bench).forEach((input) => {
    input.addEventListener('change', () => {
      st.mode = input.value;
      setKnob();
      sfx('clack');
      startClock();
      update({ count: true });
    });
  });
  setKnob();
  $('.meter-light', bench)?.addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    lcdBox.classList.toggle('is-lit', on);
    sfx('click');
  });

  /* =========================================================
     Interrupteur, remplacement de pièces
     ========================================================= */
  function setPower(on) {
    st.power = on;
    sw.classList.toggle('is-on', on);
    sw.setAttribute('aria-checked', String(on));
    $('.sw-state', sw).textContent = on ? 'ON' : 'OFF';
    sfx('clack');
    update({ count: true });
    if (!on) {
      say("Alimentation coupée : tu peux mesurer en Ω, en continuité ou en test diode… et remplacer une pièce.");
      return;
    }
    if (st.capReversed) capPop();
    else if (st.fault === null && !st.done) succeed();
    else if (st.pending === 'rework') {
      st.pending = null;
      sfx('buzz');
      say('La LED reste éteinte… Tu as changé la bonne pièce, mais vérifie ton travail : sens de montage, soudures. Mesure à nouveau !', 'warn');
    } else if (st.pending === 'bad') {
      st.pending = null;
      sfx('buzz');
      say('La LED reste éteinte… La pièce remplacée était bonne : on mesure toujours avant de remplacer !', 'warn');
    } else say('Sous tension.');
  }

  let popPart = null;
  function openPop(part) {
    popPart = part;
    const g = $(`[data-part="${part}"]`, board);
    $$('.part.is-picked', board).forEach((n) => n.classList.remove('is-picked'));
    g.classList.add('is-picked');
    const title = $('.rp-title', pop);
    const text = $('.rp-text', pop);
    const ok = $('[data-rp="ok"]', pop);
    title.textContent = `Remplacer ${PART_NAMES[part]} ?`;
    if (st.power) {
      text.textContent = "Le circuit est sous tension : coupe d'abord l'alimentation (SW1) avant de dessouder.";
      ok.textContent = 'Couper SW1';
      ok.dataset.action = 'power';
    } else {
      text.textContent = SOLDERED.has(part)
        ? 'Direction le poste de soudure : flux, tresse, fer, étain… comme en atelier.'
        : part === 'BAT1'
          ? 'La pile est sur un clip : pas besoin de souder.'
          : 'Le fusible est dans un porte-fusible : il se change à la main.';
      ok.textContent = 'Remplacer';
      ok.dataset.action = 'replace';
    }
    pop.hidden = false;
    const host = pop.parentElement.getBoundingClientRect();
    const b = g.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = clamp(b.left + b.width / 2 - host.left - w / 2, 0, host.width - w);
    let top = b.bottom - host.top + 8;
    if (top + h > host.height) top = Math.max(0, b.top - host.top - h - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    ok.focus();
  }
  function closePop() {
    if (pop.hidden) return;
    pop.hidden = true;
    $$('.part.is-picked', board).forEach((n) => n.classList.remove('is-picked'));
    const back = popPart && $(`[data-part="${popPart}"]`, board);
    popPart = null;
    if (back && pop.contains(document.activeElement)) back.focus();
  }

  function replace(part) {
    const g = $(`[data-part="${part}"]`, board);
    pop.hidden = true;
    popPart = null;
    g.classList.remove('is-picked');
    if (SOLDERED.has(part)) {
      // Pièce soudée : direction le poste de soudure (le geste compte !)
      openRework({
        part,
        bulged: part === 'C1' && st.fault === 'C1',
        oldFlip: part === 'D1' && st.fault === 'D1R',
        cracked: part === 'W1' && st.fault === 'W1',
        onDone: (r) => fitted(part, r),
        onCancel: () => { say('Remplacement annulé : la carte est comme avant.'); g.focus(); },
      });
      return;
    }
    sfx('hiss');
    g.classList.add('is-desolder');
    setTimeout(() => {
      g.classList.remove('is-desolder');
      fitted(part, { quick: true, polarityOk: true, conductive: true });
    }, reduce ? 0 : 560);
  }

  /** Pièce neuve en place : selon la qualité du travail, la panne disparaît… ou change de visage. */
  function fitted(part, r) {
    const g = $(`[data-part="${part}"]`, board);
    g.classList.add('is-new');
    sfx('tink');
    setTimeout(() => g.classList.remove('is-new'), 650);
    if (st.fault && part === FAULTS[st.fault].part) {
      st.fault = null;
      if (part === 'C1' && !r.polarityOk) st.capReversed = true; // il « explosera » à la mise sous tension
      else if (part === 'D1' && !r.polarityOk) st.fault = 'D1R';
      else if (part !== 'C1' && !r.conductive) st.fault = part; // soudure ratée : circuit ouvert à cet endroit
      st.pending = st.fault ? 'rework' : 'good';
      showVisualFault();
    } else {
      st.wasted++;
      st.pending = 'bad';
    }
    renderStats();
    update();
    const done = {
      BAT1: 'Pile neuve clipsée.',
      F1: 'Fusible neuf posé dans son porte-fusible.',
    }[part] ?? (r.quick ? 'Pièce remplacée.' : 'Carte remise sur le banc.');
    say(`${done} Remets sous tension avec SW1 pour vérifier.`);
    g.focus();
  }

  /** Condensateur chimique monté à l'envers : à la mise sous tension, il gonfle et lâche. */
  function capPop() {
    st.capReversed = false;
    setTimeout(() => {
      st.fault = 'C1';
      st.wasted++;
      showVisualFault();
      sfx('zap');
      sfx('hiss');
      const c = centerOf(cap);
      for (let k = 0; k < 6; k++) {
        setTimeout(() => {
          const p = svg('circle', { class: 'puff puff-dark', cx: c.x + (Math.random() - 0.5) * 24, cy: c.y - 30, r: 6 }, overlay);
          p.style.setProperty('--dx', `${((Math.random() - 0.5) * 50).toFixed(0)}px`);
          setTimeout(() => p.remove(), 1500);
        }, k * 90);
      }
      renderStats();
      update();
      say('Pop ! Le condensateur était monté à l’envers : il a gonflé et s’est mis en court-circuit. La bande « − » doit être côté −. Coupe SW1 et recommence…', 'warn');
    }, reduce ? 0 : 700);
  }

  $('[data-rp="ok"]', pop).addEventListener('click', (e) => {
    const part = popPart;
    if (!part) return;
    if (e.currentTarget.dataset.action === 'power') {
      setPower(false);
      openPop(part);
    } else replace(part);
  });
  $('[data-rp="cancel"]', pop).addEventListener('click', closePop);
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.part')) closePop();
  });

  $$('.part', board).forEach((g) => {
    const act = () => {
      // Secret : 10 clics rapides sur le fusible F1… il finit par sauter
      if (g.dataset.part === 'F1') {
        const now = Date.now();
        fuseClicks = fuseClicks.filter((t) => now - t < 3000).concat(now);
        if (fuseClicks.length >= 10) {
          fuseClicks = [];
          fuseAbuse();
          return;
        }
      }
      if (st.done) return;
      startClock();
      if (g.dataset.part === 'SW1') {
        closePop();
        setPower(!st.power);
      } else openPop(g.dataset.part);
    };
    g.addEventListener('click', act);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); }
    });
  });

  /* ---------- Secret : le fusible maltraité ---------- */
  let fuseClicks = [];
  let fuseBusy = false;
  function fuseAbuse() {
    if (fuseBusy) return;
    fuseBusy = true;
    closePop();
    const f1 = $('[data-part="F1"]', board);
    f1.classList.add('is-blown');
    bench.classList.add('is-glitch');
    lcdBox.classList.add('is-off');
    loopStop('beep');
    sfx('zap');
    sfx('hiss');
    const c = centerOf(f1);
    for (let k = 0; k < 7; k++) {
      setTimeout(() => {
        const p = svg('circle', { class: 'puff puff-dark', cx: c.x + (Math.random() - 0.5) * 30, cy: c.y - 4, r: 6 }, overlay);
        p.style.setProperty('--dx', `${((Math.random() - 0.5) * 50).toFixed(0)}px`);
        setTimeout(() => p.remove(), 1500);
      }, k * 90);
    }
    say('Clac ! Le fusible a sauté… Un fusible, ça protège : ça ne se martyrise pas 😅', 'warn');
    discover('fuse');

    setTimeout(() => {
      bench.classList.remove('is-glitch');
      f1.classList.remove('is-blown');
      f1.classList.add('is-new');
      setTimeout(() => f1.classList.remove('is-new'), 650);
      sfx('tink');
      // Redémarrage : comme un vrai multimètre, tous les segments s'allument un instant
      lcdBox.classList.remove('is-off');
      lcd.digits.forEach((d) => { Object.values(d.segs).forEach((s) => s.classList.add('on')); d.dp.classList.add('on'); });
      lcd.minus.classList.add('on');
      Object.values(lcd.ann).forEach((a) => a.classList.add('on'));
      say('Fusible neuf posé par le technicien de garde. Le banc redémarre…');
      setTimeout(() => {
        fuseBusy = false;
        update();
      }, 900);
    }, reduce ? 300 : 1500);
  }

  /* =========================================================
     Victoire, indices, nouvelle panne
     ========================================================= */
  function succeed() {
    st.done = true;
    st.doneAt = Date.now();
    clearInterval(st.timer);
    renderStats();
    sfx('chime');
    say('La LED s’allume : panne réparée !', 'good');
    achieve('repair');
    const f = FAULTS[st.solved];
    setTimeout(() => {
      $('.bs-title', success).textContent = `Panne trouvée : ${f.name}.`;
      const n = st.measures;
      $('.bs-stats', success).textContent = `${n} mesure${n > 1 ? 's' : ''} · ${fmtTime(elapsed())} · ${st.wasted} pièce${st.wasted > 1 ? 's' : ''} gaspillée${st.wasted > 1 ? 's' : ''}`;
      $('.bs-tip', success).textContent = f.tip;
      success.hidden = false;
      $('[data-new]', success).focus();
    }, reduce ? 0 : 1400);
  }

  function newFault() {
    const keys = Object.keys(FAULTS).filter((k) => k !== st.lastFault);
    st.fault = keys[Math.floor(Math.random() * keys.length)];
    st.solved = st.fault;
    st.lastFault = st.fault;
    st.pending = null;
    st.capReversed = false;
    showVisualFault();
    st.measures = 0;
    st.lastKey = '';
    st.wasted = 0;
    st.done = false;
    st.hint = 0;
    clearInterval(st.timer);
    st.t0 = 0;
    success.hidden = true;
    closePop();
    st.power = false;
    setPowerSilently(true);
    moveProbe('red', null, { animate: false });
    moveProbe('black', null, { animate: false });
    st.measures = 0;
    st.lastKey = '';
    renderStats();
    say('Nouvelle panne ! La LED D1 reste éteinte. À toi de trouver pourquoi.');
  }
  function setPowerSilently(on) {
    st.power = on;
    sw.classList.toggle('is-on', on);
    sw.setAttribute('aria-checked', String(on));
    $('.sw-state', sw).textContent = on ? 'ON' : 'OFF';
  }

  $$('[data-new]').forEach((b) => b.addEventListener('click', () => { sfx('click'); newFault(); }));
  $('[data-hint]')?.addEventListener('click', () => {
    startClock();
    const text = st.hint < HINTS.length ? HINTS[st.hint] : `Dernier indice : regarde ${FAULTS[st.solved].zone}.`;
    st.hint = Math.min(st.hint + 1, HINTS.length);
    say(`Indice : ${text}`);
    sfx('click');
  });

  /* ---------- Démarrage ---------- */
  new ResizeObserver(layout).observe(bench);
  document.fonts?.ready.then(layout);
  newFault();
  say('Glisse les pointes rouge et noire sur les pastilles dorées.');
  layout();
}

/* ---------- Construction de l'écran LCD ---------- */
function buildLcd(root) {
  const W = 30;
  const H = 50;
  const T = 6;
  const Y = 28;
  const polys = segPolys(W, H, T);
  const digits = [34, 76, 118, 160].map((x) => {
    const g = svg('g', { transform: `translate(${x} ${Y}) skewX(-7)` }, root);
    const segs = {};
    for (const [name, pts] of Object.entries(polys)) segs[name] = svg('polygon', { class: 'seg', points: pts }, g);
    const dp = svg('circle', { class: 'seg', cx: W + 6, cy: H - 2, r: 3 }, g);
    return { segs, dp };
  });
  const minus = svg('rect', { class: 'seg', x: 10, y: Y + H / 2 - 3, width: 16, height: 6, rx: 1 }, root);
  const text = (label, x, y, extra = '') => {
    const t = svg('text', { class: `ann ${extra}`, x, y }, root);
    t.textContent = label;
    return t;
  };
  const ann = {
    AUTO: text('AUTO', 8, 16),
    DC: text('DC', 48, 16),
    BEEP: text('•)))', 74, 16),
    DIODE: text('▶|', 110, 16),
    OHM: text('Ω', 204, 50, 'ann-big'),
    V: text('V', 205, 78, 'ann-big'),
  };
  return { digits, minus, ann };
}

function segPolys(w, h, t) {
  const g = 1.3;
  const ht = t / 2;
  const hor = (x1, x2, y) => `${x1},${y} ${x1 + ht},${y - ht} ${x2 - ht},${y - ht} ${x2},${y} ${x2 - ht},${y + ht} ${x1 + ht},${y + ht}`;
  const ver = (x, y1, y2) => `${x},${y1} ${x + ht},${y1 + ht} ${x + ht},${y2 - ht} ${x},${y2} ${x - ht},${y2 - ht} ${x - ht},${y1 + ht}`;
  const l = ht;
  const r = w - ht;
  const top = ht;
  const mid = h / 2;
  const bot = h - ht;
  return {
    a: hor(l + g, r - g, top),
    g: hor(l + g, r - g, mid),
    d: hor(l + g, r - g, bot),
    f: ver(l, top + g, mid - g),
    b: ver(r, top + g, mid - g),
    e: ver(l, mid + g, bot - g),
    c: ver(r, mid + g, bot - g),
  };
}
