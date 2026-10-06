// « Démonter un PC portable » : les gestes d'un atelier de reconditionnement, dans l'ordre.
// Disposition intérieure inspirée d'un vrai Dell Latitude 14 (carte mère bleue, ventilateur à
// gauche, caloducs et plaque noirs, deux barrettes couchées, Wi-Fi à droite, pile CMOS, batterie à
// l'avant). Débrancher le chargeur, bracelet antistatique, retourner le PC, vis imperdables du capot
// (dont une sous le patin), clips au spudger, batterie EN PREMIER, puis chaque pièce : vis rangées
// au bac magnétique (taille marquée près des trous), câbles tirés par leur connecteur, nappes à
// loquet (on soulève le loquet, puis on tire la nappe à plat).

import { $, $$, svg as S, el, reducedMotion } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

/* =========================================================
   Données
   ========================================================= */
// Vis imperdables du capot ; la dernière est cachée sous le patin arrière
const COVER_SCREWS = [[44, 62], [596, 62], [44, 222], [596, 222], [150, 372], [490, 372], [320, 330], [320, 31]];
// Points de déclipsage (jointure du capot) : on commence près des charnières, puis les côtés et l'avant
const CLIPS = [[22, 132], [618, 132], [190, 402], [450, 402]];

// `steps` : gestes à faire sur la pièce elle-même avant de pouvoir la sortir
const PARTS = {
  battery: { name: 'Batterie', the: 'la batterie', of: 'de la batterie', after: [] },
  ram1: { name: 'Barrette de RAM 1', the: 'la barrette 1', of: 'de la barrette 1', after: [], steps: ['Clips écartés vers l’extérieur ✔ La barrette se relève toute seule à 30° : retire-la en la tirant dans l’axe, tenue par les bords.'] },
  ram2: { name: 'Barrette de RAM 2', the: 'la barrette 2', of: 'de la barrette 2', after: [], steps: ['Clips écartés ✔ La barrette se relève à 30° : tire-la dans l’axe.'] },
  ssd: { name: 'SSD NVMe M.2', the: 'le SSD', of: 'du SSD', after: [], steps: ['Plaque thermique retirée ✔ Dessous, un pad thermique (le carré rose) transmet la chaleur du contrôleur à la plaque : on le garde intact pour le remontage. Le SSD se relève : tire-le dans l’axe.'] },
  wifi: { name: 'Carte Wi-Fi', the: 'la carte Wi-Fi', of: 'de la carte Wi-Fi', after: [] },
  cooling: { name: 'Ventilateur et dissipateur', the: 'le ventilateur et le dissipateur', of: 'du dissipateur', after: [] },
  cmos: { name: 'Pile CMOS (BIOS)', the: 'la pile CMOS', of: 'de la pile CMOS', after: [] },
  speakers: { name: 'Haut-parleurs', the: 'les haut-parleurs', of: 'des haut-parleurs', after: [] },
  power: { name: 'Bouton ON/OFF', the: 'la carte du bouton ON/OFF', of: 'du bouton ON/OFF', after: [] },
  mb: { name: 'Carte mère', the: 'la carte mère', of: 'de la carte mère', after: ['battery', 'cooling', 'ram1', 'ram2', 'ssd', 'wifi', 'cmos'] },
  touchpad: { name: 'Pavé tactile', the: 'le pavé tactile', of: 'du pavé tactile', after: ['battery', 'mb'] },
  keyboard: { name: 'Clavier', the: 'le clavier', of: 'du clavier', after: ['mb'] },
};

// Taille des vis (diamètre × longueur en mm), marquée près des trous comme sur les Dell et les HP
const SIZES = { battery: 'M2×3', ssd: 'M2×2', wifi: 'M2×2.5', cooling: 'M2×5', power: 'M2×2', mb: 'M2×4', touchpad: 'M2×2', keyboard: 'M1.6×2.5' };
// Bac magnétique : un compartiment par pièce, rempli automatiquement à chaque vis retirée
const TRAY = Object.keys(SIZES);
const TRAY_LABELS = { battery: 'Batterie', ssd: 'SSD', wifi: 'Wi-Fi', cooling: 'Ventilo', power: 'Bouton', mb: 'Carte mère', touchpad: 'Pavé', keyboard: 'Clavier' };

// Vis, connecteurs et nappes. `part` : pièce qui les porte (ils partent avec elle) ;
// `blocks` : pièces qu'on ne peut pas déposer tant qu'ils sont branchés ; `captive` : vis imperdable.
const ITEMS = [
  { id: 'bat-plug', kind: 'plug', wide: true, part: 'battery', blocks: ['battery'], x: 420, y: 262, pull: [0, 12], label: 'le connecteur de la batterie' },
  { id: 'bat-s1', kind: 'screw', part: 'battery', x: 112, y: 290 },
  { id: 'bat-s2', kind: 'screw', part: 'battery', x: 458, y: 290 },
  { id: 'bat-s3', kind: 'screw', part: 'battery', x: 112, y: 384 },
  { id: 'bat-s4', kind: 'screw', part: 'battery', x: 458, y: 384 },
  { id: 'ssd-s', kind: 'screw', part: 'ssd', x: 512, y: 334 },
  { id: 'wifi-s', kind: 'screw', part: 'wifi', x: 530, y: 171 },
  { id: 'ant-main', kind: 'ant', part: 'wifi', needs: 'wifi-s', blocks: ['wifi', 'mb'], x: 522, y: 182, label: 'l’antenne MAIN (câble noir)' },
  { id: 'ant-aux', kind: 'ant', part: 'wifi', needs: 'wifi-s', blocks: ['wifi', 'mb'], x: 538, y: 182, label: 'l’antenne AUX (câble blanc)' },
  { id: 'hs-1', kind: 'screw', captive: true, part: 'cooling', x: 242, y: 72, n: 1 },
  { id: 'hs-2', kind: 'screw', captive: true, part: 'cooling', x: 350, y: 146, n: 2 },
  { id: 'hs-3', kind: 'screw', captive: true, part: 'cooling', x: 350, y: 72, n: 3 },
  { id: 'hs-4', kind: 'screw', captive: true, part: 'cooling', x: 242, y: 146, n: 4 },
  { id: 'fan-s1', kind: 'screw', part: 'cooling', x: 46, y: 64 },
  { id: 'fan-s2', kind: 'screw', part: 'cooling', x: 166, y: 180 },
  { id: 'fan-plug', kind: 'plug', part: 'mb', blocks: ['cooling'], x: 190, y: 200, pull: [8, 0], label: 'le câble du ventilateur' },
  { id: 'cmos-plug', kind: 'plug', part: 'mb', blocks: ['cmos', 'mb'], x: 124, y: 236, pull: [8, 0], label: 'le câble de la pile CMOS' },
  { id: 'spk-plug', kind: 'plug', part: 'mb', blocks: ['speakers', 'mb'], x: 474, y: 254, pull: [8, 4], label: 'le câble des haut-parleurs' },
  { id: 'pw-zif', kind: 'zif', part: 'power', blocks: ['power', 'mb'], x: 544, y: 72, w: 10, h: 26, dir: [-1, 0], label: 'la nappe du bouton ON/OFF' },
  { id: 'pw-s', kind: 'screw', part: 'power', x: 594, y: 62 },
  { id: 'edp-s1', kind: 'screw', part: 'mb', size: 'M2×2', x: 376, y: 58 },
  { id: 'edp-s2', kind: 'screw', part: 'mb', size: 'M2×2', x: 420, y: 58 },
  { id: 'edp', kind: 'edp', part: 'mb', needs: ['edp-s1', 'edp-s2'], blocks: ['mb'], x: 384, y: 50, label: 'la nappe de l’écran' },
  { id: 'kb-zif', kind: 'zif', part: 'mb', blocks: ['mb', 'keyboard'], x: 128, y: 252, w: 44, h: 10, dir: [0, 1], label: 'la nappe du clavier' },
  { id: 'tp-zif', kind: 'zif', part: 'mb', blocks: ['mb', 'touchpad'], x: 188, y: 252, w: 36, h: 10, dir: [0, 1], label: 'la nappe du pavé tactile' },
  { id: 'mb-s1', kind: 'screw', part: 'mb', x: 196, y: 58 },
  { id: 'mb-s2', kind: 'screw', part: 'mb', x: 472, y: 58 },
  { id: 'mb-s3', kind: 'screw', part: 'mb', x: 108, y: 202 },
  { id: 'mb-s4', kind: 'screw', part: 'mb', x: 372, y: 252 },
  { id: 'mb-s5', kind: 'screw', part: 'mb', x: 488, y: 152 },
  { id: 'tp-s1', kind: 'screw', part: 'touchpad', x: 200, y: 304 },
  { id: 'tp-s2', kind: 'screw', part: 'touchpad', x: 380, y: 304 },
  { id: 'tp-s3', kind: 'screw', part: 'touchpad', x: 290, y: 384 },
  { id: 'kb-s1', kind: 'screw', part: 'keyboard', x: 62, y: 78 },
  { id: 'kb-s2', kind: 'screw', part: 'keyboard', x: 320, y: 78 },
  { id: 'kb-s3', kind: 'screw', part: 'keyboard', x: 578, y: 78 },
  { id: 'kb-s4', kind: 'screw', part: 'keyboard', x: 62, y: 246 },
  { id: 'kb-s5', kind: 'screw', part: 'keyboard', x: 320, y: 220 },
  { id: 'kb-s6', kind: 'screw', part: 'keyboard', x: 578, y: 246 },
];
const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

// Ce qu'on retient en déposant chaque pièce
const TIPS = {
  battery: 'Batterie déposée ✔ Réflexe d’atelier : batterie débranchée, on maintient le bouton d’alimentation 15 s pour vider l’énergie résiduelle. Une batterie lithium gonflée ou percée ne se manipule pas : direction le bac de sécurité.',
  ram1: 'Barrette 1 déposée ✔ On la tient par les bords, jamais par les contacts dorés. Les demi-lunes sur ses côtés sont l’endroit où les clips la retiennent.',
  ram2: 'Barrette 2 déposée ✔ Les deux barrettes voyagent dans un sachet antistatique. Avec deux barrettes identiques, le processeur travaille en double canal : plus rapide.',
  ssd: 'SSD déposé ✔ Format M.2 2230 : 22 mm de large, 30 mm de long, encoche « M » pour le NVMe. Sur ce modèle, son slot est à droite de la batterie, sous un capot métallique. Il contient les données du client : on le traite avec soin.',
  wifi: 'Carte Wi-Fi déposée ✔ Au remontage : câble noir sur MAIN (triangle plein), câble blanc sur AUX.',
  cooling: 'Refroidissement déposé ✔ Les 4 vis numérotées sont imperdables : on les desserre dans l’ordre inverse (4 → 1) et on les resserre dans l’ordre (1 → 4) pour presser la puce bien à plat. Au remontage : nettoyage à l’alcool isopropylique et pâte thermique neuve.',
  cmos: 'Pile CMOS déposée ✔ Elle garde l’heure et les réglages du BIOS quand tout est éteint. La débrancher remet le BIOS à zéro : une vieille astuce de dépannage.',
  speakers: 'Haut-parleurs déposés ✔ Ils sont simplement posés sur des silentblocs : on note le passage du câble pour le remontage.',
  power: 'Bouton ON/OFF déposé ✔ Sur beaucoup de modèles, il intègre aussi le lecteur d’empreintes.',
  mb: 'Carte mère déposée ✔ Sur ce modèle, les ports (USB-C de charge, USB, Ethernet, prise casque) sont soudés directement dessus : on la soulève par les bords, en dégageant les ports de leurs ouvertures en dernier. Une vis oubliée et c’est la fissure.',
  touchpad: 'Pavé tactile déposé ✔ Son support passe sous la carte mère : c’est pour ça qu’il sort après elle.',
  keyboard: 'Clavier déposé ✔ Sur certains modèles, il est riveté au repose-poignets : on change alors tout le repose-poignets.',
};

// [id, nom, à quoi il sert]
const TOOLS = [
  ['hand', 'Main', 'connecteurs, nappes, pièces'],
  ['driver', 'Tournevis PH0', 'vis cruciformes'],
  ['spudger', 'Spudger', 'clips, loquets, antennes'],
];
const TOOL_HINTS = {
  hand: 'Main : débrancher un câble, tirer une nappe, soulever une pièce.',
  driver: 'Tournevis cruciforme PH0 : clique sur une vis.',
  spudger: 'Spudger : déclipser le capot, soulever un loquet ou une antenne, décoller un patin.',
};

/* =========================================================
   Module
   ========================================================= */
export function initTeardown() {
  const root = $('.defi-laptop');
  if (!root) return;
  const flip = $('.lt-flip', root);
  const top = $('.lt-top', root);
  const bottom = $('.lt-bottom', root);
  const msgEl = $('.lt-msg', root);
  const toolsBox = $('.lt-tools', root);
  const wristBtn = $('[data-lt-wrist]', root);
  const flipBtn = $('[data-lt-flip]', root);
  const trayEl = $('.lt-tray', root);
  const partsEl = $('.lt-parts', root);
  const endEl = $('.lt-end', root);
  const stat = Object.fromEntries($$('[data-lt]', root).map((n) => [n.dataset.lt, n]));
  const N_PARTS = Object.keys(PARTS).length + 1; // + le capot

  let st;
  let refs;
  let hovered = null; // élément cliquable survolé (ou focalisé au clavier)
  let lit = null; // ce qui est entouré en vert ou en rouge
  let timer = 0;
  let visible = !root.hidden;

  /* ---------- Outils : chacun dessiné tel qu'on le trouve sur l'établi ---------- */
  const toolName = (label, use) => el('span', { cls: 'lt-tool-name' }, [el('b', { text: label }), el('small', { text: use })]);
  toolsBox.replaceChildren(...TOOLS.map(([id, label, use]) => {
    const b = el('button', { cls: 'lt-tool', attrs: { type: 'button', 'data-tool': id, 'aria-pressed': 'false' } }, [toolArt(id), toolName(label, use)]);
    b.addEventListener('click', () => pickTool(id));
    return b;
  }));
  wristBtn.replaceChildren(toolArt('wrist'), toolName('Bracelet antistatique', 'avant d’ouvrir le capot'));
  wristBtn.addEventListener('click', toggleWrist);
  flipBtn.addEventListener('click', doFlip);
  $('[data-lt-hint]', root).addEventListener('click', hint);
  $$('[data-lt-reset]', root).forEach((b) => b.addEventListener('click', () => { sfx('click'); reset(); }));
  if (stat.total) stat.total.textContent = String(N_PARTS);

  // Clics et clavier sur les deux faces (délégation)
  for (const face of [top, bottom]) {
    face.addEventListener('click', (e) => {
      const t = e.target.closest('[data-lt]');
      if (t) act(t.dataset.lt);
    });
    face.addEventListener('keydown', (e) => {
      const t = e.target.closest('[data-lt]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(t.dataset.lt); }
    });
    // Survol (ou focus clavier) : contour vert si on peut s'en occuper maintenant, rouge sinon
    face.addEventListener('pointerover', (e) => light(e.target.closest('[data-lt]')));
    face.addEventListener('pointerleave', () => light(null));
    face.addEventListener('focusin', (e) => light(e.target.closest('[data-lt]')));
    face.addEventListener('focusout', () => light(null));
  }

  // Le chrono s'arrête quand on quitte l'onglet du défi ou la page
  root.addEventListener('panel:show', () => { visible = true; });
  root.addEventListener('panel:hide', () => { visible = false; });

  reset();

  /* =========================================================
     État, remise à zéro
     ========================================================= */
  function reset() {
    clearInterval(timer);
    light(null);
    st = {
      tool: 'hand',
      charger: true,
      esd: false,
      flipped: false,
      cover: { screws: COVER_SCREWS.map(() => false), foot: false, clips: CLIPS.map(() => false), off: false },
      items: Object.fromEntries(ITEMS.map((it) => [it.id, it.kind === 'zif' ? 'locked' : 'in'])),
      steps: Object.fromEntries(Object.keys(PARTS).map((k) => [k, 0])),
      removed: new Set(),
      tray: Object.fromEntries(TRAY.map((k) => [k, 0])),
      errors: 0,
      screws: 0,
      t0: 0,
      elapsed: 0,
      done: false,
    };
    flip.classList.remove('is-flipped');
    flipBtn.disabled = false;
    flipBtn.textContent = '↻ Retourner le PC';
    wristBtn.setAttribute('aria-pressed', 'false');
    root.classList.remove('has-esd');
    stat.time.textContent = '0:00';
    top.inert = false;
    bottom.inert = true;
    endEl.hidden = true;
    refs = { parts: {}, items: {}, cover: {} };
    drawTop();
    drawBottom();
    pickTool('hand', { quiet: true });
    renderSide();
    say('Un PC portable arrive à l’atelier pour être démonté. Avant tout : on coupe l’alimentation et on se protège de l’électricité statique.');
  }

  /* =========================================================
     Dessin : PC fermé, vu de dessus
     ========================================================= */
  function drawTop() {
    top.replaceChildren();
    const defs = S('defs', {}, top);
    grad(defs, 'lt-lid', [['0', '#4a5257'], ['.5', '#363c40'], ['1', '#25292c']]);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 22, fill: 'url(#lt-lid)', stroke: '#101314', 'stroke-width': 2 }, top);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 22, fill: 'url(#hd-sheen)' }, top);
    S('rect', { x: 22, y: 22, width: 596, height: 376, rx: 18, fill: 'none', stroke: '#ffffff', 'stroke-opacity': '.06' }, top);
    S('rect', { x: 80, y: 16, width: 480, height: 10, rx: 4, fill: '#1a1d1f' }, top); // charnière
    S('circle', { cx: 320, cy: 205, r: 38, fill: 'none', stroke: '#9aa1a5', 'stroke-width': 3 }, top);
    S('text', { x: 320, y: 213, class: 'lt-logo', 'text-anchor': 'middle' }, top).textContent = 'AT';
    S('rect', { x: 296, y: 398, width: 48, height: 6, rx: 3, fill: '#15181a' }, top); // encoche d'ouverture
    refs.chargeLed = S('circle', { cx: 572, cy: 392, r: 3.2, class: 'lt-led is-on' }, top);
    S('circle', { cx: 586, cy: 392, r: 3.2, class: 'lt-led' }, top);
    refs.plugTop = charger(top, 624, 74, 1); // flanc droit, vers l'arrière (près de la charnière)
  }

  /** Fiche du chargeur sur le flanc (side = -1 : à gauche, 1 : à droite). */
  function charger(face, x, y, side) {
    const g = S('g', { class: `lt-charger ${side < 0 ? 'lt-charger-l' : 'lt-charger-r'}` }, face);
    S('path', { d: `M${x + side * 22} ${y} C${x + side * 60} ${y}, ${x + side * 60} ${y + 70}, ${x + side * 120} ${y + 80}`, class: 'lt-cable' }, g);
    S('rect', { x: side < 0 ? x - 24 : x + 4, y: y - 9, width: 20, height: 18, rx: 4, fill: 'url(#hd-plastic)' }, g);
    S('rect', { x: side < 0 ? x - 6 : x, y: y - 4, width: 6, height: 8, fill: 'url(#hd-metal-x)' }, g);
    S('rect', {
      x: side < 0 ? x - 30 : x - 2, y: y - 18, width: 34, height: 36, rx: 8, class: 'lt-hit', tabindex: 0, role: 'button',
      'data-lt': 'charger', 'aria-label': 'Fiche du chargeur, branchée sur le flanc du PC',
    }, g);
    return g;
  }

  /* =========================================================
     Dessin : PC retourné, vu de dessous (intérieur + capot)
     ========================================================= */
  function drawBottom() {
    const v = bottom;
    v.replaceChildren();
    const defs = S('defs', {}, v);
    grad(defs, 'lt-shell', [['0', '#41484c'], ['1', '#23272a']]);
    grad(defs, 'lt-cover', [['0', '#3a4044'], ['.55', '#2b3033'], ['1', '#1f2326']]);
    grad(defs, 'lt-plate', [['0', '#7a8287'], ['.5', '#5c6469'], ['1', '#454c50']]);
    grad(defs, 'lt-cell', [['0', '#2a2e31'], ['1', '#121416']]);
    grad(defs, 'lt-mb', [['0', '#2a62a8'], ['.6', '#1f4f8c'], ['1', '#173d6d']]);
    grad(defs, 'lt-black', [['0', '#3a3f43'], ['.5', '#202427'], ['1', '#121416']]);
    grad(defs, 'lt-ram', [['0', '#3f9a5c'], ['1', '#2a7343']]);
    const perf = S('pattern', { id: 'lt-perf', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
    S('circle', { cx: 4.5, cy: 4.5, r: 1.6, fill: '#2a2f33' }, perf);
    const mesh = S('pattern', { id: 'lt-mesh', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
    S('circle', { cx: 2.5, cy: 2.5, r: 1, fill: '#000000', opacity: '.55' }, mesh);

    // Coque intérieure (le repose-poignets vu de dessous) et charnières
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#lt-shell)', stroke: '#0f1112', 'stroke-width': 2 }, v);
    S('path', { d: 'M40 280 H600 M40 140 H600 M200 50 V390 M440 50 V390', stroke: '#000000', 'stroke-opacity': '.18', 'stroke-width': 3 }, v);
    S('rect', { x: 34, y: 16, width: 80, height: 28, rx: 6, fill: 'url(#hd-metal-x)' }, v);
    S('rect', { x: 526, y: 16, width: 80, height: 28, rx: 6, fill: 'url(#hd-metal-x)' }, v);

    // ---- Clavier (dos de la plaque, visible quand la carte mère est déposée)
    const kb = part('keyboard', 'Plaque arrière du clavier', { x: 40, y: 52, width: 560, height: 210 });
    S('rect', { x: 40, y: 52, width: 560, height: 210, rx: 6, fill: 'url(#lt-plate)' }, kb.art);
    S('rect', { x: 48, y: 60, width: 544, height: 194, rx: 4, fill: 'url(#lt-perf)' }, kb.art);
    S('rect', { x: 140, y: 252, width: 20, height: 34, fill: '#d8973e', opacity: '.9' }, kb.art); // queue de nappe

    // ---- Pavé tactile (sous la batterie ; son support passe sous la carte mère)
    const tp = part('touchpad', 'Pavé tactile', { x: 186, y: 290, width: 208, height: 104 });
    S('rect', { x: 190, y: 294, width: 200, height: 96, rx: 6, fill: '#1c2023' }, tp.art);
    S('rect', { x: 194, y: 298, width: 192, height: 88, rx: 4, fill: 'none', stroke: 'url(#hd-metal-x)', 'stroke-width': 4 }, tp.art);
    S('rect', { x: 196, y: 262, width: 22, height: 34, fill: '#d8973e', opacity: '.9' }, tp.art);

    // ---- Haut-parleurs : boîtiers noirs allongés aux coins avant (le droit sous le SSD), grille en fente,
    //      posés sur des silentblocs bleus
    const spk = part('speakers', 'Haut-parleurs', [{ x: 22, y: 344, width: 82, height: 54 }, { x: 482, y: 344, width: 136, height: 54 }]);
    for (const [x, w] of [[26, 74], [486, 128]]) {
      S('rect', { x, y: 350, width: w, height: 42, rx: 8, fill: '#141618', stroke: '#2c3134' }, spk.art);
      S('rect', { x: x + 10, y: 366, width: w - 20, height: 6, rx: 3, fill: '#050607' }, spk.art); // fente de la grille
      S('circle', { cx: x + 7, cy: 357, r: 3.2, fill: '#2f6fd1' }, spk.art);
      S('circle', { cx: x + w - 7, cy: 385, r: 3.2, fill: '#2f6fd1' }, spk.art);
    }
    S('path', { d: 'M100 380 C220 398, 400 398, 486 382 M560 350 C556 300, 500 270, 480 260', class: 'lt-wire-pair' }, spk.art);

    // ---- Carte mère (bleue, comme chez Dell et HP) et ce qui est soudé dessus
    const mb = part('mb', 'Carte mère', { x: 30, y: 46, width: 584, height: 222 });
    S('path', { d: 'M38 46 H606 Q614 46 614 54 V260 Q614 268 606 268 H38 Q30 268 30 260 V54 Q30 46 38 46 Z', fill: 'url(#lt-mb)', stroke: '#0f2b4d' }, mb.art);
    S('rect', { x: 30, y: 46, width: 584, height: 222, fill: 'url(#hd-weave)', 'pointer-events': 'none' }, mb.art);
    smd(mb.art, [[208, 112], [216, 122], [208, 132], [376, 96], [384, 108], [376, 120], [430, 92], [440, 100], [270, 200], [290, 204], [310, 200], [440, 250], [128, 222]]);
    for (const [x, t] of [[200, 'DIMM A'], [352, 'DIMM B'], [496, 'WLAN'], [404, 'BATTERY'], [500, 'SSD'], [70, 'RTC']]) {
      S('text', { x, y: t === 'BATTERY' ? 250 : t === 'SSD' ? 264 : t === 'RTC' ? 206 : 166, class: 'lt-silk' }, mb.art).textContent = t;
    }
    S('rect', { x: 402, y: 256, width: 36, height: 10, rx: 1.5, fill: '#2a2e31' }, mb.art); // embase de la batterie
    S('rect', { x: 504, y: 258, width: 26, height: 8, rx: 1, fill: '#111314' }, mb.art); // support M.2 du SSD
    // ports soudés sur les bords de la carte mère
    port(mb.art, 18, 64, 14, 20, 'usbc');
    S('text', { x: 36, y: 79, class: 'lt-silk' }, mb.art).textContent = '⚡';
    port(mb.art, 18, 92, 14, 20, 'usbc');
    port(mb.art, 18, 124, 16, 30, 'usba');
    S('circle', { cx: 606, cy: 128, r: 7, fill: '#111314', stroke: 'url(#hd-metal-x)', 'stroke-width': 2 }, mb.art); // prise casque
    port(mb.art, 588, 144, 26, 34, 'usba-gold');
    port(mb.art, 582, 186, 32, 58, 'rj45');
    S('text', { x: 554, y: 218, class: 'lt-silk' }, mb.art).textContent = 'LAN';
    // slots SO-DIMM (noirs), avec leurs clips métalliques aux deux extrémités
    for (const x of [196, 348]) S('rect', { x, y: 170, width: 142, height: 62, rx: 2, fill: '#111314' }, mb.art);
    S('rect', { x: 490, y: 168, width: 8, height: 60, fill: '#111314' }, mb.art); // support M.2 du Wi-Fi

    // ---- Barrettes de RAM (SO-DIMM) couchées : deux clips latéraux les retiennent
    [['ram1', 196], ['ram2', 348]].forEach(([id, x], k) => {
      const ram = part(id, `Barrette de RAM ${k + 1}`, { x: x - 6, y: 166, width: 154, height: 70 });
      ram.module = S('g', { class: 'lt-ram-mod' }, ram.art);
      S('path', { d: `M${x + 4} 174 H${x + 138} V184 a5 5 0 0 0 0 10 V228 H${x + 4} V194 a5 5 0 0 0 0 -10 Z`, fill: 'url(#lt-ram)' }, ram.module);
      for (let c = 0; c < 4; c++) S('rect', { x: x + 12 + c * 32, y: 178, width: 24, height: 16, rx: 1, fill: 'url(#g-chip)' }, ram.module);
      S('rect', { x: x + 14, y: 198, width: 112, height: 20, rx: 1.5, fill: '#f1f2ee' }, ram.module);
      S('text', { x: x + 70, y: 211, class: 'lt-label', 'text-anchor': 'middle' }, ram.module).textContent = 'DDR5 SODIMM · 16 Go';
      S('path', { d: `M${x + 8} 225 H${x + 80} M${x + 86} 225 H${x + 134}`, stroke: '#d9a441', 'stroke-width': 4 }, ram.module);
      ram.clips = [
        S('rect', { x: x - 4, y: 182, width: 7, height: 14, rx: 1.5, class: 'lt-ram-clip', fill: 'url(#hd-metal-y)' }, ram.art),
        S('rect', { x: x + 139, y: 182, width: 7, height: 14, rx: 1.5, class: 'lt-ram-clip lt-ram-clip-r', fill: 'url(#hd-metal-y)' }, ram.art),
      ];
    });

    // ---- SSD NVMe M.2 2230 sous son capot métallique (à droite de la batterie, comme sur le Latitude 14)
    const ssd = part('ssd', 'SSD NVMe', { x: 486, y: 266, width: 52, height: 76 });
    S('rect', { x: 494, y: 272, width: 36, height: 56, rx: 2, fill: '#163a5c' }, ssd.art);
    S('rect', { x: 495, y: 270, width: 34, height: 5, fill: '#d9a441' }, ssd.art);
    S('rect', { x: 520, y: 270, width: 2, height: 5, fill: '#163a5c' }, ssd.art); // encoche « M »
    S('rect', { x: 500, y: 278, width: 24, height: 18, rx: 1, fill: 'url(#g-chip)' }, ssd.art);
    S('rect', { x: 497, y: 300, width: 30, height: 20, rx: 1, fill: '#f1f2ee' }, ssd.art);
    S('rect', { x: 497, y: 300, width: 30, height: 3, fill: '#f2c400' }, ssd.art);
    S('text', { x: 512, y: 313, class: 'lt-label', 'text-anchor': 'middle' }, ssd.art).textContent = 'NVMe';
    S('path', { d: 'M507 328 a5 5 0 0 0 10 0 Z', fill: '#d9a441' }, ssd.art); // demi-lune de la vis
    S('rect', { x: 503, y: 280, width: 18, height: 14, rx: 1.5, fill: '#f0b8cf', opacity: '.92' }, ssd.art); // pad thermique sur le contrôleur
    ssd.plate = S('g', { class: 'lt-ssd-plate' }, ssd.art);
    S('rect', { x: 490, y: 274, width: 44, height: 54, rx: 3, fill: 'url(#hd-metal-x)' }, ssd.plate);
    S('rect', { x: 490, y: 274, width: 44, height: 54, rx: 3, fill: '#1a1d1f', opacity: '.6' }, ssd.plate);
    S('rect', { x: 498, y: 292, width: 28, height: 16, rx: 1, fill: '#e9ebe6' }, ssd.plate);
    S('text', { x: 512, y: 302, class: 'lt-label', 'text-anchor': 'middle' }, ssd.plate).textContent = 'SSD';

    // ---- Carte Wi-Fi M.2 2230, verticale : support M.2 en bas, petit support métallique vissé en haut
    //      qui coince les deux antennes, guide-câble bleu sur le côté (comme sur le Latitude 14)
    const wifi = part('wifi', 'Carte Wi-Fi', { x: 502, y: 160, width: 54, height: 82 });
    S('rect', { x: 512, y: 168, width: 36, height: 64, rx: 2, fill: '#1b3f66' }, wifi.art);
    S('rect', { x: 514, y: 192, width: 32, height: 36, rx: 1.5, fill: '#f1f2ee' }, wifi.art);
    S('text', { x: 530, y: 203, class: 'lt-label', 'text-anchor': 'middle' }, wifi.art).textContent = 'Wi-Fi 6E';
    for (const qx of [518, 532]) S('rect', { x: qx, y: 208, width: 10, height: 10, fill: 'none', stroke: '#3a3e3c', 'stroke-width': 1.2, 'stroke-dasharray': '1.5 1' }, wifi.art);
    S('rect', { x: 513, y: 229, width: 34, height: 4, fill: '#d9a441' }, wifi.art); // contacts, côté support M.2
    S('rect', { x: 505, y: 172, width: 5, height: 60, rx: 2, fill: '#2f6fd1' }, wifi.art); // guide-câble bleu
    S('path', { d: 'M519 189 l2.6 -4.5 l2.6 4.5 z', fill: '#e8efe9' }, wifi.art); // triangle plein = MAIN
    S('path', { d: 'M535 189 l2.6 -4.5 l2.6 4.5 z', fill: 'none', stroke: '#e8efe9', 'stroke-width': '.8' }, wifi.art);
    wifi.bracket = S('rect', { x: 512, y: 164, width: 36, height: 14, rx: 2, class: 'lt-bracket' }, wifi.art);

    // ---- Refroidissement : ventilateur (boîtier noir) dont la sortie d'air souffle dans le bloc
    //      d'ailettes ; les caloducs partent de la plaque du processeur et se terminent sur ces ailettes
    const cool = part('cooling', 'Ventilateur et dissipateur', [{ x: 32, y: 50, width: 148, height: 144 }, { x: 226, y: 56, width: 140, height: 106 }, { x: 116, y: 16, width: 124, height: 40 }]);
    S('rect', { x: 118, y: 22, width: 118, height: 30, rx: 3, fill: 'url(#hd-metal-x)' }, cool.art); // ailettes
    for (let k = 0; k < 19; k++) S('path', { d: `M${122 + k * 6} 24 V50`, stroke: '#3a4044', 'stroke-width': 1.2 }, cool.art);
    const housing = 'M36 70 Q36 54 52 54 H118 V44 H176 V174 Q176 190 160 190 H52 Q36 190 36 174 Z'; // boîtier + sortie d'air
    S('path', { d: housing, fill: 'url(#lt-black)', stroke: '#626664', 'stroke-width': 6, 'stroke-linejoin': 'round' }, cool.art); // joint en mousse grise
    S('path', { d: housing, fill: 'none', stroke: '#8a8e8b', 'stroke-width': 3, 'stroke-dasharray': '0.8 1.8', 'stroke-linejoin': 'round' }, cool.art);
    S('circle', { cx: 106, cy: 122, r: 54, fill: '#0d0f10', stroke: '#2a2f33', 'stroke-width': 2 }, cool.art);
    // turbine : 31 pales courbes autour du moyeu
    const blades = S('g', { stroke: '#5c6468', 'stroke-width': 1.3, fill: 'none' }, cool.art);
    for (let k = 0; k < 44; k++) S('path', { d: 'M106 92 C112 84, 116 76, 113 68', transform: `rotate(${(k * 8.18).toFixed(1)} 106 122)` }, blades);
    S('circle', { cx: 106, cy: 122, r: 30, fill: '#2a2f33' }, cool.art); // gros moyeu
    S('circle', { cx: 106, cy: 122, r: 30, fill: 'url(#hd-sheen)' }, cool.art);
    // caloducs (noirs) : de la plaque du processeur jusqu'aux ailettes, au-dessus du ventilateur
    // croix de fixation (ses bras portent les 4 vis numérotées) et plaque froide posée sur le processeur
    S('path', { d: 'M242 72 L296 109 L350 72 M242 146 L296 109 L350 146', stroke: '#1a1d1f', 'stroke-width': 14, 'stroke-linecap': 'round', fill: 'none' }, cool.art);
    S('rect', { x: 258, y: 82, width: 78, height: 56, rx: 5, fill: 'url(#lt-black)' }, cool.art);
    S('text', { x: 266, y: 131, class: 'lt-label lt-label-light' }, cool.art).textContent = 'AT · COOL';
    S('path', { d: 'M316 132 l6 -10 l6 10 z', fill: 'none', stroke: '#d9dcd8', 'stroke-width': 1 }, cool.art); // pictogramme « surface chaude »
    // caloducs noirs : ils passent sur la plaque froide, longent le haut du ventilateur et finissent sur les ailettes
    S('path', { d: 'M322 100 H250 C214 100, 214 37, 194 37 H124 M322 114 H244 C206 114, 206 45, 186 45 H124', stroke: '#1a1d1f', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, cool.art);
    S('path', { d: 'M320 98 H250 C213 98, 213 35, 194 35 H126 M320 112 H244 C205 112, 205 43, 186 43 H126', stroke: '#4a5155', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }, cool.art);
    S('rect', { x: 236, y: 92, width: 10, height: 12, fill: '#0b0c0d' }, cool.art); // morceau d'adhésif noir sur le caloduc
    S('path', { d: 'M150 182 C160 196, 172 200, 184 200', class: 'lt-wire-pair' }, cool.art);

    // ---- Pile CMOS (bouton enveloppé de noir), câble rouge et noir vers la carte mère
    const cmos = part('cmos', 'Pile CMOS', { x: 46, y: 206, width: 56, height: 52 });
    S('circle', { cx: 74, cy: 232, r: 21, fill: '#15181a', stroke: '#2b3033' }, cmos.art);
    S('circle', { cx: 74, cy: 232, r: 21, fill: 'url(#hd-sheen)' }, cmos.art);
    S('text', { x: 74, y: 235, class: 'lt-label lt-label-light', 'text-anchor': 'middle' }, cmos.art).textContent = 'CR2032';
    S('path', { d: 'M94 230 C104 230, 108 236, 116 236 M94 234 C102 238, 108 240, 116 240', stroke: '#c8231b', 'stroke-width': 1.6, fill: 'none' }, cmos.art);

    // ---- Bouton ON/OFF (petite carte près de la charnière droite)
    const pw = part('power', 'Carte du bouton ON/OFF', { x: 540, y: 50, width: 72, height: 62 });
    S('rect', { x: 544, y: 52, width: 66, height: 56, rx: 4, fill: 'url(#lt-mb)', stroke: '#0f2b4d' }, pw.art);
    S('circle', { cx: 584, cy: 84, r: 13, fill: 'url(#hd-plastic)' }, pw.art);
    S('circle', { cx: 584, cy: 84, r: 5, fill: 'none', stroke: '#9aa1a5', 'stroke-width': 1.5 }, pw.art);

    // ---- Batterie (au premier plan, à l'avant)
    const bat = part('battery', 'Batterie', { x: 96, y: 272, width: 380, height: 126 });
    S('rect', { x: 100, y: 276, width: 370, height: 118, rx: 6, fill: 'url(#lt-cell)', stroke: '#0b0c0d' }, bat.art);
    S('rect', { x: 128, y: 284, width: 314, height: 102, rx: 3, fill: '#0b0c0d' }, bat.art);
    S('rect', { x: 136, y: 292, width: 68, height: 86, rx: 2, fill: '#e9ebe6' }, bat.art);
    S('text', { x: 170, y: 318, class: 'lt-bat-txt', 'text-anchor': 'middle' }, bat.art).textContent = '42 Wh';
    S('text', { x: 170, y: 334, class: 'lt-label', 'text-anchor': 'middle' }, bat.art).textContent = 'Li-ion 11,4 V';
    [
      'Débrancher la batterie avant toute intervention.',
      'Ne pas percer, ne pas chauffer, ne pas plier.',
      'Recyclage obligatoire · bac à piles et batteries.',
    ].forEach((t, k) => { S('text', { x: 214, y: 304 + k * 12, class: 'lt-label lt-label-light' }, bat.art).textContent = t; });
    S('rect', { x: 100, y: 276, width: 370, height: 118, rx: 6, fill: 'url(#hd-sheen)' }, bat.art);

    // ---- Vis et connecteurs de l'intérieur
    for (const it of ITEMS) drawItem(it);

    // ---- Capot inférieur (par-dessus tout)
    drawCover();
    refs.plugBottom = charger(bottom, 16, 74, -1); // retourné : la prise passe à gauche, face au port USB-C de charge
  }

  /** Groupe d'une pièce : dessin + zone(s) cliquable(s) collées à sa forme, pour la soulever (main). */
  function part(id, label, boxes) {
    const g = S('g', { class: `lt-part lt-${id.replace(/\d$/, '')}` }, bottom);
    const body = S('g', {}, g); // le corps de la pièce : c'est lui qu'entoure le contour de survol
    const art = S('g', { filter: 'url(#hd-shadow)' }, body);
    const zones = S('g', {}, g);
    const list = Array.isArray(boxes) ? boxes : [boxes];
    const hits = list.map((box, k) => S('rect', {
      ...box, rx: 8, class: 'lt-hit lt-part-hit', 'data-lt': `part:${id}`,
      ...(k === 0 ? { tabindex: 0, role: 'button', 'aria-label': `${label} : la soulever (main)` } : { 'aria-hidden': 'true' }),
    }, zones));
    refs.parts[id] = { g, body, art, hit: hits[0] };
    return refs.parts[id];
  }

  function drawItem(it) {
    const host = refs.parts[it.part].g;
    const g = S('g', { class: `lt-item lt-${it.kind}` }, host);
    const r = { g };
    if (it.kind === 'screw') {
      S('circle', { cx: it.x, cy: it.y, r: 5, fill: '#090a0b' }, g); // trou
      r.head = screwHead(g, it.x, it.y, 6.2);
      // marquages imprimés à côté du trou (hors du groupe de la vis : le contour de survol n'entoure que la vis)
      if (it.n) S('text', { x: it.x + 9, y: it.y - 7, class: 'lt-num' }, host).textContent = String(it.n);
      if (!it.captive) S('text', { x: it.x + 9, y: it.y + 12, class: 'lt-size' }, host).textContent = `▲${it.size ?? SIZES[it.part]}`;
      r.hit = hit(g, `item:${it.id}`, { cx: it.x, cy: it.y, r: 11 }, `Vis${it.n ? ` n° ${it.n}` : ''} ${PARTS[it.part].of}${it.captive ? ' (imperdable)' : ''}`);
    } else if (it.kind === 'plug') {
      const w = it.wide ? 34 : 18;
      if (!it.wide) S('rect', { x: it.x - w / 2 - 1, y: it.y - 5, width: w + 2, height: 10, rx: 1.5, fill: '#cfd2cc' }, g); // embase
      r.plug = S('g', {}, g);
      S('rect', { x: it.x - w / 2, y: it.y - 4, width: w, height: 9, rx: 1.5, fill: it.wide ? '#4a4f52' : '#f2f3ef', stroke: '#9aa09c', 'stroke-width': '.6' }, r.plug);
      if (it.wide) {
        // câble de la batterie (gaine noire)
        ['#141516', '#141516', '#141516', '#141516', '#141516'].forEach((c, k) => {
          S('path', { d: `M${it.x - 8 + k * 4} ${it.y + 5} V${it.y + 16}`, stroke: c, 'stroke-width': 1.8 }, r.plug);
        });
      } else {
        S('path', { d: `M${it.x - 4} ${it.y + 4} v6 M${it.x} ${it.y + 4} v6 M${it.x + 4} ${it.y + 4} v6`, stroke: '#1a1c1d', 'stroke-width': 1.6 }, r.plug);
      }
      r.hit = hit(g, `item:${it.id}`, { x: it.x - w / 2 - 6, y: it.y - 10, width: w + 12, height: 24, rx: 4 }, `Débrancher ${it.label}`);
    } else if (it.kind === 'ant') {
      const color = it.id === 'ant-main' ? '#141516' : '#e8e9e4';
      r.cable = S('path', { d: `M${it.x} ${it.y} C${it.x} 120, ${it.x - 20} 60, ${it.x - 30} 18`, stroke: color, 'stroke-width': 2.6, fill: 'none' }, g); // vers la charnière
      r.plug = S('circle', { cx: it.x, cy: it.y, r: 4, fill: 'url(#hd-gold)', stroke: '#6f5420', 'stroke-width': '.6' }, g);
      r.hit = hit(g, `item:${it.id}`, { cx: it.x, cy: it.y, r: 9 }, `Déconnecter ${it.label}`);
    } else if (it.kind === 'zif') {
      const [dx] = it.dir;
      // nappe (avec sa languette bleue) qui entre dans le connecteur
      const rib = dx ? { x: it.x - 26, y: it.y + 4, width: 30, height: it.h - 8 } : { x: it.x + 4, y: it.y + 4, width: it.w - 8, height: 30 };
      r.ribbon = S('g', {}, g);
      S('rect', { ...rib, fill: '#d8973e', opacity: '.95' }, r.ribbon);
      S('rect', dx ? { x: rib.x, y: rib.y, width: 8, height: rib.height, fill: '#2f6fd1' } : { x: rib.x, y: rib.y + rib.height - 8, width: rib.width, height: 8, fill: '#2f6fd1' }, r.ribbon);
      S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 1.5, fill: '#111314' }, g);
      r.latch = S('rect', dx ? { x: it.x + it.w - 3, y: it.y - 1, width: 5, height: it.h + 2, rx: 1 } : { x: it.x - 1, y: it.y - 2, width: it.w + 2, height: 5, rx: 1 }, g);
      r.latch.setAttribute('class', 'lt-latch');
      r.hit = hit(g, `item:${it.id}`, { x: it.x - 8, y: it.y - 8, width: it.w + 16, height: it.h + 16, rx: 4 }, `Connecteur de ${it.label}`);
    } else if (it.kind === 'edp') {
      S('path', { d: `M${it.x + 14} ${it.y} V18`, stroke: '#2b3a52', 'stroke-width': 12 }, g); // nappe vers l'écran
      r.plug = S('g', {}, g);
      S('rect', { x: it.x, y: it.y, width: 28, height: 12, rx: 1.5, fill: 'url(#hd-metal-x)' }, r.plug);
      S('rect', { x: it.x + 8, y: it.y - 10, width: 12, height: 9, rx: 2, fill: '#2f6fd1' }, r.plug);
      r.bracket = S('path', { d: `M${it.x - 12} ${it.y + 2} H${it.x + 40} V${it.y + 14} H${it.x - 12} Z`, class: 'lt-bracket lt-edp-bracket' }, g); // support métallique vissé
      r.hit = hit(g, `item:${it.id}`, { x: it.x - 10, y: it.y - 18, width: 48, height: 38, rx: 4 }, `Connecteur de ${it.label}`);
    }
    refs.items[it.id] = r;
  }

  function drawCover() {
    const g = S('g', { class: 'lt-cover' }, bottom);
    refs.cover.g = g;
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#lt-cover)', stroke: '#0e1011', 'stroke-width': 2 }, g);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#hd-weave)' }, g);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#hd-sheen)' }, g);
    S('rect', { x: 24, y: 24, width: 592, height: 372, rx: 16, fill: 'none', stroke: '#000000', 'stroke-opacity': '.35' }, g);
    for (let k = 0; k < 9; k++) S('rect', { x: 62 + k * 10, y: 76, width: 5, height: 92, rx: 2.5, fill: '#0b0c0d' }, g); // grille face au ventilateur
    // étiquette réglementaire
    S('rect', { x: 412, y: 286, width: 150, height: 66, rx: 3, fill: '#e8e9e4' }, g);
    ['AT-17 · Modèle P17G', 'Service Tag : 17AT26', 'Entrée : 19,5 V ⎓ 3,34 A', 'Fabriqué pour l’atelier'].forEach((t, k) => {
      S('text', { x: 420, y: 302 + k * 13, class: 'lt-label' }, g).textContent = t;
    });
    // vis imperdables (la 8e sous le patin arrière)
    refs.cover.screws = COVER_SCREWS.map(([x, y], i) => {
      const sg = S('g', { class: 'lt-cscrew' }, g);
      S('circle', { cx: x, cy: y, r: 7.5, fill: '#0b0c0d' }, sg);
      const head = screwHead(sg, x, y, 6.6);
      const h = hit(sg, `cscrew:${i}`, { cx: x, cy: y, r: 12 }, `Vis du capot n° ${i + 1}`);
      return { sg, head, hit: h };
    });
    // patins : l'arrière (long) cache une vis, les deux avant sont décoratifs
    refs.cover.foot = S('rect', { x: 120, y: 22, width: 400, height: 19, rx: 9.5, class: 'lt-foot' }, g);
    refs.cover.footHit = hit(g, 'foot', { x: 116, y: 18, width: 408, height: 27, rx: 12 }, 'Patin en caoutchouc arrière');
    S('rect', { x: 40, y: 380, width: 70, height: 16, rx: 8, class: 'lt-foot' }, g);
    S('rect', { x: 530, y: 380, width: 70, height: 16, rx: 8, class: 'lt-foot' }, g);
    // points de déclipsage (signalés une fois les vis desserrées)
    refs.cover.clips = CLIPS.map(([x, y], i) => {
      const cg = S('g', { class: 'lt-clip' }, g);
      S('path', { d: `M${x - 7} ${y} l7 -6 l7 6`, class: 'lt-clip-mark', transform: `rotate(${x < 40 ? -90 : x > 600 ? 90 : 180} ${x} ${y})` }, cg);
      const h = hit(cg, `clip:${i}`, { cx: x, cy: y, r: 14 }, `Jointure du capot, point ${i + 1}`);
      return { cg, hit: h };
    });
  }

  /* ---------- Petits dessins réutilisés ---------- */
  function grad(defs, id, stops) {
    const g = S('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    stops.forEach(([o, c]) => S('stop', { offset: o, 'stop-color': c }, g));
  }
  function screwHead(parent, x, y, r) {
    const g = S('g', { class: 'lt-screw-head' }, parent);
    S('circle', { cx: x, cy: y, r, fill: 'url(#hd-alu)', stroke: '#4b5257', 'stroke-width': 1 }, g);
    S('path', { d: `M${x - r * 0.55} ${y} H${x + r * 0.55} M${x} ${y - r * 0.55} V${y + r * 0.55}`, stroke: '#3a4044', 'stroke-width': 1.6, 'stroke-linecap': 'round', transform: `rotate(18 ${x} ${y})` }, g);
    return g;
  }
  /** Port vu de dessus, au bord de la carte : USB-C, USB-A ou Ethernet (RJ45). */
  function port(parent, x, y, w, h, kind) {
    S('rect', { x, y, width: w, height: h, rx: kind === 'usbc' ? 4 : 1.5, fill: 'url(#hd-metal-y)', stroke: '#4b5257', 'stroke-width': '.8' }, parent);
    if (kind === 'usbc') S('rect', { x: x + 3, y: y + 4, width: w - 6, height: h - 8, rx: 2.5, fill: '#15181a' }, parent);
    if (kind === 'usba') S('rect', { x: x + 3, y: y + 3, width: w - 7, height: h - 6, rx: 1, fill: '#1f5fbf' }, parent);
    if (kind === 'usba-gold') {
      S('rect', { x, y, width: w, height: h, rx: 1.5, fill: 'url(#hd-gold)' }, parent);
      S('rect', { x: x + 4, y: y + 4, width: w - 9, height: h - 8, rx: 1, fill: '#15181a' }, parent);
    }
    if (kind === 'rj45') {
      // pièce métallique vissée qui tient la prise Ethernet
      S('rect', { x: x + 3, y: y + 3, width: w - 6, height: h - 6, rx: 2, fill: 'url(#hd-metal-y)', stroke: '#6b7276', 'stroke-width': '.8' }, parent);
      for (const k of [0.18, 0.5, 0.82]) S('circle', { cx: x + w / 2, cy: y + h * k, r: 3.4, fill: 'url(#hd-alu)', stroke: '#4b5257', 'stroke-width': '.8' }, parent);
    }
  }
  function smd(parent, pts) {
    for (const [x, y] of pts) S('rect', { x: x - 4, y: y - 2, width: 8, height: 4, rx: 0.6, fill: '#2a2d2f', stroke: '#b9bfc2', 'stroke-width': '.6' }, parent);
  }
  function hit(parent, key, geo, label) {
    const tag = 'r' in geo ? 'circle' : 'rect';
    return S(tag, { ...geo, class: 'lt-hit', tabindex: 0, role: 'button', 'data-lt': key, 'aria-label': label }, parent);
  }

  /* =========================================================
     Actions
     ========================================================= */
  function say(text, kind = '') {
    msgEl.textContent = text;
    msgEl.dataset.kind = kind;
  }
  function oops(text) {
    st.errors++;
    sfx('buzz', { passive: true });
    say(text, 'bad');
    renderSide();
  }
  function startClock() {
    if (st.t0 || st.done) return;
    st.t0 = 1;
    timer = setInterval(() => {
      if (!visible || document.hidden) return;
      st.elapsed += 1;
      stat.time.textContent = fmt(st.elapsed);
    }, 1000);
  }

  function pickTool(id, { quiet = false } = {}) {
    st.tool = id;
    $$('.lt-tool', toolsBox).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === id)));
    bottom.dataset.tool = id;
    top.dataset.tool = id;
    if (!quiet) { sfx('click'); say(TOOL_HINTS[id]); }
  }

  function toggleWrist() {
    st.esd = !st.esd;
    wristBtn.setAttribute('aria-pressed', String(st.esd));
    root.classList.toggle('has-esd', st.esd);
    sfx('click');
    startClock();
    say(st.esd
      ? 'Bracelet antistatique au poignet, pince reliée à la terre ✔ Ton corps reste au même potentiel que la machine : plus de décharge électrostatique.'
      : 'Bracelet retiré. À remettre avant de toucher l’intérieur !', st.esd ? 'good' : '');
  }

  function doFlip() {
    if (st.cover.off) return say('Le capot est ouvert : on ne retourne plus le PC, les pièces tomberaient.');
    if (st.charger && !st.flipped) return oops('Débranche d’abord le chargeur : on ne manipule jamais un PC branché.');
    st.flipped = !st.flipped;
    flip.classList.toggle('is-flipped', st.flipped);
    top.inert = st.flipped;
    bottom.inert = !st.flipped;
    flipBtn.textContent = st.flipped ? '↻ Remettre à l’endroit' : '↻ Retourner le PC';
    sfx('whoosh', { passive: true });
    startClock();
    if (st.flipped) say('PC retourné ✔ Posé sur un tapis antistatique ou un chiffon doux, pour ne pas rayer le capot. On desserre les vis du capot (tournevis).', 'good');
    return undefined;
  }

  function act(key) {
    if (st.done) return;
    startClock();
    const [kind, arg] = key.split(':');
    if (kind === 'charger') unplugCharger();
    else if (kind === 'cscrew') coverScrew(Number(arg));
    else if (kind === 'foot') peelFoot();
    else if (kind === 'clip') coverClip(Number(arg));
    else if (kind === 'item') itemAction(ITEM[arg]);
    else if (kind === 'part') liftPart(arg);
    light(hovered); // le geste a pu changer la couleur du contour (ou l'effacer : pièce partie)
  }

  /**
   * Peut-on s'occuper de cet élément maintenant, l'ordre de démontage étant respecté ?
   * 'ok' (contour vert), 'no' (rouge : il faut d'abord autre chose) ou null (déjà fait).
   * Le choix de l'outil reste au joueur : il ne change pas la couleur.
   */
  function status(key) {
    if (st.done) return null;
    const [kind, arg] = key.split(':');
    if (kind === 'charger') return st.charger ? 'ok' : null;
    if (kind === 'cscrew') return st.cover.screws[arg] ? null : 'ok';
    if (kind === 'foot') return st.cover.foot ? null : 'ok';
    if (kind === 'clip') {
      if (st.cover.clips[arg]) return null;
      return st.esd && st.cover.screws.every(Boolean) ? 'ok' : 'no';
    }
    if (kind === 'item') {
      const it = ITEM[arg];
      if (st.items[it.id] === 'out') return null;
      if (!st.esd || (it.id !== 'bat-plug' && !batteryOff())) return 'no';
      if (it.n && ITEMS.some((x) => x.part === it.part && x.n > it.n && st.items[x.id] !== 'out')) return 'no';
      if ([].concat(it.needs ?? []).some((n) => st.items[n] !== 'out')) return 'no';
      return 'ok';
    }
    if (kind === 'part') {
      if (st.removed.has(arg)) return null;
      if (!st.esd || !batteryOff() || PARTS[arg].after.some((a) => !st.removed.has(a))) return 'no';
      if (ITEMS.some((it) => it.kind === 'screw' && it.part === arg && st.items[it.id] !== 'out')) return 'no';
      if (ITEMS.some((it) => it.blocks?.includes(arg) && !disconnected(it))) return 'no';
      return 'ok';
    }
    return null;
  }

  /** Entoure l'élément survolé : sa vraie silhouette (pièce, vis, connecteur…), pas sa zone de clic. */
  function light(target) {
    hovered = target;
    lit?.classList.remove('is-ok', 'is-no');
    lit = null;
    const s = target && status(target.dataset.lt);
    if (!s) return;
    const [kind, arg] = target.dataset.lt.split(':');
    if (kind === 'foot') lit = refs.cover.foot;
    else if (kind === 'part') lit = refs.parts[arg].body;
    else lit = target.closest('.lt-item, .lt-cscrew, .lt-clip, .lt-charger');
    lit?.classList.add(`is-${s}`);
  }

  function unplugCharger() {
    if (!st.charger) return undefined;
    if (st.tool !== 'hand') return say('La fiche se retire à la main.');
    st.charger = false;
    for (const p of [refs.plugTop, refs.plugBottom]) p.classList.add('is-out');
    refs.chargeLed.classList.remove('is-on');
    sfx('clack');
    return say('Chargeur débranché ✔ Le voyant de charge s’éteint. Maintenant : le bracelet antistatique, puis on retourne le PC.', 'good');
  }

  /* ---------- Capot ---------- */
  function coverScrew(i) {
    const c = refs.cover.screws[i];
    if (st.cover.screws[i]) return say('Cette vis est déjà desserrée (vis imperdable : elle reste dans le capot).');
    if (st.tool !== 'driver') return say('Il faut le tournevis cruciforme pour les vis.');
    if (st.charger) return oops('Le chargeur est encore branché ! Débranche-le avant d’ouvrir quoi que ce soit.');
    st.cover.screws[i] = true;
    c.sg.classList.add('is-loose');
    spin(c.head);
    sfx('tink', { passive: true });
    const left = st.cover.screws.filter((s) => !s).length;
    if (left === 1 && !st.cover.foot) return say('Vis desserrée. Il en reste une… mais où ? Sur beaucoup de portables, une vis se cache sous un patin.');
    if (left === 0) {
      refs.cover.g.classList.add('is-ready');
      return say('Toutes les vis sont desserrées ✔ Elles sont imperdables : elles restent prisonnières du capot. Place au spudger : on déclipse le capot en commençant près des charnières.', 'good');
    }
    return say(`Vis desserrée (vis imperdable, elle reste dans le capot). Encore ${left}.`);
  }

  function peelFoot() {
    if (st.cover.foot) return undefined;
    if (st.tool === 'driver') return say('Le patin est collé, pas vissé : glisse plutôt le spudger dessous.');
    if (st.tool === 'hand') return say('Avec les ongles, on risque de le déchirer : glisse le spudger dessous.');
    st.cover.foot = true;
    refs.cover.foot.classList.add('is-peeled');
    refs.cover.footHit.setAttribute('display', 'none');
    sfx('rip', { passive: true });
    return say('Patin décollé : une vis cachée ! On le recolle au remontage (avec un point de colle si besoin).', 'good');
  }

  function coverClip(i) {
    if (st.cover.clips[i]) return undefined;
    if (st.tool !== 'spudger') return say('Les clips se libèrent au spudger : on le glisse dans la jointure et on fait levier doucement.');
    if (st.cover.screws.some((s) => !s)) return oops('Ça résiste : il reste une vis ! En forçant, on casse les clips du capot.');
    if (!st.esd) return oops('Avant d’ouvrir, mets le bracelet antistatique : l’intérieur est plein de composants sensibles.');
    st.cover.clips[i] = true;
    refs.cover.clips[i].cg.classList.add('is-done');
    sfx('snap');
    const left = st.cover.clips.filter((c) => !c).length;
    if (left) return say(`Clac ! Clip libéré. On progresse le long de la jointure, sans tordre le capot (encore ${left}).`);
    st.cover.off = true;
    st.removed.add('cover');
    flipBtn.disabled = true;
    lift(refs.cover.g);
    renderSide();
    return say('Capot déposé ✔ Premier réflexe, avant de toucher à quoi que ce soit : débrancher la batterie (main, sur son connecteur marqué BATTERY).', 'good');
  }

  /* ---------- Intérieur ---------- */
  const batteryOff = () => st.items['bat-plug'] === 'out';
  const disconnected = (it) => ({ plug: 'out', ant: 'out', zif: 'out', edp: 'out' })[it.kind] === st.items[it.id];

  function guard(it) {
    if (!st.esd) { oops('Bracelet antistatique d’abord ! Une décharge invisible suffit à abîmer une puce.'); return false; }
    if (it?.id !== 'bat-plug' && !batteryOff()) {
      oops('Batterie d’abord ! Tant qu’elle est branchée, la carte reste sous tension : le moindre faux contact peut la griller.');
      return false;
    }
    return true;
  }

  function itemAction(it) {
    if (!guard(it)) return undefined;
    const r = refs.items[it.id];
    const state = st.items[it.id];
    switch (it.kind) {
      case 'screw': {
        if (state === 'out') return say(it.captive ? 'Cette vis est déjà desserrée (imperdable).' : '');
        if (st.tool !== 'driver') return say('Il faut le tournevis cruciforme pour les vis.');
        if (it.n) {
          const higher = ITEMS.filter((x) => x.part === it.part && x.n > it.n && st.items[x.id] !== 'out');
          if (higher.length) return oops(`Dans l’ordre inverse des numéros : commence par la vis ${Math.max(...higher.map((x) => x.n))}. On desserre 4 → 1 pour garder la pression égale sur la puce.`);
        }
        st.items[it.id] = 'out';
        if (it.captive) {
          r.g.classList.add('is-loose');
          spin(r.head);
          sfx('tink', { passive: true });
          return say(`Vis n° ${it.n} desserrée ✔ Elle est imperdable : elle reste prisonnière du dissipateur.`);
        }
        st.screws++;
        st.tray[it.part]++;
        unscrew(r);
        sfx('tink', { passive: true });
        if (it.id === 'wifi-s') refs.parts.wifi.g.classList.add('no-bracket');
        if (ITEM.edp.needs.includes(it.id) && ITEM.edp.needs.every((n) => st.items[n] === 'out')) refs.items.edp.bracket.classList.add('is-off');
        renderSide();
        if (it.id === 'wifi-s') return say(`Vis ${SIZES.wifi} retirée ✔ Le support métallique qui protégeait les connecteurs d’antenne vient avec elle. Les antennes sont accessibles.`, 'good');
        return say(`Vis ${it.size ?? SIZES[it.part]} retirée, rangée d’elle-même dans le bac magnétique (compartiment « ${TRAY_LABELS[it.part]} ») : les vis n’ont pas toutes la même longueur, et une vis trop longue au remontage peut percer la carte.`);
      }
      case 'plug': {
        if (state === 'out') return undefined;
        if (st.tool === 'driver') return say('Pas de vis ici : c’est un connecteur, il se débranche à la main.');
        st.items[it.id] = 'out';
        r.plug.setAttribute('transform', `translate(${it.pull[0]} ${it.pull[1]})`);
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        if (it.id === 'bat-plug') return say('Batterie débranchée ✔ On tire le connecteur droit hors de son embase, par le connecteur et jamais par les fils. La machine est hors tension : on peut travailler.', 'good');
        return say(`${cap(it.label)} débranché ✔ Par le connecteur, jamais par les fils.`, 'good');
      }
      case 'ant': {
        if (state === 'out') return undefined;
        if (it.needs && st.items[it.needs] !== 'out') return say('Le support métallique de la carte Wi-Fi couvre les connecteurs d’antenne : retire d’abord sa vis (tournevis).');
        if (st.tool === 'hand') return say('À la main, on risque d’arracher le câble : soulève le petit connecteur bien à la verticale, avec la pointe du spudger.');
        if (st.tool !== 'spudger') return say('Les antennes se déconnectent au spudger.');
        st.items[it.id] = 'out';
        r.plug.setAttribute('transform', 'translate(-3 -6)');
        r.cable.setAttribute('transform', 'translate(-3 -6)');
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        return say(`${cap(it.label)} déconnectée ✔ Les connecteurs U.FL sont fragiles : on les soulève bien droit. Au remontage, noir sur MAIN, blanc sur AUX.`, 'good');
      }
      case 'zif': {
        if (state === 'out') return undefined;
        if (state === 'locked') {
          if (st.tool === 'hand') return oops('Ne tire pas encore ! Le loquet verrouille la nappe : en tirant, on arrache ses pistes. Soulève d’abord le loquet avec le spudger.');
          if (st.tool !== 'spudger') return say('Le loquet se soulève avec la pointe du spudger (ou l’ongle).');
          st.items[it.id] = 'open';
          r.g.classList.add('is-open');
          r.latch.setAttribute('transform', it.dir[0] ? 'translate(4 0)' : 'translate(0 -4)'); // le loquet pivote
          sfx('click');
          return say(`Loquet soulevé ✔ (il pivote de 90°). Tire maintenant ${it.label} à plat par sa languette bleue, à la main, parallèlement à la carte.`, 'good');
        }
        if (st.tool !== 'hand') return say('Le loquet est ouvert : tire maintenant la nappe par sa languette, à la main, bien à plat.');
        st.items[it.id] = 'out';
        const [dx, dy] = it.dir;
        r.ribbon.setAttribute('transform', `translate(${dx * 12} ${dy * 12})`);
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        return say(`${cap(it.label)} libérée ✔ Au remontage : nappe enfoncée bien droite jusqu’au repère, puis on rabat le loquet.`, 'good');
      }
      case 'edp': {
        if (state === 'out') return undefined;
        if (it.needs.some((n) => st.items[n] !== 'out')) return say('La nappe de l’écran est tenue par un support métallique vissé : retire d’abord ses 2 vis (tournevis).');
        if (st.tool !== 'hand') return say('La nappe de l’écran se débranche à la main, par sa languette.');
        st.items[it.id] = 'out';
        r.plug.setAttribute('transform', 'translate(0 -10)');
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        return say('Nappe de l’écran débranchée ✔ On tire la languette bleue parallèlement à la carte, sans plier la nappe. L’écran reste en place : on ne le démonte pas aujourd’hui.', 'good');
      }
      default: return undefined;
    }
  }

  function liftPart(id) {
    if (st.removed.has(id)) return undefined;
    if (!guard(id === 'battery' ? null : { id })) return undefined;
    if (id === 'battery' && !batteryOff()) return say('Débranche d’abord le connecteur de la batterie (main), puis retire ses vis.');
    if (st.tool !== 'hand') {
      if (st.tool === 'driver') return say('Choisis une vis, ou prends la main pour soulever une pièce.');
      return say('Le spudger sert aux clips, aux loquets et aux antennes. Pour soulever une pièce, prends la main.');
    }
    const p = PARTS[id];
    const missing = p.after.filter((a) => !st.removed.has(a));
    if (missing.length) {
      const tail = id === 'touchpad' ? ' Son support passe sous la carte mère.' : '';
      return say(`Pas encore : il faut d’abord déposer ${missing.map((a) => PARTS[a].the).join(', ')}.${tail}`);
    }
    const screws = ITEMS.filter((it) => it.kind === 'screw' && it.part === id && st.items[it.id] !== 'out');
    if (screws.length) return say(`Ça ne vient pas : il reste ${screws.length} vis sur ${p.the}.${screws.some((s) => s.n) ? ' (Vis numérotées : ordre inverse, 4 → 1.)' : ''}`);
    const plugged = ITEMS.filter((it) => it.blocks?.includes(id) && !disconnected(it));
    if (plugged.length) return say(`Encore branché : ${plugged[0].label}.${plugged[0].kind === 'zif' ? ' (Loquet au spudger, puis nappe à la main.)' : ''}`);
    // gestes propres à la pièce (clips de la RAM, plaque thermique du SSD)
    if (p.steps && st.steps[id] < p.steps.length) {
      const text = p.steps[st.steps[id]];
      st.steps[id]++;
      refs.parts[id].g.classList.add(`is-step-${st.steps[id]}`);
      sfx('click');
      return say(text, 'good');
    }
    st.removed.add(id);
    lift(refs.parts[id].g);
    sfx('whoosh', { passive: true });
    renderSide();
    if (st.removed.size === N_PARTS) return finish();
    return say(TIPS[id], 'good');
  }

  /* ---------- Animations ---------- */
  function spin(node) {
    if (reducedMotion()) return;
    node.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-540deg)' }], { duration: 450, easing: 'ease-out' });
  }
  function unscrew(r) {
    if (reducedMotion()) { r.g.classList.add('is-out'); return; }
    r.head.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'rotate(-720deg) scale(1.15)', opacity: 1, offset: 0.7 },
      { transform: 'rotate(-900deg) scale(.6) translate(0, -14px)', opacity: 0 },
    ], { duration: 650, easing: 'ease-in' }).finished.then(() => r.g.classList.add('is-out'), () => r.g.classList.add('is-out'));
  }
  function lift(g) {
    const hide = () => { g.setAttribute('display', 'none'); };
    if (reducedMotion()) { hide(); return; }
    g.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(0, -16px) scale(1.03)', opacity: 1, offset: 0.4 },
      { transform: 'translate(0, -40px) scale(1.06)', opacity: 0 },
    ], { duration: 620, easing: 'ease-in' }).finished.then(hide, hide);
  }

  /* ---------- Indice : met en évidence le prochain geste ---------- */
  function hint() {
    sfx('click');
    startClock();
    const show = (node, text) => {
      if (node) {
        node.classList.remove('is-hint');
        void node.getBoundingClientRect();
        node.classList.add('is-hint');
        setTimeout(() => node.classList.remove('is-hint'), 2600);
      }
      say(`Indice : ${text}`);
    };
    if (st.charger) return show(refs.plugTop.querySelector('.lt-hit'), 'débranche le chargeur (main, sur la fiche).');
    if (!st.esd) return show(wristBtn, 'mets le bracelet antistatique (à droite).');
    if (!st.flipped) return show(flipBtn, 'retourne le PC.');
    if (!st.cover.off) {
      const i = st.cover.screws.findIndex((s, k) => !s && (k < 7 || st.cover.foot));
      if (i >= 0) return show(refs.cover.screws[i].hit, 'desserre cette vis (tournevis).');
      if (!st.cover.foot) return show(refs.cover.footHit, 'décolle le patin arrière (spudger) : une vis s’y cache.');
      const c = st.cover.clips.findIndex((x) => !x);
      return show(refs.cover.clips[c].hit, 'libère ce clip (spudger).');
    }
    if (!batteryOff()) return show(refs.items['bat-plug'].hit, 'débranche la batterie (main).');
    const ORDER = ['battery', 'ram1', 'ram2', 'ssd', 'wifi', 'cooling', 'cmos', 'speakers', 'power', 'mb', 'touchpad', 'keyboard'];
    for (const id of ORDER) {
      if (st.removed.has(id) || PARTS[id].after.some((a) => !st.removed.has(a))) continue;
      const screws = ITEMS.filter((it) => it.kind === 'screw' && it.part === id && st.items[it.id] !== 'out').sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
      if (screws.length) return show(refs.items[screws[0].id].hit, `${screws[0].captive ? 'desserre' : 'retire'} cette vis (tournevis)${screws[0].n ? ', dans l’ordre inverse des numéros' : ''}.`);
      const plugged = ITEMS.find((it) => it.blocks?.includes(id) && !disconnected(it));
      if (plugged) {
        const how = plugged.kind === 'zif' ? (st.items[plugged.id] === 'locked' ? 'soulève le loquet (spudger)' : 'tire la nappe à plat (main)')
          : plugged.kind === 'ant' ? 'soulève l’antenne (spudger)'
            : plugged.kind === 'edp' ? 'tire la languette (main)' : 'débranche le connecteur (main)';
        return show(refs.items[plugged.id].hit, `${plugged.label} : ${how}.`);
      }
      const p = PARTS[id];
      if (p.steps && st.steps[id] < p.steps.length) return show(refs.parts[id].hit, id === 'ssd' ? 'retire la plaque thermique du SSD (main).' : `écarte les clips ${p.of} (main).`);
      return show(refs.parts[id].hit, `soulève ${p.the} (main).`);
    }
    return undefined;
  }

  /* ---------- Panneau latéral : bac, liste des pièces, compteurs ---------- */
  function renderSide() {
    trayEl.replaceChildren(...TRAY.map((k) => el('li', { cls: st.tray[k] ? 'has' : '', attrs: { title: `${PARTS[k].name} : vis ${SIZES[k]}` } }, [
      el('span', { text: TRAY_LABELS[k] }), el('small', { text: SIZES[k] }), el('b', { text: String(st.tray[k]) }),
    ])));
    const all = [['cover', 'Capot inférieur'], ...Object.entries(PARTS).map(([id, p]) => [id, p.name])];
    partsEl.replaceChildren(...all.map(([id, name]) => el('li', { cls: st.removed.has(id) ? 'is-done' : '', text: name })));
    stat.parts.textContent = String(st.removed.size);
    stat.errors.textContent = String(st.errors);
    stat.screws.textContent = String(st.screws);
    stat.time.textContent = fmt(st.elapsed);
  }

  function finish() {
    st.done = true;
    clearInterval(timer);
    achieve('teardown');
    sfx('fanfare');
    $('.lt-end-stats', endEl).textContent = `${fmt(st.elapsed)} · ${st.errors} erreur${st.errors > 1 ? 's' : ''} · ${st.screws} vis rangées dans le bac magnétique`;
    endEl.hidden = false;
    say('PC entièrement démonté, pièces triées, vis rangées : du travail d’atelier !', 'good');
    $('[data-lt-reset]', endEl)?.focus();
  }
}

/* =========================================================
   Outils dessinés (vue de dessus, posés sur l'établi)
   ========================================================= */
function toolArt(id) {
  const s = S('svg', { viewBox: '0 0 100 32', class: `lt-tool-art lt-art-${id}`, 'aria-hidden': 'true', focusable: 'false' });
  if (id === 'driver') {
    // tournevis de précision : embout cruciforme PH0, tige en acier, manche bi-matière, capuchon tournant
    S('path', { d: 'M11 14.6 L4.6 15.5 L3 16 L4.6 16.5 L11 17.4 Z', fill: 'url(#hd-metal-x)' }, s);
    S('path', { d: 'M4.8 16 H9.6', stroke: '#4b5257', 'stroke-width': '.7' }, s); // la croix de l'embout
    S('rect', { x: 10, y: 14.5, width: 40, height: 3, fill: 'url(#hd-metal-x)' }, s);
    S('rect', { x: 48, y: 12.4, width: 6, height: 7.2, rx: 1.2, fill: 'url(#hd-metal-x)' }, s); // bague
    const cone = 'M53 12.8 L61 10 H66 V22 H61 L53 19.2 Z';
    S('path', { d: cone, fill: '#e0821f' }, s);
    S('path', { d: cone, fill: 'url(#hd-cyl-x)' }, s);
    S('rect', { x: 64, y: 10, width: 25, height: 12, rx: 2.5, fill: '#1b1e20' }, s); // grip noir
    for (let k = 0; k < 6; k++) S('rect', { x: 67 + k * 3.6, y: 10.5, width: 1.3, height: 11, rx: 0.6, fill: '#3a4044' }, s); // stries
    S('rect', { x: 64, y: 10, width: 25, height: 12, rx: 2.5, fill: 'url(#hd-cyl-x)' }, s);
    S('rect', { x: 87, y: 10.6, width: 7, height: 10.8, rx: 2.5, fill: '#e0821f' }, s);
    S('rect', { x: 87, y: 10.6, width: 7, height: 10.8, rx: 2.5, fill: 'url(#hd-cyl-x)' }, s);
    S('rect', { x: 93, y: 12, width: 5.5, height: 8, rx: 2, fill: 'url(#hd-metal-x)' }, s); // capuchon tournant
  } else if (id === 'spudger') {
    // spudger en nylon noir (antistatique) : bout plat d'un côté, pointe de l'autre
    const body = 'M3.6 13 L14 12 H84 L97.6 15.4 Q98.5 16 97.6 16.6 L84 20 H14 L3.6 19 Q2.6 16 3.6 13 Z';
    S('path', { d: body, fill: 'url(#hd-plastic)', stroke: '#5c6468', 'stroke-width': '.5' }, s);
    S('path', { d: 'M14 13.3 H83.5', stroke: '#ffffff', 'stroke-opacity': '.22', 'stroke-width': '.8' }, s);
    S('path', { d: 'M16 16 H82', stroke: '#000000', 'stroke-opacity': '.45', 'stroke-width': '.8' }, s); // arête
    S('path', { d: 'M14 12 L10 16 L14 20 M84 12 L88 16 L84 20', stroke: '#000000', 'stroke-opacity': '.35', 'stroke-width': '.6', fill: 'none' }, s); // biseaux
  } else if (id === 'hand') {
    // main droite vue de dessus, l'index tendu ; le bracelet antistatique apparaît au poignet une fois mis
    const shapes = [
      ['rect', { x: 36, y: 7.5, width: 34, height: 21, rx: 8 }], // dos de la main
      ['rect', { x: 64, y: 10.5, width: 16, height: 15, rx: 3 }], // poignet
      ['rect', { x: 6, y: 10, width: 42, height: 7.2, rx: 3.6 }], // index
      ['rect', { x: 30, y: 16.6, width: 16, height: 5.6, rx: 2.8 }], // doigts repliés
      ['rect', { x: 32, y: 21.4, width: 14, height: 5.2, rx: 2.6 }],
      ['rect', { x: 35, y: 25.6, width: 11, height: 4.4, rx: 2.2 }],
      ['rect', { x: 25, y: 5.6, width: 27, height: 6.4, rx: 3.2, transform: 'rotate(7 38 8.8)' }], // pouce, couché le long de l'index
    ];
    // deux passes : contour d'abord, puis le remplissage par-dessus (une seule silhouette, sans traits internes)
    for (const [tag, a] of shapes) S(tag, { ...a, fill: '#e8b58f', stroke: '#6e4129', 'stroke-width': 2 }, s);
    for (const [tag, a] of shapes) S(tag, { ...a, fill: '#e8b58f' }, s);
    S('path', { d: 'M31 21.9 H45 M33 26.5 H45 M27 11.2 Q36 13.4 47 12.6 M55 11 Q60 13 63 12', stroke: '#a0674a', 'stroke-width': '.8', fill: 'none', 'stroke-linecap': 'round' }, s);
    S('rect', { x: 7.6, y: 11.3, width: 5.4, height: 4.6, rx: 2, fill: '#f6d6c2', stroke: '#c48f72', 'stroke-width': '.5' }, s); // ongle
    S('rect', { x: 26.4, y: 6.2, width: 4.6, height: 4, rx: 1.8, fill: '#f6d6c2', stroke: '#c48f72', 'stroke-width': '.5', transform: 'rotate(7 38 8.8)' }, s); // ongle du pouce
    S('rect', { x: 36, y: 7.5, width: 34, height: 21, rx: 8, fill: 'url(#hd-sheen)' }, s);
    const band = S('g', { class: 'lt-art-esd' }, s);
    S('rect', { x: 70, y: 9.4, width: 6.5, height: 17.2, rx: 2, fill: '#1f4f9c' }, band);
    S('circle', { cx: 73.25, cy: 18, r: 2, fill: 'url(#hd-alu)' }, band);
    S('rect', { x: 79, y: 6.5, width: 21, height: 23, rx: 2, fill: '#26364d' }, s); // manche
    S('rect', { x: 79, y: 6.5, width: 21, height: 23, rx: 2, fill: 'url(#hd-cyl-x)' }, s);
    S('path', { d: 'M83 7 V29', stroke: '#000000', 'stroke-opacity': '.35', 'stroke-width': '.8' }, s);
  } else if (id === 'wrist') {
    // bracelet élastique avec son bouton-pression, cordon spiralé, pince crocodile vers la terre
    S('ellipse', { cx: 13, cy: 16, rx: 8.5, ry: 12.5, fill: 'none', stroke: '#1f4f9c', 'stroke-width': 5 }, s);
    S('ellipse', { cx: 13, cy: 16, rx: 8.5, ry: 12.5, fill: 'none', stroke: '#5b8fe0', 'stroke-width': '.8', 'stroke-dasharray': '1 2' }, s); // tissage
    S('circle', { cx: 21.5, cy: 16, r: 3.4, fill: 'url(#hd-alu)', stroke: '#4b5257', 'stroke-width': '.6' }, s);
    S('rect', { x: 24, y: 15, width: 5, height: 2, fill: '#202426' }, s);
    for (let k = 0; k < 14; k++) {
      const cx = 30 + k * 3.5;
      S('ellipse', { cx, cy: 16, rx: 2.2, ry: 5.2, fill: 'none', stroke: '#202426', 'stroke-width': 1.5, transform: `rotate(14 ${cx} 16)` }, s);
      S('ellipse', { cx, cy: 16, rx: 2.2, ry: 5.2, fill: 'none', stroke: '#6b7276', 'stroke-width': '.45', 'stroke-dasharray': '3 30', transform: `rotate(14 ${cx} 16)` }, s);
    }
    S('rect', { x: 77, y: 15, width: 6, height: 2, fill: '#202426' }, s);
    S('path', { d: 'M82 12.4 H88 L90 13.6 V18.4 L88 19.6 H82 Z', fill: '#2e8a45' }, s); // gaine de la pince (vert = terre)
    S('path', { d: 'M82 12.4 H88 L90 13.6 V18.4 L88 19.6 H82 Z', fill: 'url(#hd-cyl-x)' }, s);
    S('path', { d: 'M89 13.4 L99 14.9 V15.7 H89 Z', fill: 'url(#hd-metal-x)' }, s); // mâchoires
    S('path', { d: 'M89 18.6 L99 17.1 V16.3 H89 Z', fill: 'url(#hd-metal-x)' }, s);
    S('path', { d: 'M90.5 15.7 l1 .6 l1 -.6 l1 .6 l1 -.6 l1 .6 l1 -.6 l1 .6 l1 -.6', stroke: '#4b5257', 'stroke-width': '.5', fill: 'none' }, s); // dents
  }
  return s;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
