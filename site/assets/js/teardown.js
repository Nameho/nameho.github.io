// « Démonter un PC portable » : les gestes d'un atelier de reconditionnement, dans l'ordre.
// Fidèle au Dell Latitude 14 5440 : ordre de démontage, prérequis, nombre et taille des vis, vis
// imperdables et couleurs des antennes tirés du manuel de maintenance Dell ; disposition relevée sur
// ses schémas et sur les photos de démontage de LaptopMedia. Recoupé avec un HP EliteBook 840 G10 et
// un Lenovo ThinkPad T14 Gen 4 pour les gestes communs (taille des vis marquée près des trous, SSD
// sous capot thermique, batterie débranchée en premier).

import { $, $$, svg as S, el, reducedMotion } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

/* =========================================================
   Données
   ========================================================= */
// 8 vis imperdables du capot : les 4 coins, le milieu de l'arrière, le milieu des côtés et le centre
const COVER_SCREWS = [[40, 40], [320, 34], [600, 40], [40, 212], [320, 212], [600, 212], [40, 384], [600, 384]];
// Déclipsage : d'abord une des 2 encoches en U près des charnières (prévues pour la pointe), puis côtés et avant
const CLIPS = [[132, 20], [508, 20], [20, 300], [620, 300], [200, 402], [440, 402]];
const NOTCHES = 2;

// `steps` : gestes à faire sur la pièce avant de pouvoir la sortir ; `why` : précision si on s'y prend trop tôt
const PARTS = {
  battery: { name: 'Batterie', the: 'la batterie', of: 'de la batterie', after: [] },
  ram1: { name: 'Barrette de RAM 1', the: 'la barrette 1', of: 'de la barrette 1', after: [], steps: ['Attaches écartées du bout des doigts ✔ La barrette s’éjecte et se relève à 30° : fais-la glisser hors de son logement, en la tenant par les bords.'] },
  ram2: { name: 'Barrette de RAM 2', the: 'la barrette 2', of: 'de la barrette 2', after: [], steps: ['Attaches écartées ✔ La barrette se relève : fais-la glisser hors de son logement.'] },
  ssd: { name: 'SSD NVMe M.2 2230', the: 'le SSD', of: 'du SSD', after: [], steps: ['Protection thermique glissée puis soulevée ✔ Dessous, le pad thermique rose transmet la chaleur du contrôleur : on le garde intact pour le remontage. Fais maintenant glisser le SSD hors de son logement.'] },
  wifi: { name: 'Carte Wi-Fi', the: 'la carte Wi-Fi', of: 'de la carte Wi-Fi', after: [] },
  fan: { name: 'Ventilateur', the: 'le ventilateur', of: 'du ventilateur', after: [] },
  heatsink: { name: 'Dissipateur (caloduc)', the: 'le dissipateur', of: 'du dissipateur', after: [] },
  cmos: { name: 'Pile CMOS (BIOS)', the: 'la pile CMOS', of: 'de la pile CMOS', after: [] },
  speakers: { name: 'Haut-parleurs', the: 'les haut-parleurs', of: 'des haut-parleurs', after: ['wifi'], why: ' Le câble d’antenne blanc passe dans les mêmes guides que le leur.' },
  frame: { name: 'Cadre interne', the: 'le cadre interne', of: 'du cadre interne', after: ['battery', 'wifi', 'ssd'], why: ' Il est sous la batterie, et ses guides tiennent des câbles.' },
  mb: { name: 'Carte mère', the: 'la carte mère', of: 'de la carte mère', after: ['battery', 'ram1', 'ram2', 'ssd', 'wifi', 'fan', 'heatsink', 'frame'], why: ' (C’est l’ordre du manuel de maintenance.)' },
  power: { name: 'Bouton d’alimentation', the: 'le bouton d’alimentation', of: 'du bouton d’alimentation', after: ['mb', 'speakers'], why: ' Il est vissé sous la carte mère.' },
  keyboard: { name: 'Clavier', the: 'le clavier', of: 'du clavier', after: ['mb', 'speakers'], why: ' Son support est vissé sous la carte mère.' },
};

// Bac magnétique : un compartiment par ligne de la liste des vis du manuel (nom, taille, quantité)
const TRAY = {
  ssd: ['SSD', 'M2×3', 2],
  fan: ['Ventilo', 'M2×5', 2],
  frame: ['Cadre', 'M2×3', 8],
  brk: ['Supports', 'M2×3', 3],
  usbc: ['USB-C', 'M2×5', 3],
  mb: ['Carte mère', 'M2×4', 3],
  power: ['Bouton', 'M2×2,5', 2],
  keyboard: ['Clavier', 'M2×2', 17],
};
const N_SCREWS = Object.values(TRAY).reduce((n, t) => n + t[2], 0);

const screws = (prefix, part, tray, pts) => pts.map(([x, y], k) => ({ id: `${prefix}${k + 1}`, kind: 'screw', part, tray, x, y }));

// Vis, connecteurs, nappes et adhésifs. `part` : pièce qui les porte (ils partent avec elle) ;
// `blocks` : pièces qu'on ne peut pas déposer tant qu'ils sont en place ; `needs` : à retirer avant ;
// `captive` : vis imperdable ; `pre` : autorisé avant de débrancher la batterie ; `cover` : support vissé
// posé dessus (il s'en va quand ses vis sont retirées). Une pièce placée avant ses vis dans la liste est
// dessinée sous elles (support d'abord, vis par-dessus).
const ITEMS = [
  // Batterie : câble plat tenu par un adhésif, puis 5 vis imperdables
  { id: 'bat-plug', kind: 'plug', wide: true, pre: true, part: 'battery', needs: ['bat-tape'], blocks: ['battery'], x: 446, y: 231, pull: [0, 9], label: 'le câble de la batterie', needsMsg: 'Le câble est maintenu à plat par un adhésif : décolle-le d’abord (main ou spudger).' },
  { id: 'bat-tape', kind: 'tape', pre: true, part: 'battery', blocks: ['battery'], x: 435, y: 237, w: 22, h: 10, label: 'l’adhésif du câble de la batterie' },
  ...[[60, 250], [352, 250], [498, 250], [150, 366], [463, 366]].map(([x, y], k) => ({ id: `bat-s${k + 1}`, kind: 'screw', captive: true, part: 'battery', x, y })),
  // SSD : 2 vis M2×3 sur sa protection thermique
  ...screws('ssd-s', 'ssd', 'ssd', [[578, 292], [607, 259]]),
  // Wi-Fi : vis imperdable du support, puis les antennes (chez Dell : blanc = MAIN, noir = AUX)
  { id: 'wifi-s', kind: 'screw', captive: true, part: 'wifi', x: 549, y: 152 },
  { id: 'ant-main', kind: 'ant', part: 'wifi', needs: ['wifi-s'], blocks: ['wifi'], x: 561, y: 164, color: '#eceee9', label: 'l’antenne MAIN (câble blanc)', needsMsg: 'Le petit support métallique de la carte Wi-Fi bloque les connecteurs d’antenne : desserre d’abord sa vis imperdable (tournevis).' },
  { id: 'ant-aux', kind: 'ant', part: 'wifi', needs: ['wifi-s'], blocks: ['wifi'], x: 573, y: 164, color: '#141516', label: 'l’antenne AUX (câble noir)', needsMsg: 'Le petit support métallique de la carte Wi-Fi bloque les connecteurs d’antenne : desserre d’abord sa vis imperdable (tournevis).' },
  // Ventilateur : son câble, puis 2 vis M2×5
  { id: 'fan-plug', kind: 'plug', part: 'fan', blocks: ['fan'], x: 196, y: 212, pull: [8, 0], label: 'le câble du ventilateur' },
  ...screws('fan-s', 'fan', 'fan', [[92, 78], [227, 113]]),
  // Dissipateur : antennes scotchées sur le caloduc, puis 4 vis imperdables desserrées 4 → 3 → 2 → 1
  { id: 'ant-tape', kind: 'tape', part: 'heatsink', blocks: ['heatsink'], x: 166, y: 40, w: 24, h: 13, label: 'les adhésifs des antennes, sur le caloduc' },
  { id: 'hs-1', kind: 'screw', captive: true, part: 'heatsink', x: 288, y: 134, n: 1 },
  { id: 'hs-2', kind: 'screw', captive: true, part: 'heatsink', x: 404, y: 72, n: 2 },
  { id: 'hs-3', kind: 'screw', captive: true, part: 'heatsink', x: 288, y: 70, n: 3 },
  { id: 'hs-4', kind: 'screw', captive: true, part: 'heatsink', x: 408, y: 138, n: 4 },
  // Pile CMOS (collée) et haut-parleurs : un câble chacun
  { id: 'cmos-plug', kind: 'plug', part: 'cmos', blocks: ['cmos'], x: 102, y: 229, pull: [8, 0], label: 'le câble de la pile CMOS' },
  { id: 'spk-plug', kind: 'plug', part: 'speakers', blocks: ['speakers', 'frame', 'mb'], x: 46, y: 222, pull: [0, 8], label: 'le câble des haut-parleurs' },
  // Cadre interne : 8 vis M2×3
  ...screws('fr-s', 'frame', 'frame', [[60, 252], [168, 264], [440, 262], [520, 252], [548, 300], [78, 366], [446, 354], [480, 368]]),
  // Carte mère : supports vissés (lecteur d'empreintes, nappe d'écran), câbles et nappes, support USB-C, 3 vis
  { id: 'fp-zif', kind: 'zif', part: 'mb', needs: ['fp-s'], blocks: ['mb'], x: 44, y: 55, w: 14, h: 8, dir: [0, 1], cover: { x: 38, y: 50, width: 38, height: 16 }, label: 'la nappe du lecteur d’empreintes', needsMsg: 'Un petit support vissé couvre ce connecteur : retire d’abord sa vis M2×3 (tournevis).' },
  { id: 'fp-s', kind: 'screw', part: 'mb', tray: 'brk', x: 70, y: 58 },
  { id: 'edp', kind: 'edp', part: 'mb', needs: ['edp-s1', 'edp-s2'], blocks: ['mb'], x: 450, y: 28, cover: { x: 432, y: 31, width: 64, height: 11 }, label: 'la nappe de l’écran', needsMsg: 'La nappe de l’écran est tenue par un support vissé : retire d’abord ses 2 vis M2×3 (tournevis).' },
  { id: 'edp-s1', kind: 'screw', part: 'mb', tray: 'brk', x: 440, y: 37 },
  { id: 'edp-s2', kind: 'screw', part: 'mb', tray: 'brk', x: 488, y: 37 },
  { id: 'ir-plug', kind: 'plug', part: 'mb', blocks: ['mb'], x: 532, y: 60, pull: [0, 8], label: 'le câble de la webcam' },
  { id: 'ush-zif', kind: 'zif', part: 'mb', blocks: ['mb'], x: 112, y: 214, w: 30, h: 9, dir: [0, 1], label: 'la nappe USH (empreintes, carte à puce)' },
  { id: 'tp-zif', kind: 'zif', part: 'mb', blocks: ['mb'], x: 150, y: 214, w: 26, h: 9, dir: [0, 1], label: 'la nappe du pavé tactile' },
  ...screws('usbc-s', 'mb', 'usbc', [[598, 132], [598, 162], [598, 192]]),
  ...screws('mb-s', 'mb', 'mb', [[26, 64], [508, 40], [598, 54]]),
  // Bouton d'alimentation (avec lecteur d'empreintes) : 2 vis M2×2,5, sous la carte mère
  ...screws('pw-s', 'power', 'power', [[29, 86], [81, 58]]),
  // Clavier : ses 2 nappes se branchent sur le module du pavé tactile, puis 17 vis M2×2 sur son support
  { id: 'kb-zif', kind: 'zif', part: 'keyboard', blocks: ['keyboard'], x: 236, y: 272, w: 26, h: 9, dir: [0, -1], len: 40, label: 'la nappe du clavier' },
  { id: 'kbl-zif', kind: 'zif', part: 'keyboard', blocks: ['keyboard'], x: 274, y: 272, w: 20, h: 9, dir: [0, -1], len: 40, label: 'la nappe du rétroéclairage' },
  ...screws('kb-s', 'keyboard', 'keyboard', [[138, 58], [230, 56], [330, 56], [440, 56], [560, 58], [52, 130], [150, 112], [300, 112], [450, 112], [588, 130], [110, 180], [240, 170], [380, 170], [520, 180], [52, 222], [320, 226], [588, 222]]),
];
const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
const needsOf = (it) => [].concat(it.needs ?? []);

// Ce qu'on retient en déposant chaque pièce
const TIPS = {
  battery: 'Batterie déposée ✔ Ses 5 vis sont imperdables : elles restent sur la batterie. Une batterie lithium gonflée ou percée ne se manipule pas : direction le bac de sécurité.',
  ram1: 'Barrette 1 déposée ✔ DDR4 SO-DIMM. On la tient par les bords, jamais par les contacts dorés : les demi-lunes sur ses côtés sont là où les attaches la retiennent.',
  ram2: 'Barrette 2 déposée ✔ Les deux barrettes voyagent dans un sachet antistatique. Avec deux barrettes identiques, le processeur travaille en double canal : plus rapide.',
  ssd: 'SSD déposé ✔ Format M.2 2230 : 22 mm de large, 30 mm de long, encoche « M » pour le NVMe. Il contient les données du client : on le traite avec soin.',
  wifi: 'Carte Wi-Fi déposée ✔ Elle était collée sur un tampon thermique. Au remontage, convention Dell : câble blanc sur MAIN (triangle blanc △), câble noir sur AUX (triangle noir ▲).',
  fan: 'Ventilateur déposé ✔ Sur ce modèle, il se retire seul (2 vis M2×5) : pratique pour le nettoyer ou le changer quand il fait du bruit. Sa mousse grise guide l’air vers les ailettes.',
  heatsink: 'Dissipateur déposé ✔ Ses 4 vis imperdables se desserrent dans l’ordre inverse (4 → 1) et se resserrent dans l’ordre (1 → 4), pour presser la puce bien à plat. Au remontage : nettoyage à l’alcool isopropylique et pâte thermique neuve.',
  cmos: 'Pile CMOS déposée ✔ Elle est collée : on la décolle doucement. Elle garde l’heure et les réglages du BIOS ; la retirer les remet à zéro, alors on note les réglages avant.',
  speakers: 'Haut-parleurs déposés ✔ Posés sur des silentblocs bleus contre les vibrations. On note le passage du câble dans ses guides pour le remontage.',
  frame: 'Cadre interne déposé ✔ 8 vis M2×3. Ce cadre en plastique rigidifie le repose-poignets et guide les câbles : à travers, on voyait le dos du pavé tactile et la carte USH.',
  mb: 'Carte mère déposée ✔ On soulève son côté gauche en l’inclinant, puis on la fait glisser pour sortir les ports (USB-C, Ethernet, HDMI…) de leurs ouvertures. Une vis oubliée et c’est la fissure.',
  power: 'Bouton d’alimentation déposé ✔ 2 vis M2×2,5. Il intègre le lecteur d’empreintes (en option) : d’où la nappe qu’on a débranchée sur la carte mère.',
  keyboard: 'Clavier déposé ✔ 17 vis M2×2 tiennent son support ; à l’établi, on le retourne et 4 vis de plus séparent le clavier du support.',
};

// Fiche de chaque pièce déposée : à quoi elle sert, ce qu'on vérifie en atelier, un détail à retenir
const RAM_INFO = {
  role: 'La mémoire vive : le processeur y range tout ce qu’il est en train d’utiliser (programmes ouverts, onglets…). Elle s’efface dès qu’on éteint.',
  shop: 'Écrans bleus, bips au démarrage ? On teste la mémoire (MemTest86), ou on essaie une barrette à la fois pour trouver la fautive.',
};
const INFO = {
  cover: {
    role: 'Il ferme le dessous du PC, le protège des chocs et de la poussière, et guide l’air : la grille, juste devant le ventilateur, est l’entrée d’air frais.',
    shop: 'On vérifie que ses clips ne sont pas cassés et que la grille n’est pas colmatée de poussière : un PC qui chauffe commence souvent par là.',
    fact: 'Ses 8 vis sont « imperdables » : une petite bague les retient dans le capot, impossible de les égarer.',
  },
  battery: {
    role: 'Elle stocke l’énergie : 54 Wh sous 11,4 V. Un circuit de protection intégré surveille la charge, la température et l’équilibre de ses cellules.',
    shop: 'On lit son usure (capacité restante, nombre de cycles) dans le BIOS ou avec un logiciel, et on vérifie qu’elle ne gonfle pas : gonflée, elle part au recyclage, jamais dans un PC.',
    fact: '11,4 V, ce sont 3 cellules lithium-ion de 3,8 V en série. Et 54 Wh, de quoi allumer une ampoule LED de 5 W pendant près de 11 heures.',
  },
  ram1: { ...RAM_INFO, fact: 'SO-DIMM, c’est le petit format des portables (69,6 mm de long). L’encoche des contacts n’est pas au même endroit en DDR4 et en DDR5 : impossible de se tromper de slot.' },
  ram2: { ...RAM_INFO, fact: 'Deux barrettes identiques travaillent en « double canal » : le processeur lit les deux à la fois, ce qui double presque le débit.' },
  ssd: {
    role: 'Le stockage : Windows, les logiciels et les fichiers du client. Sans pièce mobile, il est bien plus rapide et plus solide qu’un disque dur.',
    shop: 'On vérifie sa santé (données SMART : usure, erreurs). En reconditionnement, ses données sont effacées de façon sécurisée avant la revente.',
    fact: 'NVMe : il dialogue directement avec le processeur par le bus PCIe, d’où des débits de plusieurs milliers de Mo/s. 2230 = 22 mm de large, 30 mm de long.',
  },
  wifi: {
    role: 'La carte réseau sans fil (Wi-Fi 6E et Bluetooth). Ses deux câbles montent jusqu’aux antennes cachées dans le cadre de l’écran.',
    shop: 'Wi-Fi qui décroche ? On vérifie d’abord les antennes : un petit connecteur à moitié déclipsé suffit à couper le signal.',
    fact: 'Avec deux antennes (MAIN et AUX), la carte émet et reçoit sur deux voies à la fois (MIMO) : plus de débit et une meilleure portée.',
  },
  fan: {
    role: 'Il aspire l’air frais sous le PC et le souffle à travers les ailettes du dissipateur, vers l’arrière.',
    shop: 'PC bruyant ou brûlant : on dépoussière au pinceau et à l’air sec, en bloquant les pales. S’il frotte ou grince, on le remplace.',
    fact: 'On bloque les pales pendant le soufflage : à trop haute vitesse, on use ses paliers, et son moteur entraîné se met à produire du courant, comme une petite dynamo.',
  },
  heatsink: {
    role: 'Il évacue la chaleur du processeur : la plaque froide la capte, le caloduc la transporte jusqu’aux ailettes, et le ventilateur les refroidit.',
    shop: 'Pâte thermique sèche = processeur qui chauffe et ralentit. On nettoie à l’alcool isopropylique et on remet une fine couche de pâte neuve.',
    fact: 'Un caloduc est un tube creux contenant un peu de liquide : il s’évapore côté chaud, se condense côté froid et revient par capillarité. Aucune pièce mobile.',
  },
  cmos: {
    role: 'Une pile bouton CR2032 (3 V) qui garde l’heure et les réglages du BIOS quand le PC est éteint et sa batterie débranchée.',
    shop: 'Le PC perd l’heure ou ses réglages ? On mesure la pile au multimètre : vers 2,5 V, on la remplace.',
    fact: 'La débrancher quelques minutes remet le BIOS à zéro : une vieille astuce pour annuler un réglage qui empêche de démarrer.',
  },
  speakers: {
    role: 'Deux petits haut-parleurs dans des caissons fermés : l’air enfermé dans le caisson aide à rendre les sons graves.',
    shop: 'Son qui grésille ? On teste gauche et droite séparément (réglage de balance) pour trouver le coupable avant de le changer.',
    fact: 'Les silentblocs bleus en caoutchouc absorbent leurs vibrations : sans eux, tout le châssis résonnerait.',
  },
  frame: {
    role: 'Un cadre en plastique vissé au repose-poignets, sous la batterie : il rigidifie l’ensemble et guide les câbles (haut-parleurs, antennes).',
    shop: 'Avant de le retirer, on note le passage des câbles : un câble pincé au remontage peut couper le son ou le Wi-Fi.',
    fact: 'Dans le manuel Dell, c’est le « cadre interne de l’assemblage » : 8 vis M2×3, toutes identiques.',
  },
  mb: {
    role: 'Le cœur du PC : processeur, circuits d’alimentation, contrôleurs (USB, son, réseau) et tous les connecteurs. Sur ce modèle, les ports sont soudés directement dessus.',
    shop: 'C’est la pièce la plus chère. Avant de la condamner, on cherche les causes simples au multimètre et à la loupe : court-circuit, port arraché, oxydation. La micro-soudure permet souvent de réparer.',
    fact: 'Le processeur est soudé (boîtier BGA : des centaines de billes d’étain sous la puce). On ne le change pas comme sur un PC fixe.',
  },
  power: {
    role: 'Le bouton d’allumage, avec ici un lecteur d’empreintes pour se connecter sans mot de passe.',
    shop: 'Bouton qui ne répond plus : on vérifie sa nappe et son connecteur avant de changer la pièce.',
    fact: 'L’empreinte n’est pas gardée en photo : seul un modèle chiffré est stocké, dans une puce de sécurité (chez Dell, la carte USH).',
  },
  keyboard: {
    role: 'Le clavier et son rétroéclairage, une nappe pour chacun. Il est vissé sur un support métallique qui le rend rigide.',
    shop: 'Une touche morte vient parfois d’une nappe mal enfoncée : on la reclipse avant de changer le clavier. Après un liquide renversé, on démonte vite pour limiter l’oxydation.',
    fact: 'Les touches forment une grille de lignes et de colonnes : le clavier signale un croisement, que la puce de gestion du clavier, sur la carte mère, traduit en lettre.',
  },
};

// [id, nom, à quoi il sert]
const TOOLS = [
  ['hand', 'Main', 'connecteurs, nappes, adhésifs, pièces'],
  ['driver', 'Tournevis PH0', 'vis cruciformes'],
  ['spudger', 'Spudger', 'clips, loquets, antennes'],
];
const TOOL_HINTS = {
  hand: 'Main : débrancher un câble, tirer une nappe, décoller un adhésif, soulever une pièce.',
  driver: 'Tournevis cruciforme PH0 : clique sur une vis.',
  spudger: 'Spudger : déclipser le capot, soulever un loquet ou une antenne, décoller un adhésif.',
};
// Ordre du manuel : composants remplaçables par le client, puis par un technicien
const ORDER = ['battery', 'ram1', 'ram2', 'ssd', 'wifi', 'fan', 'heatsink', 'cmos', 'speakers', 'frame', 'mb', 'power', 'keyboard'];

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
  const scene = $('.lt-scene', root);
  const view = $('.lt-view', root);
  const zoomBtn = $('[data-lt-zoom]', root);
  const card = {
    root: $('.lt-card', root), pic: $('.lt-card-pic', root), kicker: $('.lt-card-kicker', root),
    title: $('.lt-card-title', root), intro: $('.lt-card-intro', root), facts: $('.lt-card-facts', root),
  };
  const stat = Object.fromEntries($$('[data-lt]', root).map((n) => [n.dataset.lt, n]));
  const N_PARTS = Object.keys(PARTS).length + 1; // + le capot

  let st;
  let refs;
  let hovered = null; // élément cliquable survolé (ou focalisé au clavier)
  let lit = null; // ce qui est entouré en vert ou en rouge
  let snaps = {}; // dessin de chaque pièce déposée, pour sa fiche
  let shown = null; // pièce dont la fiche est affichée
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
  zoomBtn.addEventListener('click', () => setZoom(!scene.classList.contains('is-zoomed')));
  if (stat.total) stat.total.textContent = String(N_PARTS);

  // Loupe : on fait glisser la vue à la souris (au doigt, le défilement natif suffit) ;
  // un glisser ne compte pas comme un clic sur la pièce en dessous
  let pan = null;
  let swallowClick = false;
  view.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (!scene.classList.contains('is-zoomed') || e.pointerType !== 'mouse' || e.button !== 0) return;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, left: view.scrollLeft, top: view.scrollTop, moved: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 6) return;
    if (!pan.moved) { pan.moved = true; view.classList.add('is-panning'); view.setPointerCapture(pan.id); light(null); }
    view.scrollLeft = pan.left - dx;
    view.scrollTop = pan.top - dy;
  });
  const endPan = () => {
    if (pan?.moved) swallowClick = true;
    pan = null;
    view.classList.remove('is-panning');
  };
  view.addEventListener('pointerup', endPan);
  view.addEventListener('pointercancel', endPan);
  view.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

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
      cover: { screws: COVER_SCREWS.map(() => false), clips: CLIPS.map(() => false), off: false },
      items: Object.fromEntries(ITEMS.map((it) => [it.id, it.kind === 'zif' ? 'locked' : 'in'])),
      steps: Object.fromEntries(Object.keys(PARTS).map((k) => [k, 0])),
      removed: new Set(),
      tray: Object.fromEntries(Object.keys(TRAY).map((k) => [k, 0])),
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
    snaps = {};
    shown = null;
    card.kicker.textContent = 'Fiche pièce';
    card.title.textContent = 'Chaque pièce a son rôle';
    card.intro.hidden = false;
    card.facts.hidden = true;
    card.pic.replaceChildren();
    drawTop();
    drawBottom();
    pickTool('hand', { quiet: true });
    renderSide();
    say('Un PC portable arrive à l’atelier (même intérieur qu’un Dell Latitude 14 5440). Avant tout : on coupe l’alimentation et on se protège de l’électricité statique.');
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
    // voyant de charge (blanc : en charge) sur le flanc gauche, à côté des USB-C
    refs.chargeLed = S('circle', { cx: 19.5, cy: 196, r: 3, class: 'lt-led is-on' }, top);
    // la charge passe par un des 2 USB-C du flanc gauche, derrière l'Ethernet et l'USB-A
    refs.plugTop = charger(top, 16, 140, -1);
  }

  /** Fiche USB-C du chargeur sur le flanc (side = -1 : à gauche, 1 : à droite). */
  function charger(face, x, y, side) {
    const g = S('g', { class: `lt-charger ${side < 0 ? 'lt-charger-l' : 'lt-charger-r'}` }, face);
    S('path', { d: `M${x + side * 22} ${y} C${x + side * 42} ${y}, ${x + side * 46} ${y + 40}, ${x + side * 40} ${y + 110}`, class: 'lt-cable' }, g);
    S('rect', { x: side < 0 ? x - 24 : x + 4, y: y - 8, width: 20, height: 16, rx: 4, fill: 'url(#hd-plastic)' }, g);
    S('rect', { x: side < 0 ? x - 6 : x, y: y - 3, width: 6, height: 6, rx: 2, fill: 'url(#hd-metal-x)' }, g);
    S('rect', {
      x: side < 0 ? x - 30 : x - 2, y: y - 18, width: 34, height: 36, rx: 8, class: 'lt-hit', tabindex: 0, role: 'button',
      'data-lt': 'charger', 'aria-label': 'Fiche USB-C du chargeur, branchée sur le flanc gauche du PC',
    }, g);
    return g;
  }

  /* =========================================================
     Dessin : PC retourné, vu de dessous (gauche de l'image = côté droit du PC)
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
    grad(defs, 'lt-pcb', [['0', '#2f7d4c'], ['1', '#1f5a36']]);
    const perf = S('pattern', { id: 'lt-perf', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
    S('circle', { cx: 4.5, cy: 4.5, r: 1.6, fill: '#2a2f33' }, perf);

    // ---- Repose-poignets vu de dessous : ce qui reste à la fin (pavé tactile, carte USH), charnières
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#lt-shell)', stroke: '#0f1112', 'stroke-width': 2 }, v);
    S('rect', { x: 34, y: 46, width: 572, height: 192, rx: 6, fill: '#1d2124' }, v); // logement du clavier
    S('path', { d: 'M40 242 H600 M206 250 V396 M434 250 V396', stroke: '#000000', 'stroke-opacity': '.18', 'stroke-width': 3 }, v);
    S('rect', { x: 184, y: 266, width: 232, height: 86, rx: 4, fill: '#8d9396' }, v); // dos du pavé tactile (film gris)
    S('rect', { x: 184, y: 266, width: 232, height: 86, rx: 4, fill: 'url(#hd-sheen)' }, v);
    S('rect', { x: 206, y: 290, width: 110, height: 34, rx: 2, fill: 'url(#lt-pcb)' }, v); // sa carte
    S('text', { x: 361, y: 342, class: 'lt-label', 'text-anchor': 'middle' }, v).textContent = 'TOUCHPAD';
    S('rect', { x: 72, y: 262, width: 74, height: 62, rx: 3, fill: 'url(#lt-pcb)' }, v); // carte USH (sécurité)
    S('text', { x: 109, y: 298, class: 'lt-silk', 'text-anchor': 'middle' }, v).textContent = 'USH';
    hinge(v, -1);
    hinge(v, 1);

    // ---- Support du clavier (plaque perforée, sous la carte mère)
    const kb = part('keyboard', 'Support du clavier', { x: 34, y: 46, width: 572, height: 192 });
    S('rect', { x: 34, y: 46, width: 572, height: 192, rx: 6, fill: 'url(#lt-plate)' }, kb.art);
    S('rect', { x: 42, y: 54, width: 556, height: 176, rx: 4, fill: 'url(#lt-perf)' }, kb.art);

    // ---- Bouton d'alimentation avec lecteur d'empreintes (coin arrière, sous la carte mère)
    const pw = part('power', 'Bouton d’alimentation', { x: 20, y: 50, width: 70, height: 48 });
    S('rect', { x: 22, y: 52, width: 66, height: 44, rx: 4, fill: 'url(#lt-mb)', stroke: '#0f2b4d' }, pw.art);
    S('rect', { x: 42, y: 61, width: 26, height: 26, rx: 4, fill: '#15181a', stroke: '#9aa1a5', 'stroke-width': 2 }, pw.art); // capteur
    S('path', { d: 'M66 58 C70 54, 72 50, 72 46', stroke: '#c98a3a', 'stroke-width': 5, fill: 'none' }, pw.art); // sa nappe

    // ---- Cadre interne (plastique noir, sous la batterie), ajouré sur le pavé tactile et la carte USH
    const fr = part('frame', 'Cadre interne', { x: 48, y: 240, width: 508, height: 140 });
    S('path', {
      d: 'M54 240 H550 Q556 240 556 246 V374 Q556 380 550 380 H54 Q48 380 48 374 V246 Q48 240 54 240 Z M184 266 V352 H416 V266 Z M70 260 V326 H148 V260 Z',
      fill: '#17191b', 'fill-rule': 'evenodd', stroke: '#2c3134',
    }, fr.art);
    S('path', { d: 'M58 246 H546 M166 270 V372 M434 270 V372', stroke: '#2a2f33', 'stroke-width': 2, fill: 'none' }, fr.art);

    // ---- Carte mère : elle contourne le ventilateur (bande des ports à gauche, bande des connecteurs en bas)
    const mb = part('mb', 'Carte mère', [{ x: 18, y: 50, width: 58, height: 186 }, { x: 76, y: 200, width: 146, height: 36 }, { x: 222, y: 22, width: 392, height: 214 }]);
    const board = 'M18 56 Q18 50 24 50 H70 Q76 50 76 56 V194 Q76 200 82 200 H216 Q222 200 222 194 V28 Q222 22 228 22 H514 Q520 22 520 28 V42 Q520 48 526 48 H608 Q614 48 614 54 V230 Q614 236 608 236 H24 Q18 236 18 230 Z';
    S('path', { d: board, fill: 'url(#lt-mb)', stroke: '#0f2b4d' }, mb.art);
    S('path', { d: board, fill: 'url(#hd-weave)', 'pointer-events': 'none' }, mb.art);
    smd(mb.art, [[240, 120], [252, 130], [240, 140], [420, 140], [520, 120], [96, 210], [206, 226], [470, 226], [540, 64], [560, 100]]);
    // processeur (visible une fois le dissipateur retiré), blindage noir au-dessus
    S('rect', { x: 306, y: 88, width: 80, height: 40, rx: 2, fill: '#1f6b3f' }, mb.art);
    S('rect', { x: 320, y: 96, width: 46, height: 24, rx: 1.5, fill: 'url(#hd-metal-x)' }, mb.art);
    S('rect', { x: 324, y: 99, width: 38, height: 18, rx: 4, fill: '#9aa0a3', opacity: '.7' }, mb.art); // reste de pâte thermique
    S('rect', { x: 288, y: 26, width: 116, height: 38, rx: 2, fill: '#1b1e20', stroke: '#b07d4a' }, mb.art);
    for (const cx of [310, 328]) S('circle', { cx, cy: 36, r: 4, fill: 'none', stroke: '#d9a441', 'stroke-width': 2 }, mb.art);
    S('rect', { x: 356, y: 32, width: 24, height: 10, fill: '#e9ebe6' }, mb.art);
    // emplacement 4G (WWAN) vide, sous son film noir
    S('rect', { x: 430, y: 76, width: 18, height: 56, rx: 2, fill: '#e6e7e2' }, mb.art);
    S('rect', { x: 434, y: 80, width: 10, height: 48, fill: '#111314' }, mb.art);
    S('rect', { x: 452, y: 70, width: 84, height: 66, rx: 3, fill: '#111314' }, mb.art);
    S('text', { x: 494, y: 84, class: 'lt-label lt-label-light', 'text-anchor': 'middle' }, mb.art).textContent = '4G WWAN';
    [[476, 104, '5'], [510, 104, '6'], [476, 124, '7'], [510, 124, '8']].forEach(([cx, cy, t]) => {
      S('circle', { cx, cy, r: 5, fill: 'none', stroke: '#d9dcd8', 'stroke-width': '.8' }, mb.art);
      S('text', { x: cx + 9, y: cy + 3, class: 'lt-label lt-label-light' }, mb.art).textContent = t;
    });
    // connecteurs et logements soudés
    S('rect', { x: 446, y: 26, width: 36, height: 12, rx: 1.5, fill: '#111314' }, mb.art); // embase de la nappe d'écran
    S('rect', { x: 524, y: 55, width: 16, height: 9, rx: 1, fill: '#111314' }, mb.art); // embase webcam
    S('rect', { x: 430, y: 225, width: 32, height: 10, rx: 1.5, fill: '#2a2e31' }, mb.art); // embase de la batterie
    S('rect', { x: 560, y: 228, width: 36, height: 8, rx: 1, fill: '#111314' }, mb.art); // logement M.2 du SSD
    S('rect', { x: 540, y: 212, width: 40, height: 8, rx: 1, fill: '#111314' }, mb.art); // logement M.2 du Wi-Fi
    S('rect', { x: 532, y: 150, width: 5, height: 64, rx: 2, fill: '#2f6fd1' }, mb.art); // guide-câble bleu
    for (const x of [232, 376]) S('rect', { x, y: 148, width: 140, height: 64, rx: 2, fill: '#111314' }, mb.art); // slots SO-DIMM
    // ports : flanc gauche de l'image = côté droit du PC (HDMI, USB-A, prise casque) ;
    // flanc droit = côté gauche du PC (Ethernet, USB-A, 2 USB-C dont la charge sous leur support vissé)
    port(mb.art, 18, 76, 22, 32, 'hdmi');
    port(mb.art, 18, 112, 26, 30, 'usba');
    port(mb.art, 18, 148, 24, 14, 'jack');
    port(mb.art, 588, 62, 26, 28, 'rj45');
    port(mb.art, 586, 94, 28, 26, 'usba-gold');
    S('rect', { x: 584, y: 124, width: 26, height: 76, rx: 3, fill: 'url(#hd-metal-y)', stroke: '#6b7276', 'stroke-width': '.8' }, mb.art); // support USB-C
    port(mb.art, 604, 134, 10, 18, 'usbc');
    port(mb.art, 604, 168, 10, 18, 'usbc');
    for (const [x, y, t] of [[236, 145, 'DIMM A'], [440, 145, 'DIMM B'], [378, 233, 'BATTERY'], [520, 233, 'SSD'], [112, 211, 'USH'], [150, 211, 'TP'], [178, 233, 'FAN'], [562, 80, 'LAN'], [44, 96, 'HDMI'], [592, 212, '⚡']]) {
      S('text', { x, y, class: 'lt-silk' }, mb.art).textContent = t;
    }

    // ---- Pile CMOS (collée sur la bande des ports), câble rouge et noir vers son connecteur
    const cmos = part('cmos', 'Pile CMOS', { x: 28, y: 162, width: 46, height: 44 });
    S('circle', { cx: 50, cy: 184, r: 19, fill: '#15181a', stroke: '#2b3033' }, cmos.art);
    S('circle', { cx: 50, cy: 184, r: 19, fill: 'url(#hd-sheen)' }, cmos.art);
    S('text', { x: 50, y: 187, class: 'lt-label lt-label-light', 'text-anchor': 'middle' }, cmos.art).textContent = 'CR2032';
    S('path', { d: 'M64 196 C76 206, 84 222, 94 227', stroke: '#c8231b', 'stroke-width': 1.6, fill: 'none' }, cmos.art);
    S('path', { d: 'M62 199 C74 210, 82 226, 94 231', stroke: '#1a1c1d', 'stroke-width': 1.6, fill: 'none' }, cmos.art);

    // ---- Haut-parleurs : à gauche en L (le long du bord, sortie à l'avant), à droite un caisson sous le SSD
    const spk = part('speakers', 'Haut-parleurs', [{ x: 18, y: 252, width: 32, height: 148 }, { x: 18, y: 368, width: 108, height: 32 }, { x: 512, y: 370, width: 98, height: 30 }, { x: 552, y: 304, width: 58, height: 70 }]);
    for (const d of [
      'M28 256 H42 Q48 256 48 262 V370 H116 Q122 370 122 376 V390 Q122 396 116 396 H28 Q20 396 20 388 V264 Q20 256 28 256 Z',
      'M562 308 H600 Q606 308 606 314 V390 Q606 396 600 396 H522 Q516 396 516 390 V380 Q516 374 522 374 H556 V314 Q556 308 562 308 Z',
    ]) S('path', { d, fill: '#141618', stroke: '#2c3134' }, spk.art);
    S('rect', { x: 52, y: 380, width: 60, height: 6, rx: 3, fill: '#050607' }, spk.art); // sorties du son
    S('rect', { x: 526, y: 382, width: 66, height: 6, rx: 3, fill: '#050607' }, spk.art);
    S('rect', { x: 25, y: 292, width: 17, height: 44, rx: 1, fill: '#e8e9e4' }, spk.art); // étiquette
    for (const [cx, cy] of [[28, 264], [114, 388], [524, 388], [598, 316]]) S('circle', { cx, cy, r: 3.4, fill: '#2f6fd1' }, spk.art); // silentblocs
    S('path', { d: 'M34 256 C34 248, 44 240, 46 230 M580 308 C580 280, 566 241, 540 241 H64 C54 241, 48 238, 46 232', class: 'lt-wire-pair' }, spk.art);

    // ---- Barrettes de RAM (SO-DIMM DDR4) couchées, vues de dos : deux attaches latérales les retiennent
    [['ram1', 232], ['ram2', 376]].forEach(([id, x], k) => {
      const ram = part(id, `Barrette de RAM ${k + 1}`, { x: x - 4, y: 146, width: 148, height: 68 });
      ram.module = S('g', { class: 'lt-ram-mod' }, ram.art);
      S('path', { d: `M${x + 4} 152 H${x + 136} V176 a5 5 0 0 0 0 10 V208 H${x + 4} V186 a5 5 0 0 0 0 -10 Z`, fill: 'url(#lt-ram)' }, ram.module);
      S('path', { d: `M${x + 14} 160 h34 v10 h26 M${x + 80} 158 v18 h40 M${x + 18} 192 h56 v6 h40`, stroke: '#9be3ae', 'stroke-opacity': '.35', 'stroke-width': 1, fill: 'none' }, ram.module);
      smd(ram.module, [[x + 24, 196], [x + 36, 196], [x + 100, 196], [x + 112, 196], [x + 64, 161]]);
      S('text', { x: x + 70, y: 176, class: 'lt-label lt-label-light', 'text-anchor': 'middle' }, ram.module).textContent = 'DDR4-3200 · 8 Go';
      S('path', { d: `M${x + 8} 205 H${x + 80} M${x + 86} 205 H${x + 132}`, stroke: '#d9a441', 'stroke-width': 5 }, ram.module);
      ram.clips = [
        S('rect', { x: x - 2, y: 174, width: 7, height: 14, rx: 1.5, class: 'lt-ram-clip', fill: 'url(#hd-metal-y)' }, ram.art),
        S('rect', { x: x + 135, y: 174, width: 7, height: 14, rx: 1.5, class: 'lt-ram-clip lt-ram-clip-r', fill: 'url(#hd-metal-y)' }, ram.art),
      ];
    });

    // ---- Ventilateur : posé sur le châssis, dans l'échancrure de la carte mère ; joint en mousse,
    //      sortie d'air vers les ailettes (en haut), 2 vis M2×5, câble en bas à droite
    const fan = part('fan', 'Ventilateur', [{ x: 72, y: 44, width: 154, height: 160 }, { x: 214, y: 102, width: 24, height: 24 }]);
    S('rect', { x: 214, y: 105, width: 20, height: 16, rx: 4, fill: '#1c2023' }, fan.art); // patte de vis
    const housing = 'M90 60 H140 V46 H216 V60 Q222 60 222 66 V192 Q222 200 214 200 H84 Q76 200 76 192 V74 Z';
    S('path', { d: housing, fill: 'url(#lt-black)', stroke: '#626664', 'stroke-width': 6, 'stroke-linejoin': 'round' }, fan.art);
    S('path', { d: housing, fill: 'none', stroke: '#8a8e8b', 'stroke-width': 3, 'stroke-dasharray': '0.8 1.8', 'stroke-linejoin': 'round' }, fan.art);
    S('circle', { cx: 148, cy: 132, r: 56, fill: '#0d0f10', stroke: '#2a2f33', 'stroke-width': 2 }, fan.art);
    const blades = S('g', { stroke: '#5c6468', 'stroke-width': 1.3, fill: 'none' }, fan.art);
    for (let k = 0; k < 44; k++) S('path', { d: 'M148 102 C154 94, 158 86, 155 78', transform: `rotate(${(k * 8.18).toFixed(1)} 148 132)` }, blades);
    S('circle', { cx: 148, cy: 132, r: 28, fill: '#2a2f33' }, fan.art); // moyeu
    S('circle', { cx: 148, cy: 132, r: 28, fill: 'url(#hd-sheen)' }, fan.art);
    S('path', { d: 'M212 194 C214 204, 208 210, 202 212', class: 'lt-wire-pair' }, fan.art);

    // ---- Dissipateur : un seul caloduc (aplati, noir) de la plaque froide jusqu'au-dessus du ventilateur,
    //      bloc d'ailettes contre la sortie d'air, plaque froide tenue par 2 barres-ressorts (vis 1 à 4)
    const hs = part('heatsink', 'Dissipateur', [{ x: 136, y: 14, width: 130, height: 30 }, { x: 88, y: 44, width: 214, height: 20 }, { x: 278, y: 60, width: 140, height: 86 }]);
    S('rect', { x: 140, y: 18, width: 122, height: 22, rx: 2, fill: '#1a1d1f' }, hs.art);
    for (let k = 0; k < 24; k++) S('rect', { x: 143 + k * 5, y: 20, width: 2, height: 18, fill: '#3a4044' }, hs.art);
    S('rect', { x: 294, y: 84, width: 104, height: 48, rx: 4, fill: 'url(#lt-black)' }, hs.art);
    S('text', { x: 304, y: 123, class: 'lt-label lt-label-light' }, hs.art).textContent = 'AT · COOL';
    S('path', { d: 'M372 124 l6 -10 l6 10 z', fill: 'none', stroke: '#d9dcd8', 'stroke-width': 1 }, hs.art); // surface chaude
    for (const d of ['M288 70 L302 78 H392 L404 72', 'M288 134 L302 128 H394 L408 138']) {
      S('path', { d, stroke: '#1a1d1f', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, hs.art);
    }
    S('path', { d: 'M394 106 H302 C274 106, 264 54, 238 54 H96', stroke: '#121416', 'stroke-width': 12, fill: 'none', 'stroke-linecap': 'round' }, hs.art);
    S('path', { d: 'M392 102 H302 C276 102, 266 50, 238 50 H98', stroke: '#454c50', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, hs.art);
    S('rect', { x: 330, y: 101, width: 18, height: 10, fill: '#0b0c0d' }, hs.art); // morceau d'adhésif noir

    // ---- Carte Wi-Fi M.2 2230, verticale : petit support vissé en haut, logement M.2 en bas
    const wifi = part('wifi', 'Carte Wi-Fi', { x: 536, y: 140, width: 50, height: 82 });
    S('rect', { x: 540, y: 150, width: 40, height: 62, rx: 2, fill: '#1b3f66' }, wifi.art);
    S('rect', { x: 542, y: 172, width: 36, height: 36, rx: 1.5, fill: '#f1f2ee' }, wifi.art);
    S('text', { x: 560, y: 182, class: 'lt-label', 'text-anchor': 'middle' }, wifi.art).textContent = 'Wi-Fi 6E';
    for (const qx of [546, 562]) S('rect', { x: qx, y: 188, width: 11, height: 11, fill: 'none', stroke: '#3a3e3c', 'stroke-width': 1.2, 'stroke-dasharray': '1.5 1' }, wifi.art);
    S('rect', { x: 541, y: 208, width: 38, height: 5, fill: '#d9a441' }, wifi.art);
    S('path', { d: 'M553 170 l2.6 -4.5 l2.6 4.5 z', fill: '#f1f2ee' }, wifi.art); // MAIN : triangle blanc
    S('path', { d: 'M577 170 l2.6 -4.5 l2.6 4.5 z', fill: '#111314', stroke: '#f1f2ee', 'stroke-width': '.6' }, wifi.art); // AUX : triangle noir
    wifi.bracket = S('rect', { x: 538, y: 145, width: 44, height: 13, rx: 2, class: 'lt-bracket' }, wifi.art);

    // ---- SSD NVMe M.2 2230 sous sa protection thermique (2 vis M2×3), à droite de la batterie
    const ssd = part('ssd', 'SSD NVMe', { x: 550, y: 230, width: 64, height: 74 });
    S('rect', { x: 558, y: 236, width: 42, height: 58, rx: 2, fill: '#1e5a37' }, ssd.art);
    S('rect', { x: 559, y: 233, width: 40, height: 5, fill: '#d9a441' }, ssd.art);
    S('rect', { x: 586, y: 233, width: 2, height: 5, fill: '#1e5a37' }, ssd.art); // encoche « M »
    S('rect', { x: 562, y: 244, width: 34, height: 22, rx: 1, fill: '#f1f2ee' }, ssd.art);
    S('text', { x: 579, y: 258, class: 'lt-label', 'text-anchor': 'middle' }, ssd.art).textContent = 'NVMe';
    S('rect', { x: 566, y: 272, width: 18, height: 12, rx: 1, fill: '#25292c' }, ssd.art); // contrôleur
    S('rect', { x: 567, y: 273, width: 16, height: 10, rx: 1.5, fill: '#f0b8cf', opacity: '.92' }, ssd.art); // pad thermique
    S('path', { d: 'M573 294 a5 5 0 0 0 10 0 Z', fill: '#d9a441' }, ssd.art);
    ssd.plate = S('g', { class: 'lt-ssd-plate' }, ssd.art);
    S('path', { d: 'M562 240 H598 Q602 240 602 244 V252 H613 V266 H602 V296 Q602 300 598 300 H558 Q554 300 554 296 V248 Z', fill: '#1a1d1f', stroke: '#3c4246' }, ssd.plate);
    S('rect', { x: 562, y: 250, width: 30, height: 16, fill: '#e9ebe6' }, ssd.plate);
    S('text', { x: 577, y: 261, class: 'lt-label', 'text-anchor': 'middle' }, ssd.plate).textContent = 'SSD';

    // ---- Batterie 54 Wh : quasiment toute la largeur, 5 pattes à vis imperdable, câble plat en haut
    const bat = part('battery', 'Batterie', { x: 46, y: 240, width: 512, height: 134 });
    for (const [x, y] of [[60, 250], [352, 250], [498, 250], [150, 366], [463, 366]]) S('rect', { x: x - 10, y: y - 8, width: 20, height: 16, rx: 4, fill: '#1c1f21', stroke: '#0b0c0d' }, bat.art);
    S('rect', { x: 49, y: 245, width: 505, height: 124, rx: 6, fill: 'url(#lt-cell)', stroke: '#0b0c0d' }, bat.art);
    S('rect', { x: 76, y: 262, width: 456, height: 96, rx: 3, fill: '#0b0c0d' }, bat.art);
    S('rect', { x: 84, y: 270, width: 64, height: 80, rx: 2, fill: '#e9ebe6' }, bat.art);
    S('text', { x: 116, y: 300, class: 'lt-bat-txt', 'text-anchor': 'middle' }, bat.art).textContent = '54 Wh';
    S('text', { x: 116, y: 316, class: 'lt-label', 'text-anchor': 'middle' }, bat.art).textContent = 'Li-ion 11,4 V';
    [
      'Débrancher la batterie avant toute intervention.',
      'Ne pas percer, ne pas chauffer, ne pas plier.',
      'Recyclage obligatoire · bac à piles et batteries.',
    ].forEach((t, k) => { S('text', { x: 162, y: 284 + k * 12, class: 'lt-label lt-label-light' }, bat.art).textContent = t; });
    S('rect', { x: 49, y: 245, width: 505, height: 124, rx: 6, fill: 'url(#hd-sheen)' }, bat.art);
    S('rect', { x: 439, y: 238, width: 14, height: 9, fill: '#8a5a2b' }, bat.art); // départ du câble plat

    // ---- Vis, connecteurs, nappes et adhésifs de l'intérieur
    for (const it of ITEMS) drawItem(it);

    // ---- Câbles qui restent dans le châssis (ils vont à l'écran) : nappe d'écran, webcam, antennes
    refs.cables = S('g', { class: 'lt-cables' }, v);
    S('path', { d: 'M464 22 V17', stroke: '#2b3a52', 'stroke-width': 14 }, refs.cables);
    S('path', { d: 'M532 54 C532 40, 548 30, 568 22', stroke: '#1a1c1d', 'stroke-width': 2, fill: 'none' }, refs.cables);
    refs.ants = S('g', { class: 'lt-ants' }, refs.cables);
    S('path', { d: 'M561 156 C561 120, 520 100, 470 100 H306 C278 100, 268 48, 240 48 H112 C102 48, 100 36, 100 18', stroke: '#eceee9', 'stroke-width': 2.4, fill: 'none' }, refs.ants);
    S('path', { d: 'M573 156 C573 114, 522 94, 470 94 H306 C276 94, 266 43, 240 43 H118 C108 43, 106 32, 106 18', stroke: '#141516', 'stroke-width': 2.4, fill: 'none' }, refs.ants);
    for (const [x, y] of [[214, 44], [340, 95], [498, 97]]) S('rect', { x: x - 7, y: y - 5, width: 14, height: 10, class: 'lt-ant-tape' }, refs.ants); // adhésifs bruns

    // ---- Capot inférieur (par-dessus tout)
    drawCover();
    refs.plugBottom = charger(bottom, 624, 140, 1); // retourné : la prise passe à droite, face aux USB-C
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
      if (it.captive && !it.n) S('circle', { cx: it.x, cy: it.y, r: 9, class: 'lt-captive-mark' }, g); // pictogramme « imperdable »
      r.head = screwHead(g, it.x, it.y, 6.2);
      // marquages imprimés à côté du trou (hors du groupe de la vis : le contour de survol n'entoure que la vis)
      if (it.n) S('text', { x: it.x + 9, y: it.y - 7, class: 'lt-num' }, host).textContent = String(it.n);
      if (!it.captive) {
        const right = it.x > 560;
        S('text', { x: right ? it.x - 9 : it.x + 9, y: it.y + 12, class: 'lt-size', 'text-anchor': right ? 'end' : 'start' }, host).textContent = `▲${TRAY[it.tray][1]}`;
      }
      r.hit = hit(g, `item:${it.id}`, { cx: it.x, cy: it.y, r: 11 }, `Vis${it.n ? ` n° ${it.n}` : ''} ${PARTS[it.part].of}${it.captive ? ' (imperdable)' : ` (${TRAY[it.tray][1]})`}`);
    } else if (it.kind === 'plug') {
      const w = it.wide ? 30 : 16;
      if (!it.wide) S('rect', { x: it.x - w / 2 - 1, y: it.y - 5, width: w + 2, height: 10, rx: 1.5, fill: '#cfd2cc' }, g); // embase
      r.plug = S('g', {}, g);
      if (it.wide) {
        // câble plat de la batterie et son connecteur
        S('rect', { x: it.x - 7, y: it.y + 4, width: 14, height: 12, fill: '#8a5a2b' }, r.plug);
        S('rect', { x: it.x - w / 2, y: it.y - 5, width: w, height: 10, rx: 1.5, fill: '#e7dcc4', stroke: '#9a8f78', 'stroke-width': '.6' }, r.plug);
      } else {
        S('rect', { x: it.x - w / 2, y: it.y - 4, width: w, height: 9, rx: 1.5, fill: '#f2f3ef', stroke: '#9aa09c', 'stroke-width': '.6' }, r.plug);
        S('path', { d: `M${it.x - 4} ${it.y + 4} v6 M${it.x} ${it.y + 4} v6 M${it.x + 4} ${it.y + 4} v6`, stroke: '#1a1c1d', 'stroke-width': 1.6 }, r.plug);
      }
      r.hit = hit(g, `item:${it.id}`, { x: it.x - w / 2 - 6, y: it.y - 10, width: w + 12, height: 24, rx: 4 }, `Débrancher ${it.label}`);
    } else if (it.kind === 'tape') {
      S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 1, class: 'lt-tape' }, g);
      r.hit = hit(g, `item:${it.id}`, { x: it.x - 6, y: it.y - 6, width: it.w + 12, height: it.h + 12, rx: 4 }, `Décoller ${it.label}`);
    } else if (it.kind === 'ant') {
      r.plug = S('g', {}, g);
      S('path', { d: `M${it.x} ${it.y} V${it.y - 8}`, stroke: it.color, 'stroke-width': 2.4 }, r.plug);
      S('circle', { cx: it.x, cy: it.y, r: 4, fill: 'url(#hd-gold)', stroke: '#6f5420', 'stroke-width': '.6' }, r.plug);
      r.hit = hit(g, `item:${it.id}`, { cx: it.x, cy: it.y, r: 8 }, `Déconnecter ${it.label}`);
    } else if (it.kind === 'zif') {
      const [dx, dy] = it.dir;
      const L = it.len ?? 30;
      // nappe (avec sa languette bleue côté connecteur) qui entre dans le connecteur ; on la tire dans le sens `dir`
      const rib = dx
        ? { x: dx < 0 ? it.x - L + 4 : it.x + it.w - 4, y: it.y + 2, width: L, height: it.h - 4 }
        : { x: it.x + 3, y: dy > 0 ? it.y + it.h - 4 : it.y - L + 4, width: it.w - 6, height: L };
      const tab = dx
        ? { x: dx < 0 ? it.x - 10 : it.x + it.w + 2, y: rib.y, width: 8, height: rib.height }
        : { x: rib.x, y: dy > 0 ? it.y + it.h + 2 : it.y - 10, width: rib.width, height: 8 };
      r.ribbon = S('g', {}, g);
      S('rect', { ...rib, fill: '#d8973e', opacity: '.95' }, r.ribbon);
      S('rect', { ...tab, fill: '#2f6fd1' }, r.ribbon);
      S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 1.5, fill: '#111314' }, g);
      // loquet : du côté opposé à la nappe ; il pivote en s'écartant
      r.latch = S('rect', dx
        ? { x: dx < 0 ? it.x + it.w - 3 : it.x - 2, y: it.y - 1, width: 5, height: it.h + 2, rx: 1 }
        : { x: it.x - 1, y: dy > 0 ? it.y - 2 : it.y + it.h - 3, width: it.w + 2, height: 5, rx: 1 }, g);
      r.latch.setAttribute('class', 'lt-latch');
      r.hit = hit(g, `item:${it.id}`, { x: it.x - 8, y: it.y - 8, width: it.w + 16, height: it.h + 16, rx: 4 }, `Connecteur de ${it.label}`);
    } else if (it.kind === 'edp') {
      r.plug = S('g', {}, g);
      S('rect', { x: it.x, y: it.y, width: 28, height: 10, rx: 1.5, fill: 'url(#hd-metal-x)' }, r.plug);
      S('rect', { x: it.x + 8, y: it.y - 8, width: 12, height: 8, rx: 2, fill: '#2f6fd1' }, r.plug); // languette
      r.hit = hit(g, `item:${it.id}`, { x: it.x - 10, y: it.y - 16, width: 48, height: 34, rx: 4 }, `Connecteur de ${it.label}`);
    }
    // support vissé posé par-dessus (il s'en va quand toutes ses vis sont retirées)
    if (it.cover) r.bracket = S('rect', { ...it.cover, rx: 2, class: 'lt-bracket' }, g);
    refs.items[it.id] = r;
  }

  function drawCover() {
    const g = S('g', { class: 'lt-cover' }, bottom);
    refs.cover.g = g;
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#lt-cover)', stroke: '#0e1011', 'stroke-width': 2 }, g);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#hd-weave)' }, g);
    S('rect', { x: 16, y: 16, width: 608, height: 388, rx: 20, fill: 'url(#hd-sheen)' }, g);
    S('rect', { x: 24, y: 24, width: 592, height: 372, rx: 16, fill: 'none', stroke: '#000000', 'stroke-opacity': '.35' }, g);
    // ouïes arrière (côté charnières) et grille face au ventilateur
    for (let k = 0; k < 7; k++) {
      S('rect', { x: 152 + k * 20, y: 22, width: 13, height: 6, rx: 3, fill: '#0b0c0d' }, g);
      S('rect', { x: 348 + k * 20, y: 22, width: 13, height: 6, rx: 3, fill: '#0b0c0d' }, g);
    }
    for (let row = 0; row < 3; row++) for (let c = 0; c < 10; c++) S('rect', { x: 108 + c * 10, y: 84 + row * 30, width: 5, height: 25, rx: 2.5, fill: '#0b0c0d' }, g);
    // encoches en U près des charnières : on y glisse la pointe pour commencer
    for (const x of [132, 508]) S('path', { d: `M${x - 8} 16 V21 a8 8 0 0 0 16 0 V16 Z`, fill: '#0b0c0d' }, g);
    // patins avant, sorties des haut-parleurs, gravure, étiquette de service
    S('rect', { x: 44, y: 340, width: 62, height: 13, rx: 6.5, class: 'lt-foot' }, g);
    S('rect', { x: 534, y: 340, width: 62, height: 13, rx: 6.5, class: 'lt-foot' }, g);
    S('rect', { x: 52, y: 380, width: 56, height: 4, rx: 2, fill: '#0b0c0d' }, g);
    S('rect', { x: 532, y: 380, width: 56, height: 4, rx: 2, fill: '#0b0c0d' }, g);
    S('text', { x: 320, y: 246, class: 'lt-engrave', 'text-anchor': 'middle' }, g).textContent = 'AT · 14';
    S('rect', { x: 250, y: 300, width: 140, height: 44, rx: 3, fill: '#e8e9e4' }, g);
    ['Service Tag : 17AT26', 'AT-17 · Modèle P17G', 'Entrée : 20 V ⎓ 3,25 A (USB-C)'].forEach((t, k) => {
      S('text', { x: 258, y: 314 + k * 12, class: 'lt-label' }, g).textContent = t;
    });
    // 8 vis imperdables
    refs.cover.screws = COVER_SCREWS.map(([x, y], i) => {
      const sg = S('g', { class: 'lt-cscrew' }, g);
      S('circle', { cx: x, cy: y, r: 7.5, fill: '#0b0c0d' }, sg);
      const head = screwHead(sg, x, y, 6.6);
      const h = hit(sg, `cscrew:${i}`, { cx: x, cy: y, r: 12 }, `Vis imperdable du capot n° ${i + 1}`);
      return { sg, head, hit: h };
    });
    // points de déclipsage (signalés une fois les vis desserrées) : encoches d'abord
    refs.cover.clips = CLIPS.map(([x, y], i) => {
      const cg = S('g', { class: `lt-clip${i < NOTCHES ? ' lt-clip-start' : ''}` }, g);
      const rot = y < 40 ? 0 : x < 40 ? -90 : x > 600 ? 90 : 180;
      S('path', { d: `M${x - 7} ${y + 4} l7 -6 l7 6`, class: 'lt-clip-mark', transform: `rotate(${rot} ${x} ${y})` }, cg);
      const h = hit(cg, `clip:${i}`, { cx: x, cy: y, r: 14 }, i < NOTCHES ? `Encoche en U près de la charnière ${i ? 'droite' : 'gauche'}` : `Jointure du capot, point ${i + 1}`);
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
  /** Charnière : barillet métallique et équerre vissée dans le coin arrière (side -1 : à gauche). */
  function hinge(parent, side) {
    const ex = side < 0 ? 20 : 582;
    S('rect', { x: side < 0 ? 58 : 520, y: 20, width: 62, height: 14, rx: 7, fill: 'url(#hd-metal-x)' }, parent);
    S('rect', { x: ex, y: 18, width: 38, height: 30, rx: 5, fill: '#6f767a', stroke: '#3e4447' }, parent);
    for (const [dx, dy] of [[9, 9], [22, 9], [15, 22]]) screwHead(parent, side < 0 ? ex + dx : ex + 38 - dx, 18 + dy, 3.6);
  }
  /** Port vu de l'intérieur, au bord de la carte : USB-C, USB-A, HDMI, prise casque ou Ethernet. */
  function port(parent, x, y, w, h, kind) {
    const edge = x < 320 ? x : x + w; // côté ouvert vers l'extérieur
    if (kind === 'jack') {
      S('rect', { x, y, width: w, height: h, rx: 2, fill: '#15181a', stroke: '#3a4044' }, parent);
      S('circle', { cx: edge + (x < 320 ? 4 : -4), cy: y + h / 2, r: 4, fill: 'url(#hd-alu)' }, parent);
      return;
    }
    if (kind === 'rj45') {
      S('rect', { x, y, width: w, height: h, rx: 2, fill: '#15181a', stroke: '#3a4044' }, parent);
      for (let k = 0; k < 8; k++) S('rect', { x: x + 4, y: y + 4 + k * 2.6, width: w - 10, height: 1.2, fill: '#d9a441' }, parent);
      return;
    }
    S('rect', { x, y, width: w, height: h, rx: kind === 'usbc' ? 4 : 1.5, fill: 'url(#hd-metal-y)', stroke: '#4b5257', 'stroke-width': '.8' }, parent);
    if (kind === 'usbc') S('rect', { x: x + 2.5, y: y + 4, width: w - 5, height: h - 8, rx: 2, fill: '#15181a' }, parent);
    if (kind === 'usba') S('rect', { x: x + 3, y: y + 3, width: w - 7, height: h - 6, rx: 1, fill: '#1f5fbf' }, parent);
    if (kind === 'hdmi') S('path', { d: `M${x + 3} ${y + 4} H${x + w - 4} V${y + h - 8} L${x + w - 8} ${y + h - 4} H${x + 7} L${x + 3} ${y + h - 8} Z`, fill: '#15181a' }, parent);
    if (kind === 'usba-gold') {
      S('rect', { x, y, width: w, height: h, rx: 1.5, fill: 'url(#hd-gold)' }, parent);
      S('rect', { x: x + 4, y: y + 4, width: w - 9, height: h - 8, rx: 1, fill: '#15181a' }, parent);
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
    if (st.flipped) say('PC retourné ✔ Posé sur un tapis antistatique ou un chiffon doux, pour ne pas rayer le capot. On desserre ses 8 vis imperdables (tournevis).', 'good');
    return undefined;
  }

  function act(key) {
    if (st.done) return;
    startClock();
    const [kind, arg] = key.split(':');
    if (kind === 'charger') unplugCharger();
    else if (kind === 'cscrew') coverScrew(Number(arg));
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
    if (kind === 'clip') {
      if (st.cover.clips[arg]) return null;
      const started = st.cover.clips.slice(0, NOTCHES).some(Boolean);
      return st.esd && st.cover.screws.every(Boolean) && (started || Number(arg) < NOTCHES) ? 'ok' : 'no';
    }
    if (kind === 'item') {
      const it = ITEM[arg];
      if (st.items[it.id] === 'out') return null;
      if (!st.esd || (!it.pre && !batteryOff())) return 'no';
      if (it.n && ITEMS.some((x) => x.part === it.part && x.n > it.n && st.items[x.id] !== 'out')) return 'no';
      if (needsOf(it).some((n) => st.items[n] !== 'out')) return 'no';
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
    lit = kind === 'part' ? refs.parts[arg].body : target.closest('.lt-item, .lt-cscrew, .lt-clip, .lt-charger');
    lit?.classList.add(`is-${s}`);
  }

  function unplugCharger() {
    if (!st.charger) return undefined;
    if (st.tool !== 'hand') return say('La fiche se retire à la main.');
    st.charger = false;
    for (const p of [refs.plugTop, refs.plugBottom]) p.classList.add('is-out');
    refs.chargeLed.classList.remove('is-on');
    sfx('clack');
    return say('Chargeur débranché ✔ Le voyant blanc de charge s’éteint. Maintenant : le bracelet antistatique, puis on retourne le PC.', 'good');
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
    if (left === 0) {
      refs.cover.g.classList.add('is-ready');
      return say('Les 8 vis sont desserrées ✔ Imperdables, elles restent prisonnières du capot. Place au spudger : on commence par une encoche en U, près d’une charnière.', 'good');
    }
    return say(`Vis desserrée (vis imperdable, elle reste dans le capot). Encore ${left}.`);
  }

  function coverClip(i) {
    if (st.cover.clips[i]) return undefined;
    if (st.tool !== 'spudger') return say('Les clips se libèrent au spudger : on le glisse dans la jointure et on fait levier doucement.');
    if (st.cover.screws.some((s) => !s)) return oops('Ça résiste : il reste une vis ! En forçant, on casse les clips du capot.');
    if (!st.esd) return oops('Avant d’ouvrir, mets le bracelet antistatique : l’intérieur est plein de composants sensibles.');
    if (i >= NOTCHES && !st.cover.clips.slice(0, NOTCHES).some(Boolean)) {
      return oops('Commence par une encoche en U près des charnières : elles sont faites pour glisser la pointe. Ailleurs, on marque le capot et on casse ses clips.');
    }
    st.cover.clips[i] = true;
    refs.cover.clips[i].cg.classList.add('is-done');
    sfx('snap');
    const left = st.cover.clips.filter((c) => !c).length;
    if (left && i < NOTCHES) return say(`Clac ! L’encoche donne prise : on continue le long des côtés, puis l’avant (encore ${left}).`);
    if (left) return say(`Clac ! Clip libéré. On progresse le long de la jointure, sans tordre le capot (encore ${left}).`);
    st.cover.off = true;
    st.removed.add('cover');
    flipBtn.disabled = true;
    snapshot('cover');
    lift(refs.cover.g);
    showCard('cover', true);
    renderSide();
    return say('Capot déposé ✔ Premier réflexe, avant de toucher à quoi que ce soit : décoller l’adhésif du câble de la batterie, puis débrancher ce câble.', 'good');
  }

  /* ---------- Intérieur ---------- */
  const batteryOff = () => st.items['bat-plug'] === 'out';
  const disconnected = (it) => ({ plug: 'out', ant: 'out', zif: 'out', edp: 'out', tape: 'out' })[it.kind] === st.items[it.id];

  function guard(it) {
    if (!st.esd) { oops('Bracelet antistatique d’abord ! Une décharge invisible suffit à abîmer une puce.'); return false; }
    if (!it?.pre && !batteryOff()) {
      oops('Batterie d’abord ! Tant qu’elle est branchée, la carte reste sous tension : le moindre faux contact peut la griller.');
      return false;
    }
    return true;
  }

  /** Après une vis : les supports vissés dont toutes les vis sont parties s'en vont. */
  function freeBrackets() {
    for (const x of ITEMS) {
      if (x.cover && needsOf(x).every((n) => st.items[n] === 'out')) refs.items[x.id].bracket.classList.add('is-off');
    }
  }

  function itemAction(it) {
    if (!guard(it)) return undefined;
    const r = refs.items[it.id];
    const state = st.items[it.id];
    if (state !== 'out' && needsOf(it).some((n) => st.items[n] !== 'out')) return say(it.needsMsg);
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
          spin(r.head);
          sfx('tink', { passive: true });
          if (it.id === 'wifi-s') {
            refs.parts.wifi.g.classList.add('no-bracket');
            r.g.classList.add('is-out');
            return say('Vis imperdable desserrée ✔ Elle reste prisonnière du petit support, qu’on soulève avec elle : les connecteurs d’antenne sont dégagés.', 'good');
          }
          r.g.classList.add('is-loose');
          if (it.n) return say(`Vis n° ${it.n} desserrée ✔ Elle est imperdable : elle reste prisonnière ${PARTS[it.part].of}.`);
          return say(`Vis imperdable desserrée ✔ Elle reste sur ${PARTS[it.part].the}.`);
        }
        const [label, size, total] = TRAY[it.tray];
        st.screws++;
        st.tray[it.tray]++;
        unscrew(r);
        sfx('tink', { passive: true });
        freeBrackets();
        renderSide();
        if (st.screws === 1) return say(`Vis ${size} retirée, rangée d’elle-même dans le bac magnétique (compartiment « ${label} ») : les vis n’ont pas toutes la même longueur, et une vis trop longue au remontage peut percer la carte.`);
        return say(`Vis ${size} retirée → bac « ${label} » (${st.tray[it.tray]}/${total}).`);
      }
      case 'tape': {
        if (state === 'out') return undefined;
        if (st.tool === 'driver') return say('C’est un adhésif, pas une vis : on le décolle (main ou spudger).');
        st.items[it.id] = 'out';
        r.g.classList.add('is-out');
        if (it.id === 'ant-tape') refs.ants.classList.add('is-free');
        sfx('rip', { passive: true });
        renderSide();
        if (it.id === 'ant-tape') return say('Adhésifs décollés ✔ Les câbles d’antenne sortent de leurs guides sur le caloduc : on les écarte pour ne pas les pincer en soulevant le dissipateur.', 'good');
        return say('Adhésif décollé ✔ Il tient le câble de la batterie bien à plat. On le recolle au remontage. Maintenant, débranche le câble.', 'good');
      }
      case 'plug': {
        if (state === 'out') return undefined;
        if (st.tool === 'driver') return say('Pas de vis ici : c’est un connecteur, il se débranche à la main.');
        st.items[it.id] = 'out';
        r.plug.setAttribute('transform', `translate(${it.pull[0]} ${it.pull[1]})`);
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        if (it.id === 'bat-plug') return say('Batterie débranchée ✔ Connecteur tiré bien droit hors de son embase, jamais par les fils. Puis on maintient le bouton d’alimentation 5 secondes pour vider l’électricité résiduelle : la machine est hors tension.', 'good');
        return say(`${cap(it.label)} débranché ✔ Par le connecteur, jamais par les fils.`, 'good');
      }
      case 'ant': {
        if (state === 'out') return undefined;
        if (st.tool === 'hand') return say('À la main, on risque d’arracher le câble : soulève le petit connecteur bien à la verticale, avec la pointe du spudger.');
        if (st.tool !== 'spudger') return say('Les antennes se déconnectent au spudger.');
        st.items[it.id] = 'out';
        r.plug.setAttribute('transform', 'translate(-3 -6)');
        r.g.classList.add('is-out');
        sfx('click');
        renderSide();
        return say(`${cap(it.label)} déconnectée ✔ Les connecteurs U.FL sont fragiles : on les soulève bien droit. Au remontage chez Dell : blanc sur MAIN (△), noir sur AUX (▲).`, 'good');
      }
      case 'zif': {
        if (state === 'out') return undefined;
        if (state === 'locked') {
          if (st.tool === 'hand') return oops('Ne tire pas encore ! Le loquet verrouille la nappe : en tirant, on arrache ses pistes. Soulève d’abord le loquet avec le spudger.');
          if (st.tool !== 'spudger') return say('Le loquet se soulève avec la pointe du spudger (ou l’ongle).');
          st.items[it.id] = 'open';
          r.g.classList.add('is-open');
          r.latch.setAttribute('transform', `translate(${-it.dir[0] * 4} ${-it.dir[1] * 4})`); // le loquet pivote
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
    if (!guard({ pre: id === 'battery' })) return undefined;
    if (st.tool !== 'hand') {
      if (st.tool === 'driver') return say('Choisis une vis, ou prends la main pour soulever une pièce.');
      return say('Le spudger sert aux clips, aux loquets et aux antennes. Pour soulever une pièce, prends la main.');
    }
    const p = PARTS[id];
    const missing = p.after.filter((a) => !st.removed.has(a));
    if (missing.length) return say(`Pas encore : il faut d’abord déposer ${missing.map((a) => PARTS[a].the).join(', ')}.${p.why ?? ''}`);
    const blocking = ITEMS.filter((it) => it.blocks?.includes(id) && !disconnected(it));
    if (id === 'battery' && blocking.length) return say(`Encore branché : ${blocking[0].label}.`);
    const screwsLeft = ITEMS.filter((it) => it.kind === 'screw' && it.part === id && st.items[it.id] !== 'out');
    if (screwsLeft.length) {
      const kind = screwsLeft.every((s) => s.captive) ? (screwsLeft.length > 1 ? ' imperdables' : ' imperdable') : '';
      return say(`Ça ne vient pas : il reste ${screwsLeft.length} vis${kind} sur ${p.the}.${screwsLeft.some((s) => s.n) ? ' (Vis numérotées : ordre inverse, 4 → 1.)' : ''}`);
    }
    if (blocking.length) {
      const b = blocking[0];
      return say(`${b.kind === 'tape' ? 'Encore collé' : 'Encore branché'} : ${b.label}.${b.kind === 'zif' ? ' (Loquet au spudger, puis nappe à la main.)' : ''}`);
    }
    // gestes propres à la pièce (attaches de la RAM, protection thermique du SSD)
    if (p.steps && st.steps[id] < p.steps.length) {
      const text = p.steps[st.steps[id]];
      st.steps[id]++;
      refs.parts[id].g.classList.add(`is-step-${st.steps[id]}`);
      sfx('click');
      return say(text, 'good');
    }
    st.removed.add(id);
    snapshot(id);
    lift(refs.parts[id].g);
    let extra = '';
    // la pile CMOS est collée sur la carte mère : si elle y est encore, elle part avec
    if (id === 'mb' && !st.removed.has('cmos')) {
      st.removed.add('cmos');
      snapshot('cmos');
      lift(refs.parts.cmos.g);
      extra = ' La pile CMOS, collée dessus, est partie avec elle.';
    }
    // sans la carte mère ni le dissipateur pour les guider, les câbles d'antenne sont écartés vers les charnières
    if (id === 'mb') refs.ants.classList.add('is-away');
    sfx('whoosh', { passive: true });
    showCard(id, true);
    renderSide();
    if (st.removed.size === N_PARTS) return finish();
    return say(TIPS[id] + extra, 'good');
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
  function howTo(it) {
    const label = it.label ? `${it.label} : ` : '';
    if (it.kind === 'screw') {
      if (it.captive) return `desserre cette vis imperdable (tournevis)${it.n ? ', dans l’ordre inverse des numéros' : ''}`;
      return `retire cette vis ${TRAY[it.tray][1]} (tournevis)`;
    }
    if (it.kind === 'tape') return `${label}décolle-le (main ou spudger)`;
    if (it.kind === 'zif') return `${label}${st.items[it.id] === 'locked' ? 'soulève le loquet (spudger)' : 'tire la nappe à plat (main)'}`;
    if (it.kind === 'ant') return `${label}soulève-la bien droit (spudger)`;
    if (it.kind === 'edp') return `${label}tire la languette (main)`;
    return `${label}débranche-le par le connecteur (main)`;
  }

  function hint() {
    sfx('click');
    startClock();
    const show = (node, text) => {
      $$('.is-hint', root).forEach((n) => n.classList.remove('is-hint')); // un seul indice à la fois
      if (node) {
        void node.getBoundingClientRect();
        node.classList.add('is-hint');
        setTimeout(() => node.classList.remove('is-hint'), 2600);
        if (view.contains(node)) reveal(node);
      }
      say(`Indice : ${text}`);
    };
    if (st.charger) return show(refs.plugTop.querySelector('.lt-hit'), 'débranche le chargeur (main, sur la fiche USB-C).');
    if (!st.esd) return show(wristBtn, 'mets le bracelet antistatique (au-dessus du PC, avec les outils).');
    if (!st.flipped) return show(flipBtn, 'retourne le PC.');
    if (!st.cover.off) {
      const i = st.cover.screws.findIndex((s) => !s);
      if (i >= 0) return show(refs.cover.screws[i].hit, 'desserre cette vis imperdable (tournevis).');
      const started = st.cover.clips.slice(0, NOTCHES).some(Boolean);
      const c = started ? st.cover.clips.findIndex((x) => !x) : 0;
      return show(refs.cover.clips[c].hit, started ? 'libère ce clip (spudger).' : 'glisse le spudger dans cette encoche en U, près de la charnière.');
    }
    for (const id of ORDER) {
      if (st.removed.has(id) || PARTS[id].after.some((a) => !st.removed.has(a))) continue;
      const next = ITEMS.find((it) => ((it.part === id && it.kind === 'screw') || it.blocks?.includes(id)) && status(`item:${it.id}`) === 'ok');
      if (next) return show(refs.items[next.id].hit, `${howTo(next)}.`);
      if (status(`part:${id}`) !== 'ok') continue;
      const p = PARTS[id];
      if (p.steps && st.steps[id] < p.steps.length) return show(refs.parts[id].hit, id === 'ssd' ? 'fais glisser la protection thermique du SSD (main).' : `écarte les attaches ${p.of} du bout des doigts (main).`);
      return show(refs.parts[id].hit, `soulève ${p.the} (main).`);
    }
    return undefined;
  }

  /* ---------- Panneau latéral : bac, liste des pièces, compteurs ---------- */
  function renderSide() {
    trayEl.replaceChildren(...Object.entries(TRAY).map(([k, [label, size, total]]) => el('li', { cls: st.tray[k] ? 'has' : '', attrs: { title: `${label} : ${total} vis ${size}` } }, [
      el('span', { text: label }), el('small', { text: size }), el('b', { text: `${st.tray[k]}/${total}` }),
    ])));
    // les pièces déposées deviennent des boutons qui rouvrent leur fiche
    const all = [['cover', 'Capot inférieur'], ...ORDER.map((id) => [id, PARTS[id].name])];
    partsEl.replaceChildren(...all.map(([id, name]) => {
      if (!st.removed.has(id)) return el('li', { text: name });
      const b = el('button', { cls: 'lt-part-btn', text: name, attrs: { type: 'button', ...(shown === id ? { 'aria-current': 'true' } : {}) } });
      b.addEventListener('click', () => {
        sfx('click');
        showCard(id);
        renderSide();
        $('[aria-current="true"]', partsEl)?.focus();
      });
      return el('li', { cls: 'is-done' }, [b]);
    }));
    stat.parts.textContent = String(st.removed.size);
    stat.errors.textContent = String(st.errors);
    stat.screws.textContent = String(st.screws);
    stat.time.textContent = fmt(st.elapsed);
  }

  /* ---------- Fiche pièce : dessin de la pièce et ce qu'il faut en savoir ---------- */
  /** Garde le dessin d'une pièce au moment où elle sort (avant qu'elle disparaisse de la scène). */
  function snapshot(id) {
    const src = id === 'cover' ? refs.cover.g : refs.parts[id].art;
    let box;
    try { box = src.getBBox(); } catch { return; }
    if (!box.width || !box.height) return;
    const pad = Math.max(box.width, box.height) * 0.06;
    const s = S('svg', { viewBox: `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`, 'aria-hidden': 'true', focusable: 'false' });
    const copy = src.cloneNode(true);
    copy.removeAttribute('display');
    copy.querySelectorAll('.lt-hit, .lt-clip, .lt-ssd-plate').forEach((n) => n.remove()); // ni zones cliquables, ni capot du SSD
    s.append(copy);
    snaps[id] = s;
  }

  function showCard(id, fresh = false) {
    const info = INFO[id];
    shown = id;
    card.kicker.textContent = fresh ? `Pièce déposée · ${st.removed.size}/${N_PARTS}` : 'Fiche pièce';
    card.title.textContent = id === 'cover' ? 'Capot inférieur' : PARTS[id].name;
    card.intro.hidden = true;
    card.facts.hidden = false;
    card.facts.replaceChildren(...[['À quoi ça sert', info.role], ['En atelier', info.shop], ['Le saviez-vous ?', info.fact]]
      .flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
    card.pic.replaceChildren(...(snaps[id] ? [snaps[id].cloneNode(true)] : []));
    if (fresh && !reducedMotion()) {
      card.root.classList.remove('is-new');
      void card.root.offsetWidth;
      card.root.classList.add('is-new');
    }
  }

  /* ---------- Loupe ×2 ---------- */
  function setZoom(on) {
    scene.classList.toggle('is-zoomed', on);
    zoomBtn.setAttribute('aria-pressed', String(on));
    sfx('click');
    // en entrant, on part du centre du PC ; en sortant, la vue revient à l'origine
    view.scrollLeft = on ? (view.scrollWidth - view.clientWidth) / 2 : 0;
    view.scrollTop = on ? (view.scrollHeight - view.clientHeight) / 2 : 0;
  }
  /** Avec la loupe, amène un élément au centre de la vue. */
  function reveal(node) {
    if (!scene.classList.contains('is-zoomed')) return;
    const v = view.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    view.scrollBy({
      left: r.left + r.width / 2 - (v.left + v.width / 2),
      top: r.top + r.height / 2 - (v.top + v.height / 2),
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  }

  function finish() {
    st.done = true;
    clearInterval(timer);
    achieve('teardown');
    sfx('fanfare');
    $('.lt-end-stats', endEl).textContent = `${fmt(st.elapsed)} · ${st.errors} erreur${st.errors > 1 ? 's' : ''} · ${st.screws}/${N_SCREWS} vis rangées dans le bac`;
    endEl.hidden = false;
    say('Il ne reste que le repose-poignets, avec le pavé tactile et la carte USH : chez Dell, c’est une seule pièce détachée. Pièces triées, vis rangées : du travail d’atelier !', 'good');
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
