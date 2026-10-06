// Poste de soudure : remplacer un composant comme en atelier (« rework »).
// Vue en coupe : le composant au-dessus de la carte, ses deux soudures en dessous.
// Dessoudage (flux, tresse + fer), retrait aux brucelles, pose du neuf dans le bon sens,
// soudure (fer d'abord, puis l'étain, on retire l'étain, puis le fer), coupe des pattes,
// nettoyage du flux. Le résultat (sens, soudures) a des conséquences sur le banc de test.

import { $, $$, svg, el, clamp, reducedMotion } from './util.js';
import { sfx, loopStart, loopStop } from './audio.js';

const X = [280, 360]; // trous des deux pattes
const TOP = 200; // dessus de la carte (côté composants)
const BOT = 216; // dessous de la carte (côté soudures)
const LEAD_LONG = 254; // bout des pattes d'une pièce neuve
const LEAD_CUT = 229; // après la pince coupante
const MELT = 250; // °C : en dessous, l'étain accroche mal (soudure froide)
const CLEAN = 0.12; // volume d'étain sous lequel la pastille est considérée propre
const IRON_T = 340; // température de la panne du fer

const PARTS = {
  C1: {
    kind: 'cap', what: 'le condensateur', polar: true, pins: ['patte +', 'patte −'],
    help: 'Sur la carte, « + » marque la patte positive. Sur le condensateur, la bande claire marque la patte négative (−).',
    wrong: 'Condensateur monté à l’envers : sous tension, un condensateur chimique inversé gonfle… voire éclate !',
  },
  R1: {
    kind: 'res', what: 'la résistance', polar: false, pins: ['patte gauche', 'patte droite'],
    help: 'Une résistance n’a pas de sens : elle se monte dans un sens comme dans l’autre.',
  },
  D1: {
    kind: 'led', what: 'la LED', polar: true, pins: ['anode (+)', 'cathode (−)'],
    help: 'Le côté plat (méplat) et la grosse pièce interne marquent la cathode (−). Sur la carte, « + » marque l’anode.',
    wrong: 'LED montée à l’envers : elle bloque le courant et restera éteinte.',
  },
  W1: {
    kind: 'strap', what: 'le strap', polar: false, pins: ['patte gauche', 'patte droite'],
    help: 'Un strap est un simple fil : il n’a pas de sens.',
  },
};

const TOOLS = [
  ['iron', '🔥', 'Fer'],
  ['flux', '💧', 'Flux'],
  ['braid', '🧶', 'Tresse'],
  ['solder', '➰', 'Étain'],
  ['tweezers', '🥢', 'Brucelles'],
  ['cutter', '✂️', 'Pince coupante'],
  ['ipa', '🧴', 'Alcool'],
];
const TOOL_HINTS = {
  iron: 'Fer : clique sur une soudure (sous la carte) pour y poser la panne, reclique pour le retirer.',
  flux: 'Flux : clique sur une soudure pour en déposer.',
  braid: 'Tresse : pose-la sur une soudure, puis chauffe-la avec le fer.',
  solder: 'Étain : maintiens appuyé sur la soudure où se trouve le fer.',
  tweezers: 'Brucelles : clique sur le composant pour le retirer.',
  cutter: 'Pince coupante : clique sur une patte soudée pour la couper au ras.',
  ipa: 'Alcool isopropylique : clique sur la carte pour nettoyer le flux.',
};
const QUALITY_MSG = {
  good: 'Belle soudure ✔ Brillante, en petit volcan autour de la patte.',
  cold: 'Soudure froide ✖ Terne et granuleuse : l’étain a touché une pastille pas assez chaude. Reprends-la : un peu de flux, puis le fer.',
  low: 'Pas assez d’étain ✖ La pastille n’est pas couverte : rajoute-en un peu (fer, puis étain).',
  blob: 'Trop d’étain ⚠ Une grosse boule : elle peut cacher un défaut ou toucher une piste voisine. Retire l’excès à la tresse.',
  none: 'Pas d’étain sur cette pastille.',
};
const QUALITY_LABEL = {
  good: 'brillante, en volcan', cold: 'froide (terne, granuleuse)', low: 'pas assez d’étain', blob: 'trop d’étain', none: 'pas soudée',
};

const quality = (j) => (j.v < CLEAN ? 'none' : j.cold ? 'cold' : j.v < 0.7 ? 'low' : j.v > 1.3 ? 'blob' : 'good');

let dlg = null;
let ready = false;
let s = null; // séance en cours
let raf = 0;
const ui = {};
const refs = {};

/**
 * Ouvre le poste de soudure pour `part` (C1, R1, D1 ou W1).
 * opts : { part, bulged, oldFlip, cracked, onDone(result), onCancel() }
 * result : { quick, polarityOk, conductive }
 */
export function openRework(opts) {
  if (!ready && !setup()) {
    opts.onDone({ quick: true, polarityOk: true, conductive: true });
    return;
  }
  s = fresh(opts);
  const cfg = PARTS[opts.part];
  ui.title.textContent = `Remplacer ${cfg.what} ${opts.part}`;
  build();
  closeReport();
  pickTool(null, { quiet: true });
  dlg.showModal();
  document.documentElement.classList.add('has-dialog');
  say(intro());
  render();
  $('.rw-tool', ui.tools)?.focus();
  s.last = performance.now();
  raf = requestAnimationFrame(tick);
}

function fresh(opts) {
  const cfg = PARTS[opts.part];
  return {
    opts,
    cfg,
    phase: 'old', // old → removed → new
    oldFlip: !!opts.oldFlip,
    flipNew: cfg.polar ? Math.random() < 0.5 : false, // la pièce neuve arrive dans un sens au hasard
    joints: X.map((x, i) => ({
      x, v: 1, v0: 1, T: 25, flux: false, fluxT: 0, braid: false, cold: false, fed: false,
      idle: 0, warned: false, lifted: false, cut: true, cracked: !!opts.cracked && i === 0, cleanSaid: false,
    })),
    tool: null,
    iron: -1,
    feeding: -1,
    fluxUsed: false,
    fluxDesolder: false,
    residue: false,
    noFluxTip: false,
    failed: false,
    reporting: false,
    result: null,
    last: 0,
    smoke: 0,
  };
}

function intro() {
  const { cfg, opts } = s;
  let text = `Dessoude ${cfg.what} ${opts.part} : un peu de flux, puis la tresse et le fer sur chaque soudure (sous la carte).`;
  if (opts.cracked) text += ' Regarde la soudure de gauche : elle est fissurée.';
  if (opts.bulged) text += ' Le dessus gonflé du condensateur ne trompe pas.';
  return text;
}

/* =========================================================
   Mise en place (une seule fois)
   ========================================================= */
function setup() {
  dlg = $('#rework');
  if (!dlg) return false;
  ui.title = $('#rw-title', dlg);
  ui.view = $('.rw-svg', dlg);
  ui.temp = $('.rw-temp', dlg);
  ui.steps = $('.rw-steps', dlg);
  ui.part = $('.rw-part', dlg);
  ui.partSvg = $('.rw-part-svg', dlg);
  ui.partHelp = $('.rw-part-help', dlg);
  ui.rotate = $('[data-rw-rotate]', dlg);
  ui.tools = $('.rw-tools', dlg);
  ui.msg = $('.rw-msg', dlg);
  ui.report = $('.rw-report', dlg);
  ui.checks = $('.rw-checks', dlg);
  ui.foot = $('.rw-foot', dlg);
  ui.back = $('[data-rw-back]', dlg);
  ui.restart = $('[data-rw-restart]', dlg);
  ui.bench = $('[data-rw-bench]', dlg);

  ui.tools.replaceChildren(...TOOLS.map(([id, icon, label]) => el('button', {
    cls: 'rw-tool',
    attrs: { type: 'button', 'data-tool': id, 'aria-pressed': 'false' },
  }, [el('span', { text: icon, attrs: { 'aria-hidden': 'true' } }), el('span', { text: label })])));
  ui.tools.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b && s) pickTool(b.dataset.tool);
  });

  // Cibles (soudures, composant, carte) : souris, tactile et clavier
  ui.view.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-rw-hit]');
    if (!t) return;
    e.preventDefault();
    press(t.dataset.rwHit);
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  ui.view.addEventListener('keydown', (e) => {
    const t = e.target.closest('[data-rw-hit]');
    if (t && (e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press(t.dataset.rwHit);
    }
  });
  ui.view.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(); });
  ui.view.addEventListener('focusout', release);

  ui.rotate.addEventListener('click', () => {
    if (!s) return;
    s.flipNew = !s.flipNew;
    drawPart(ui.partSvg, s.cfg.kind, { flip: s.flipNew });
    sfx('click');
  });
  $('[data-rw-insert]', dlg).addEventListener('click', insertNew);
  $('[data-rw-finish]', dlg).addEventListener('click', openReport);
  $('[data-rw-quick]', dlg).addEventListener('click', () => finish({ quick: true, polarityOk: true, conductive: true }));
  $('[data-rw-close]', dlg).addEventListener('click', () => dlg.close());
  ui.back.addEventListener('click', () => { closeReport(); say('On reprend : tu peux retoucher les soudures.'); });
  ui.bench.addEventListener('click', () => finish(result()));
  ui.restart.addEventListener('click', () => {
    s = fresh(s.opts);
    build();
    closeReport();
    pickTool(null, { quiet: true });
    say(`On recommence. ${intro()}`);
  });
  dlg.addEventListener('close', onClose);
  ready = true;
  return true;
}

function finish(res) {
  if (!s) return;
  s.result = res;
  dlg.close();
}

function onClose() {
  cancelAnimationFrame(raf);
  loopStop('sizzle');
  document.documentElement.classList.remove('has-dialog');
  const done = s;
  s = null;
  if (!done) return;
  if (done.result) done.opts.onDone(done.result);
  else done.opts.onCancel?.();
}

function result() {
  return {
    quick: false,
    polarityOk: !s.flipNew,
    conductive: s.joints.every((j) => ['good', 'blob'].includes(quality(j))),
  };
}

/* =========================================================
   Dessin de la vue en coupe
   ========================================================= */
function build() {
  const v = ui.view;
  v.replaceChildren();
  const defs = svg('defs', {}, v);
  const grad = (tag, id, attrs, stops) => {
    const g = svg(tag, { id, ...attrs }, defs);
    stops.forEach(([o, c, a = 1]) => svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g));
  };
  grad('linearGradient', 'rw-solder', { x1: 0, y1: 0, x2: 1, y2: 1 }, [['0', '#f6f9fa'], ['.45', '#c6cdd1'], ['1', '#7b858a']]);
  grad('linearGradient', 'rw-cold', { x1: 0, y1: 0, x2: 1, y2: 1 }, [['0', '#a9adab'], ['1', '#6c716f']]);
  grad('radialGradient', 'rw-heat', {}, [['0', '#ff8a2a', 0.9], ['.5', '#ff5a1a', 0.35], ['1', '#ff3a10', 0]]);

  svg('rect', { x: 0, y: 0, width: 640, height: 320, class: 'rw-bg' }, v);
  // (la vue est cadrée sur x 140→500, y 46→282)
  svg('text', { x: 150, y: 62, class: 'rw-label' }, v).textContent = 'Côté composants';
  svg('text', { x: 150, y: 274, class: 'rw-label' }, v).textContent = 'Côté soudures (dessous)';

  refs.heat = X.map((x) => svg('circle', { cx: x, cy: BOT + 8, r: 34, fill: 'url(#rw-heat)', opacity: 0 }, v));
  svg('rect', { x: 40, y: TOP, width: 560, height: BOT - TOP, rx: 2, class: 'rw-board' }, v);
  X.forEach((x) => svg('rect', { x: x - 17, y: TOP - 3, width: 34, height: 3, class: 'rw-pad' }, v));
  svg('text', { x: 160, y: TOP - 8, class: 'rw-silk' }, v).textContent = s.opts.part;
  if (s.cfg.polar) svg('text', { x: X[0] - 30, y: TOP - 7, class: 'rw-silk' }, v).textContent = '+';
  // Toute la carte est une cible (pour l'alcool)
  svg('rect', { x: 40, y: TOP - 4, width: 560, height: BOT - TOP + 8, class: 'rw-hit', 'data-rw-hit': 'board', tabindex: -1 }, v);

  refs.comp = svg('g', { class: 'rw-comp' }, v);
  drawPart(refs.comp, s.cfg.kind, { flip: s.oldFlip, bulged: !!s.opts.bulged });
  svg('rect', {
    x: 236, y: 30, width: 168, height: 168, class: 'rw-hit', 'data-rw-hit': 'comp', tabindex: 0, role: 'button',
    'aria-label': `${s.cfg.what} ${s.opts.part} (composant)`,
  }, v);

  refs.j = s.joints.map((j, i) => {
    const g = svg('g', { class: 'rw-joint' }, v);
    const r = {};
    r.pad = svg('rect', { x: j.x - 19, y: BOT, width: 38, height: 3, class: 'rw-pad' }, g);
    r.residue = svg('ellipse', { cx: j.x, cy: BOT + 6, rx: 26, ry: 8, class: 'rw-residue' }, g);
    r.lead = svg('line', { x1: j.x, y1: TOP - 2, x2: j.x, y2: LEAD_CUT, class: 'rw-lead' }, g);
    r.fillet = svg('path', { class: 'rw-fillet' }, g);
    r.crack = svg('path', { d: `M${j.x - 15} ${BOT + 6} l7 3 l5 -2 l6 4`, class: 'rw-crack' }, g);
    r.flux = svg('ellipse', { cx: j.x, cy: BOT + 7, rx: 25, ry: 9, class: 'rw-flux' }, g);
    r.braid = svg('g', { class: 'rw-braid-g' }, g);
    svg('rect', { x: j.x - 70, y: BOT + 4, width: 96, height: 9, rx: 2, class: 'rw-braid' }, r.braid);
    r.silver = svg('rect', { x: j.x - 22, y: BOT + 4, width: 44, height: 9, rx: 2, class: 'rw-braid-silver' }, r.braid);
    r.wire = svg('path', { d: `M${j.x - 96} ${BOT + 74} L${j.x - 5} ${BOT + 11}`, class: 'rw-wire' }, g);
    r.iron = svg('g', { class: 'rw-iron', transform: `translate(${j.x + 4} ${BOT + 10})` }, g);
    svg('path', { d: 'M72 47 L160 105', class: 'rw-iron-grip' }, r.iron);
    svg('path', { d: 'M26 17 L72 47', class: 'rw-iron-shaft' }, r.iron);
    svg('path', { d: 'M1 1 L26 17', class: 'rw-iron-tip' }, r.iron);
    r.glow = svg('circle', { cx: 2, cy: 1, r: 8, class: 'rw-iron-glow' }, r.iron);
    svg('rect', {
      x: j.x - 42, y: BOT - 6, width: 84, height: 64, class: 'rw-hit', 'data-rw-hit': `j${i}`, tabindex: 0, role: 'button',
      'aria-label': `Soudure ${i ? 'droite' : 'gauche'} (${s.cfg.pins[i]})`,
    }, v);
    return r;
  });
  refs.fx = svg('g', { class: 'rw-fx' }, v);
}

/** Composant vu de côté, pattes jusqu'au dessus de la carte. `flip` : monté dans l'autre sens. */
function drawPart(g, kind, { flip = false, bulged = false } = {}) {
  g.replaceChildren();
  const body = svg('g', flip ? { transform: 'translate(640 0) scale(-1 1)' } : {}, g);
  const lead = (d) => svg('path', { d, class: 'rw-lead' }, body);
  if (kind === 'cap') {
    lead(`M${X[0]} 186 V${TOP}`);
    lead(`M${X[1]} 186 V${TOP}`);
    svg('rect', { x: 262, y: 68, width: 116, height: 120, rx: 12, class: 'rw-cap' }, body);
    svg('rect', { x: 352, y: 68, width: 22, height: 120, class: 'rw-cap-stripe' }, body); // bande « − »
    for (const y of [92, 124, 156]) svg('rect', { x: 358, y, width: 10, height: 3, rx: 1, class: 'rw-cap-minus' }, body);
    if (bulged) svg('path', { d: 'M266 72 Q320 30 374 72 Z', class: 'rw-cap-bulge' }, body);
  } else if (kind === 'res') {
    lead(`M${X[0]} ${TOP} V150 H292`);
    lead(`M${X[1]} ${TOP} V150 H348`);
    svg('rect', { x: 288, y: 139, width: 64, height: 22, rx: 10, class: 'rw-res' }, body);
    [[298, '#f2c400'], [308, '#8b3fd1'], [318, '#7a4a1f'], [336, '#c9a23a']]
      .forEach(([x, fill]) => svg('rect', { x, y: 139, width: 5, height: 22, fill }, body));
  } else if (kind === 'led') {
    lead(`M306 168 V182 L${X[0]} 192 V${TOP}`);
    lead(`M334 168 V182 L${X[1]} 192 V${TOP}`);
    svg('path', { d: 'M294 168 V116 A26 26 0 0 1 346 116 V168 Z', class: 'rw-led' }, body);
    svg('rect', { x: 288, y: 162, width: 58, height: 8, rx: 2, class: 'rw-led-rim' }, body); // collerette coupée à droite : le méplat
    svg('rect', { x: 303, y: 128, width: 4, height: 38, class: 'rw-led-metal' }, body); // anode : fine tige
    svg('path', { d: 'M324 166 V134 L342 128 V150 L333 150 V166 Z', class: 'rw-led-metal' }, body); // cathode : « enclume »
    svg('path', { d: 'M346 118 V170', class: 'rw-led-flat' }, body);
  } else {
    lead(`M${X[0]} ${TOP} V140 Q${X[0]} 112 304 112 H336 Q${X[1]} 112 ${X[1]} 140 V${TOP}`).setAttribute('class', 'rw-lead rw-strap');
  }
}

/** Profil d'une soudure sous la carte : petit volcan concave, ou boule si trop d'étain. */
function filletPath(x, v) {
  if (v < 0.04) return '';
  const vv = Math.min(v, 1.9);
  const b = 19 * clamp(0.35 + 0.65 * vv, 0, 1); // étalement sur la pastille
  const h = 5 + 13 * Math.min(vv, 1.2); // hauteur le long de la patte
  const y0 = BOT + 3;
  if (vv > 1.3) {
    const k = 1 + (vv - 1.3) * 1.4;
    return `M${x - b} ${y0} C${x - b - 9 * k} ${y0 + h * 1.3 * k}, ${x + b + 9 * k} ${y0 + h * 1.3 * k}, ${x + b} ${y0} Z`;
  }
  return `M${x - b} ${y0} Q${x - 3} ${y0 + 1} ${x - 2.5} ${y0 + h} L${x + 2.5} ${y0 + h} Q${x + 3} ${y0 + 1} ${x + b} ${y0} Z`;
}

const show = (node, on) => node.setAttribute('display', on ? 'inline' : 'none');

function render() {
  if (!s) return;
  const hasPart = s.phase !== 'removed';
  show(refs.comp, hasPart);
  s.joints.forEach((j, i) => {
    const r = refs.j[i];
    const q = quality(j);
    show(r.lead, hasPart);
    r.lead.setAttribute('y2', String(j.cut ? LEAD_CUT : LEAD_LONG));
    r.fillet.setAttribute('d', filletPath(j.x, j.v));
    r.fillet.setAttribute('class', `rw-fillet q-${q}`);
    show(r.crack, j.cracked && j.v > 0.5);
    show(r.flux, j.flux);
    show(r.residue, s.residue && !j.flux);
    show(r.braid, j.braid);
    r.silver.setAttribute('opacity', clamp(1 - j.v / Math.max(j.v0, 0.01), 0, 1).toFixed(2));
    refs.heat[i].setAttribute('opacity', clamp((j.T - 110) / 240, 0, 0.85).toFixed(2));
    show(r.iron, s.iron === i);
    r.glow.setAttribute('opacity', s.iron === i ? '0.8' : '0');
    show(r.wire, s.feeding === i);
    r.pad.classList.toggle('is-lifted', j.lifted);
  });

  if (s.iron >= 0) {
    const j = s.joints[s.iron];
    ui.temp.hidden = false;
    ui.temp.textContent = `Pastille ${s.cfg.pins[s.iron]} : ${Math.round(j.T)} °C`;
    ui.temp.dataset.zone = j.idle > 3 ? 'hot' : j.T < MELT ? 'cold' : 'ok';
  } else ui.temp.hidden = true;

  renderSteps();
}

function renderSteps() {
  const allClean = s.joints.every((j) => j.v < CLEAN);
  const dirty = s.residue || s.joints.some((j) => j.flux);
  const inNew = s.phase === 'new';
  const steps = [
    ['Flux sur les soudures à retirer', s.fluxDesolder || s.phase !== 'old', 'conseillé'],
    ['Tresse + fer : pastilles propres', s.phase !== 'old' || allClean],
    ['Ancien composant retiré (brucelles)', s.phase !== 'old'],
    [s.cfg.polar ? 'Neuf inséré, dans le bon sens' : 'Neuf inséré', inNew],
    ['2 pattes soudées : fer → étain → fer retiré', inNew && s.joints.every((j) => quality(j) === 'good')],
    ['Pattes coupées au ras', inNew && s.joints.every((j) => j.cut)],
    ['Flux nettoyé à l’alcool', inNew && s.fluxUsed && !dirty, s.fluxUsed ? '' : 'si flux'],
  ];
  let now = false;
  ui.steps.replaceChildren(...steps.map(([label, ok, note], k) => {
    const li = el('li', { text: label });
    if (note) li.appendChild(el('small', { text: ` (${note})` }));
    li.classList.toggle('is-done', !!ok);
    if (!ok && !now && k > 0) { li.classList.add('is-now'); now = true; }
    return li;
  }));
}

/* =========================================================
   Simulation : température, tresse, étain, surchauffe
   ========================================================= */
function tick(t) {
  if (!s) return;
  const dt = clamp((t - s.last) / 1000, 0, 0.05); // onglet masqué : tout se fige
  s.last = t;
  if (!s.failed) {
    s.joints.forEach((j, i) => {
      const heated = s.iron === i;
      j.T += ((heated ? IRON_T : 25) - j.T) * (1 - Math.exp(-(heated ? 1.6 : 1.1) * dt));
      if (!heated) return;
      let busy = j.T < IRON_T - 25; // le fer monte en température
      if (j.flux) {
        if (j.T > 150) s.residue = true; // le flux chauffé laisse des résidus
        j.fluxT += dt;
        if (j.T > 200) puffs(i, dt);
        if (j.fluxT > 3.2) {
          j.flux = false;
          say('Le flux s’est évaporé : remets-en si tu as encore à travailler cette soudure.');
        }
      }
      // La tresse « boit » l'étain fondu par capillarité (bien mieux avec du flux)
      if (j.braid && j.T > 230 && j.v > 0) {
        busy = true;
        if (!j.flux && !s.noFluxTip) {
          s.noFluxTip = true;
          say('Sans flux, la tresse boit mal l’étain… Un coup de flux aide beaucoup.');
        }
        j.v = Math.max(0, j.v - (j.flux ? 0.9 : 0.3) * dt);
        if (j.v < CLEAN && !j.cleanSaid) {
          j.cleanSaid = true;
          j.cracked = false;
          sfx('ok', { passive: true });
          say('Pastille propre ✔ Retire le fer : la tresse part avec lui.', 'good');
        }
      }
      if (s.feeding === i) {
        busy = true;
        j.fed = true;
        if (j.T < MELT) { j.cold = true; j.v += 0.45 * dt; } else j.v += 0.8 * dt;
        j.v = Math.min(j.v, 1.9);
      } else if (j.cold && j.flux && j.T > 290) {
        j.cold = false; // refusion avec du flux : la soudure froide se reprend
        say('L’étain refond et s’étale grâce au flux : la soudure froide est reprise.');
      }
      // Surchauffe : le fer reste posé sans rien faire
      j.idle = busy ? 0 : j.idle + dt;
      if (j.idle > 4 && !j.warned) {
        j.warned = true;
        sfx('buzz', { passive: true });
        say('La pastille surchauffe : retire le fer !', 'warn');
      }
      if (j.idle > 9) liftPad(i);
    });
  }
  render();
  raf = requestAnimationFrame(tick);
}

function puffs(i, dt) {
  s.smoke -= dt;
  if (s.smoke > 0 || reducedMotion()) return;
  s.smoke = 0.22;
  const p = svg('circle', { class: 'puff', cx: X[i] + (Math.random() - 0.5) * 18, cy: BOT + 14, r: 4 }, refs.fx);
  p.style.setProperty('--dx', `${((Math.random() - 0.5) * 40).toFixed(0)}px`);
  setTimeout(() => p.remove(), 1300);
}

function liftPad(i) {
  const j = s.joints[i];
  j.lifted = true;
  s.failed = true;
  liftIron(true);
  sfx('buzz');
  fail('Pastille arrachée ✖ Trop chauffée trop longtemps, la pastille de cuivre s’est décollée de la carte. En atelier, on la répare avec un fil (un strap)… ou on change la carte. Le secret : 2 à 3 secondes de chauffe, pas plus.');
}

/* =========================================================
   Actions
   ========================================================= */
function say(text, kind = '') {
  ui.msg.textContent = text;
  ui.msg.classList.toggle('is-warn', kind === 'warn');
  ui.msg.classList.toggle('is-good', kind === 'good');
}

function pickTool(id, { quiet = false } = {}) {
  if (s) s.tool = id;
  $$('.rw-tool', ui.tools).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === id)));
  ui.view.dataset.tool = id ?? '';
  if (id && !quiet) {
    sfx('click');
    say(TOOL_HINTS[id]);
  }
}

function press(target) {
  if (!s || s.failed || s.reporting) return;
  if (!s.tool) return say('Choisis d’abord un outil, en bas.');
  if (target === 'comp' || target === 'board') {
    if (s.tool === 'tweezers') return tweezers();
    if (s.tool === 'ipa') return clean();
    if (s.tool === 'iron' && target === 'comp') return say('Le fer se pose sur la soudure, sous la carte : chauffer le composant ne sert à rien… et peut l’abîmer.');
    return say('Cet outil s’utilise sur une soudure, sous la carte.');
  }
  const i = Number(target.slice(1));
  const j = s.joints[i];
  switch (s.tool) {
    case 'iron': return toggleIron(i);
    case 'flux':
      j.flux = true;
      j.fluxT = 0;
      s.fluxUsed = true;
      if (s.phase === 'old') s.fluxDesolder = true;
      sfx('click');
      return say(s.phase === 'old'
        ? 'Flux posé : il dissout l’oxydation et aidera la tresse à « boire » l’étain.'
        : 'Flux posé : l’étain va bien s’étaler et « mouiller » la pastille.');
    case 'braid':
      if (j.v < CLEAN) return say('Rien à retirer ici : la pastille est déjà propre.');
      if (j.braid) return say('La tresse est déjà en place : chauffe-la avec le fer.');
      j.braid = true;
      j.v0 = j.v;
      j.cleanSaid = false;
      sfx('click');
      return say(s.iron === i ? 'Tresse glissée sous le fer.' : 'Tresse posée sur la soudure : appuie dessus avec le fer pour la chauffer.');
    case 'solder': return startFeed(i);
    case 'tweezers': return tweezers();
    case 'cutter': return cut(i);
    case 'ipa': return clean();
    default: return undefined;
  }
}

function release() {
  if (!s || s.feeding < 0) return;
  const i = s.feeding;
  s.feeding = -1;
  if (s.iron === i && !s.failed) say('Étain retiré. Laisse la soudure se former une seconde, puis retire le fer.');
}

function toggleIron(i) {
  if (s.iron === i) return liftIron();
  if (s.iron >= 0) liftIron(true);
  s.iron = i;
  const j = s.joints[i];
  j.idle = 0;
  j.warned = false;
  loopStart('sizzle');
  sfx('click');
  if (j.braid) say('Le fer chauffe la tresse… l’étain fondu va remonter dedans par capillarité.');
  else if (s.phase === 'new' && j.v < CLEAN) say('Le fer chauffe la pastille et la patte. Attends qu’elles soient chaudes (250 °C et plus), puis apporte l’étain : outil Étain, maintenir appuyé.');
  else if (j.v >= CLEAN) say(`Le fer fait fondre la soudure.${j.cold ? ' Avec un peu de flux, une soudure froide se reprend.' : ''}`);
  else say('Le fer chauffe la pastille.');
  return undefined;
}

function liftIron(silent = false) {
  const i = s.iron;
  if (i < 0) return;
  s.iron = -1;
  s.feeding = -1;
  loopStop('sizzle');
  const j = s.joints[i];
  if (j.braid) {
    j.braid = false;
    if (!silent) {
      say(j.v < CLEAN
        ? 'Fer et tresse retirés ensemble ✔ (Si on laisse la tresse refroidir sur la pastille, elle reste collée !)'
        : 'Tresse retirée : il reste de l’étain. Recommence avec un bout de tresse propre.');
    }
    return;
  }
  if (j.fed) {
    j.fed = false;
    if (!silent) {
      const q = quality(j);
      say(QUALITY_MSG[q], q === 'good' ? 'good' : q === 'blob' ? '' : 'warn');
      sfx(q === 'good' ? 'ok' : 'buzz', { passive: true });
    }
    return;
  }
  if (!silent) say('Fer retiré.');
}

function startFeed(i) {
  if (s.phase === 'removed') return say('Insère d’abord le composant neuf.');
  if (s.iron !== i) return say('Pose d’abord le fer sur la pastille et la patte : on chauffe la soudure, puis on apporte l’étain dessus (pas sur la panne du fer).');
  s.feeding = i;
  if (s.joints[i].T < MELT) say('L’étain fond… mais la pastille est encore froide !', 'warn');
  else say('L’étain fond et coule autour de la patte… Relâche quand la soudure forme un joli volcan.');
  return undefined;
}

function tweezers() {
  if (s.phase === 'old') {
    const left = s.joints.findIndex((j) => j.v >= CLEAN);
    if (left >= 0) return say(`Ça résiste : il reste de l’étain sur la ${s.cfg.pins[left]}. Dessoude-la d’abord (flux, tresse, fer).`);
    if (s.iron >= 0) liftIron(true);
    s.phase = 'removed';
    moveComp(false);
    sfx('snap');
    showNewPart();
    return say('Ancien composant retiré ✔ Prépare le neuf, à droite : vérifie son sens, puis « Insérer ».', 'good');
  }
  if (s.phase === 'removed') return say('La pièce neuve attend à droite : vérifie son sens, puis « Insérer ».');
  if (s.joints.every((j) => j.v < CLEAN)) {
    s.phase = 'removed';
    moveComp(false);
    showNewPart();
    return say('Composant ressorti : tu peux le tourner, puis le réinsérer.');
  }
  return say('Il est déjà soudé : pour le ressortir, il faudrait le dessouder.');
}

function showNewPart() {
  ui.part.hidden = false;
  ui.rotate.hidden = !s.cfg.polar;
  ui.partHelp.textContent = s.cfg.help;
  drawPart(ui.partSvg, s.cfg.kind, { flip: s.flipNew });
}

function insertNew() {
  if (!s || s.phase !== 'removed') return;
  s.phase = 'new';
  s.joints.forEach((j) => Object.assign(j, { v: 0, v0: 0, cut: false, cold: false, cracked: false, braid: false, fed: false }));
  drawPart(refs.comp, s.cfg.kind, { flip: s.flipNew });
  moveComp(true);
  ui.part.hidden = true;
  sfx('tink');
  say(`Composant inséré.${s.cfg.polar ? ' Le sens est bon ? (sinon, ressors-le aux brucelles)' : ''} Soude les deux pattes : le fer d’abord, puis l’étain, on retire l’étain, puis le fer.`);
  render();
  $('[data-rw-hit="j0"]', ui.view)?.focus();
}

function moveComp(inward) {
  if (reducedMotion()) return;
  refs.comp.animate(
    inward ? [{ transform: 'translateY(-70px)', opacity: 0 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70px)', opacity: 0 }],
    { duration: 380, easing: inward ? 'cubic-bezier(0.2, 0.8, 0.3, 1)' : 'ease-in' },
  );
}

function cut(i) {
  const j = s.joints[i];
  if (s.phase !== 'new') return say(s.phase === 'old' ? 'Les pattes de l’ancien composant sont déjà coupées.' : 'Pas de patte à couper ici.');
  if (j.cut) return say('Cette patte est déjà coupée.');
  if (j.v < 0.3) return say('Soude d’abord : la patte tient le composant pendant qu’on soude. On coupe après.');
  if (s.iron === i) return say('Retire d’abord le fer.');
  j.cut = true;
  sfx('snap');
  if (!reducedMotion()) {
    const bit = svg('line', { x1: j.x, y1: LEAD_CUT + 2, x2: j.x, y2: LEAD_LONG, class: 'rw-lead' }, refs.fx);
    bit.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${i ? 40 : -40}px, 50px) rotate(${i ? 70 : -70}deg)`, opacity: 0 }], { duration: 500, easing: 'ease-in' })
      .finished.then(() => bit.remove(), () => bit.remove());
  }
  return say('Patte coupée au ras de la soudure ✔');
}

function clean() {
  if (s.joints.some((j) => j.T > 90)) return say('Attends que ça refroidisse : l’alcool isopropylique est inflammable !', 'warn');
  const dirty = s.residue || s.joints.some((j) => j.flux);
  if (!dirty) return say(s.fluxUsed ? 'C’est déjà propre ✔' : 'Rien à nettoyer : tu n’as pas utilisé de flux.');
  s.residue = false;
  s.joints.forEach((j) => { j.flux = false; });
  sfx('hiss', { passive: true });
  return say('Résidus de flux nettoyés à l’alcool isopropylique ✔ Collants, ils attirent poussière et humidité.', 'good');
}

/* =========================================================
   Contrôle qualité
   ========================================================= */
function openReport() {
  if (!s || s.reporting) return;
  if (s.phase !== 'new') return say('Il faut d’abord poser et souder le composant neuf.');
  if (s.iron >= 0) liftIron(true);
  release();
  const lines = [];
  if (s.cfg.polar) lines.push(s.flipNew ? ['bad', s.cfg.wrong] : ['ok', 'Monté dans le bon sens.']);
  s.joints.forEach((j, i) => {
    const q = quality(j);
    lines.push([q === 'good' ? 'ok' : q === 'blob' ? 'warn' : 'bad', `Soudure ${s.cfg.pins[i]} : ${QUALITY_LABEL[q]}.`]);
  });
  lines.push(s.joints.every((j) => j.cut) ? ['ok', 'Pattes coupées au ras.'] : ['warn', 'Pattes pas coupées : elles pourraient toucher une piste voisine.']);
  const dirty = s.residue || s.joints.some((j) => j.flux);
  if (s.fluxUsed) lines.push(dirty ? ['warn', 'Résidus de flux à nettoyer : collants, ils attirent poussière et humidité.'] : ['ok', 'Flux nettoyé à l’alcool.']);
  else lines.push(['info', 'Sans flux : ça marche, mais il rend le travail plus facile et plus propre.']);
  report(lines, { perfect: lines.every(([k]) => k === 'ok') });
}

function report(lines, { perfect = false, failed = false } = {}) {
  s.reporting = true;
  const ICON = { ok: '✔', bad: '✖', warn: '⚠', info: 'ℹ' };
  ui.checks.replaceChildren(...lines.map(([kind, text]) => el('li', { cls: `is-${kind}` }, [
    el('span', { text: ICON[kind], attrs: { 'aria-hidden': 'true' } }),
    el('span', { text }),
  ])));
  ui.report.hidden = false;
  ui.tools.hidden = true;
  ui.foot.hidden = true; // (en cas d’échec, fail() réaffiche « Remplacement rapide »)
  ui.bench.hidden = failed;
  ui.back.hidden = failed || perfect;
  ui.restart.hidden = !failed;
  if (perfect) {
    sfx('chime');
    say('Travail impeccable : prêt pour la remise sous tension.', 'good');
  } else if (!failed) say('Tu peux remettre la carte sur le banc tel quel… ou reprendre ton travail.');
  (failed ? ui.restart : ui.bench).focus();
}

function closeReport() {
  if (s) s.reporting = false;
  ui.report.hidden = true;
  ui.tools.hidden = false;
  ui.foot.hidden = false;
  ui.part.hidden = !s || s.phase !== 'removed';
}

function fail(text) {
  report([['bad', text]], { failed: true });
  ui.foot.hidden = false; // « Remplacement rapide » reste possible
  say('Ça arrive à tout le monde au début. On recommence ?', 'warn');
}
