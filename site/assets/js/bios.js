// Défi « Bips du BIOS » : un PC refuse de démarrer.
// Indices : bips du haut-parleur, voyants de diagnostic (DEBUG), ventilateur, écran.
// Le visiteur consulte le manuel, remplace la bonne pièce, puis rallume.

import { $, $$, el, clamp, reducedMotion } from './util.js';
import { sfx, beepSeq } from './audio.js';
import { achieve } from './hud.js';

const S = { dur: 0.16 };
const L = { dur: 0.62 };
const SIREN = Array.from({ length: 8 }, (_, i) => ({ f: i % 2 ? 640 : 920, dur: 0.24, gap: 0.01 }));

const FAULTS = {
  RAM: {
    name: 'la mémoire vive (RAM)',
    beeps: [L, L, L, L],
    led: 'DRAM',
    screen: 'nosignal',
    tip: 'Bips longs + voyant DRAM : avant de changer la barrette, on la retire, on nettoie les contacts et on la réinsère bien à fond. Souvent, ça suffit !',
  },
  GPU: {
    name: 'la carte graphique',
    beeps: [L, S, S],
    led: 'VGA',
    screen: 'nosignal',
    tip: "Voyant VGA + 1 long et 2 courts : on vérifie aussi le câble d'alimentation de la carte et la sortie vidéo utilisée (carte mère ou carte graphique).",
  },
  CPU: {
    name: 'le processeur',
    beeps: [],
    led: 'CPU',
    screen: 'nosignal',
    tip: 'Ventilateurs qui tournent, aucun bip, voyant CPU : on contrôle d’abord le câble d’alimentation du processeur (4/8 broches) et le socket avant de conclure.',
  },
  FAN: {
    name: 'le ventilateur du processeur',
    beeps: SIREN,
    led: null,
    screen: 'fanerror',
    noFan: true,
    tip: '« CPU Fan Error » : ventilateur bloqué, débranché ou HS. Un processeur sans refroidissement se met en sécurité… ou s’abîme.',
  },
  PSU: {
    name: "l'alimentation",
    beeps: null,
    led: null,
    screen: 'off',
    noPower: true,
    tip: "Rien du tout : on vérifie la prise, l'interrupteur à l'arrière de l'alimentation et le câble 24 broches avant de la remplacer.",
  },
};

const PART_NAMES = { CPU: 'le processeur', FAN: 'le ventilateur', RAM: 'la barrette de RAM', GPU: 'la carte graphique', PSU: "l'alimentation" };
const REPLACED = { CPU: 'Processeur remplacé', FAN: 'Ventilateur remplacé', RAM: 'Barrette de RAM remplacée', GPU: 'Carte graphique remplacée', PSU: 'Alimentation remplacée' };

const SCREENS = {
  fanerror: ['AT-17 BIOS v2.6  (C) 2026', 'Processeur : AT-17 @ 4,00 GHz', 'Mémoire : 16384 Mo OK', '', 'CPU Fan Error!', 'Press F1 to Run SETUP'],
  boot: ['AT-17 BIOS v2.6  (C) 2026', 'Processeur ........... OK', 'Mémoire 16384 Mo ..... OK', 'Carte graphique ...... OK', 'Ventilateur 1450 tr/min OK', '', 'Démarrage du système… ✔'],
};

export function initBios() {
  const root = $('.defi-bios');
  if (!root) return;
  const board = $('.pc-board', root);
  const svgEl = $('.pc-svg', root);
  const monitor = $('.monitor', root);
  const screenText = $('.monitor-text', root);
  const powerBtn = $('[data-pc-power]', root);
  const replayBtn = $('[data-pc-replay]', root);
  const signal = $('.bt-signal', root);
  const msg = $('.pc-msg', root);
  const pop = $('.pc-pop', root);
  const leds = Object.fromEntries($$('.ql[data-ql]', svgEl).map((n) => [n.dataset.ql, n]));
  const pwrLed = $('.ql-pwr', svgEl);
  const statOk = $('[data-pc-stat="ok"]', root);
  const statWasted = $('[data-pc-stat="wasted"]', root);
  const reduce = reducedMotion();

  const st = { fault: null, solved: null, last: null, on: false, pending: null, ok: 0, wasted: 0, timers: [] };

  const say = (text, kind = '') => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };
  const later = (fn, ms) => st.timers.push(setTimeout(fn, reduce ? 0 : ms));
  const clearTimers = () => { st.timers.forEach(clearTimeout); st.timers = []; };

  function typeScreen(lines) {
    screenText.textContent = '';
    lines.forEach((line, i) => later(() => { screenText.textContent += `${line}\n`; }, 250 + i * 180));
  }

  function setScreen(kind) {
    monitor.classList.remove('is-signal', 'is-nosignal');
    screenText.textContent = '';
    if (kind === 'nosignal') {
      monitor.classList.add('is-nosignal');
      screenText.textContent = 'Pas de signal';
    } else if (kind === 'fanerror' || kind === 'boot') {
      monitor.classList.add('is-signal');
      typeScreen(SCREENS[kind]);
    }
  }

  // Affiche le signal sonore (toujours visible, même son coupé) et le joue
  function playSignal(steps) {
    signal.replaceChildren();
    if (steps === null) { signal.textContent = 'rien'; return 0; }
    if (!steps.length) { signal.textContent = 'aucun bip'; return 0; }
    const isSiren = steps === SIREN;
    const marks = (isSiren ? steps.filter((_, i) => i % 2 === 0) : steps).map((s) =>
      el('span', { cls: `bt ${isSiren ? 'bt-siren' : s === L ? 'bt-long' : 'bt-short'}`, text: isSiren ? '∿' : s === L ? '▬' : '•' }));
    signal.append(...marks, el('span', { cls: 'sr-only', text: isSiren ? 'sirène' : describe(steps) }));
    board.classList.add('is-beeping');
    st.seq?.stop();
    st.seq = beepSeq(steps);
    const total = st.seq.total;
    let at = 0;
    (isSiren ? steps.filter((_, i) => i % 2 === 0) : steps).forEach((s, i) => {
      later(() => marks[i].classList.add('on'), at * 1000);
      at += isSiren ? 0.5 : s.dur + (s.gap ?? 0.16);
    });
    later(() => board.classList.remove('is-beeping'), total * 1000);
    return total;
  }

  function powerOn() {
    st.on = true;
    clearTimers();
    powerBtn.replaceChildren(el('span', { text: '⏻', attrs: { 'aria-hidden': 'true' } }), document.createTextNode(' Éteindre'));
    sfx('clack');
    const f = st.fault ? FAULTS[st.fault] : null;

    if (f?.noPower) {
      signal.textContent = 'rien';
      replayBtn.disabled = true;
      say(st.pending === 'bad'
        ? 'Toujours rien… La pièce remplacée était bonne. Pas de voyant, pas de ventilateur : que reste-t-il ?'
        : 'Rien ne se passe : pas de voyant, pas de ventilateur, pas de bip… Observe bien.', st.pending === 'bad' ? 'bad' : '');
      st.pending = null;
      return;
    }

    pwrLed.classList.add('on');
    board.classList.toggle('is-fan', !f?.noFan);
    sfx('whoosh');

    if (!f) {
      // Panne réparée : démarrage normal
      later(() => leds.BOOT.classList.add('on'), 200);
      later(() => leds.BOOT.classList.remove('on'), 900);
      later(() => { playSignal([S]); setScreen('boot'); }, 600);
      replayBtn.disabled = true;
      later(() => { if (!st.done) success(); }, 2200);
      return;
    }

    if (f.led) later(() => leds[f.led].classList.add('on'), 500);
    later(() => {
      playSignal(f.beeps);
      setScreen(f.screen);
      replayBtn.disabled = !f.beeps?.length;
    }, 900);
    if (st.pending === 'bad') {
      later(() => say('Même symptôme : la pièce remplacée était bonne (pièce gaspillée). Relis le manuel !', 'bad'), 1000);
    } else {
      later(() => say('Le PC ne démarre pas. Compare les indices avec le manuel, puis clique sur la pièce à remplacer.'), 1000);
    }
    st.pending = null;
  }

  function powerOff(silent = false) {
    st.on = false;
    clearTimers();
    powerBtn.replaceChildren(el('span', { text: '⏻', attrs: { 'aria-hidden': 'true' } }), document.createTextNode(' Allumer le PC'));
    board.classList.remove('is-fan', 'is-beeping');
    pwrLed.classList.remove('on');
    Object.values(leds).forEach((n) => n.classList.remove('on'));
    setScreen('off');
    replayBtn.disabled = true;
    if (!silent) sfx('click');
  }

  function success() {
    st.ok++;
    statOk.textContent = String(st.ok);
    sfx('chime');
    achieve('bios');
    say(`Le PC démarre ! C'était ${FAULTS[st.solved].name}. ${FAULTS[st.solved].tip}`, 'good');
    st.done = true;
  }

  /* ---------- Remplacement ---------- */
  let picked = null;
  function openPop(part) {
    if (st.done) {
      say('Ce PC fonctionne ! Clique sur « Nouvelle panne » pour en dépanner un autre.');
      return;
    }
    picked = part;
    if (st.on) {
      powerOff();
      say('Hors tension d’abord : on ne débranche jamais une pièce PC allumé.');
    }
    $('#pc-pop-title').textContent = `Remplacer ${PART_NAMES[part]} ?`;
    pop.hidden = false;
    const host = board.getBoundingClientRect();
    const b = $(`[data-pc="${part}"]`, svgEl).getBoundingClientRect();
    pop.style.left = `${clamp(b.left + b.width / 2 - host.left - pop.offsetWidth / 2, 0, host.width - pop.offsetWidth)}px`;
    pop.style.top = `${clamp(b.top + b.height / 2 - host.top - pop.offsetHeight / 2, 0, host.height - pop.offsetHeight)}px`;
    $('[data-pc-ok]', pop).focus();
  }
  function closePop() {
    pop.hidden = true;
    const back = picked && $(`[data-pc="${picked}"]`, svgEl);
    picked = null;
    if (back && pop.contains(document.activeElement)) back.focus();
  }
  $('[data-pc-ok]', pop).addEventListener('click', () => {
    const part = picked;
    pop.hidden = true;
    picked = null;
    const g = $(`[data-pc="${part}"]`, svgEl);
    g.classList.add('is-swap');
    sfx('pop');
    setTimeout(() => {
      g.classList.remove('is-swap');
      sfx('tink');
      if (part === st.fault) {
        st.fault = null;
        st.pending = 'good';
      } else {
        st.wasted++;
        statWasted.textContent = String(st.wasted);
        st.pending = 'bad';
      }
      say(`${REPLACED[part]}. Rallume le PC pour vérifier.`);
      powerBtn.focus();
    }, reduce ? 0 : 600);
  });
  $('[data-pc-cancel]', pop).addEventListener('click', closePop);
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

  $$('.pc-part', svgEl).forEach((g) => {
    g.addEventListener('click', () => openPop(g.dataset.pc));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(g.dataset.pc); }
    });
  });

  /* ---------- Commandes ---------- */
  powerBtn.addEventListener('click', () => {
    closePop();
    st.on ? powerOff() : powerOn();
  });
  replayBtn.addEventListener('click', () => {
    const f = FAULTS[st.fault];
    if (st.on && f?.beeps?.length) playSignal(f.beeps);
  });

  function newFault() {
    const keys = Object.keys(FAULTS).filter((k) => k !== st.last);
    st.fault = keys[Math.floor(Math.random() * keys.length)];
    st.solved = st.fault;
    st.last = st.fault;
    st.pending = null;
    st.done = false;
    closePop();
    powerOff(true);
    signal.textContent = '—';
    say('Nouveau PC en panne sur le banc. Appuie sur le bouton d’alimentation, écoute… et observe.');
  }
  $('[data-pc-new]', root).addEventListener('click', () => { sfx('click'); newFault(); });

  /* ---------- Pause quand on quitte l'onglet (ou la page) ---------- */
  function pause() {
    if (st.paused) return;
    st.paused = true;
    clearTimers();
    st.seq?.stop();
    board.classList.remove('is-beeping');
    board.classList.add('is-paused');
  }
  function resume() {
    if (!st.paused) return;
    st.paused = false;
    board.classList.remove('is-paused');
    // Le PC était allumé : on relance la séquence de démarrage pour revoir les indices
    if (st.on) {
      powerOn();
      say('Reprise : le PC redémarre, observe à nouveau…');
    }
  }
  root.addEventListener('panel:hide', pause);
  root.addEventListener('panel:show', resume);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (!root.hidden) resume();
  });

  newFault();
  say('Appuie sur le bouton d’alimentation, écoute… et observe.');
}

function describe(steps) {
  const longs = steps.filter((s) => s === L).length;
  const shorts = steps.length - longs;
  const parts = [];
  if (longs) parts.push(`${longs} bip${longs > 1 ? 's' : ''} long${longs > 1 ? 's' : ''}`);
  if (shorts) parts.push(`${shorts} bip${shorts > 1 ? 's' : ''} court${shorts > 1 ? 's' : ''}`);
  return parts.join(' et ');
}
