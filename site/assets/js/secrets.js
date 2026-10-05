// Secrets du site :
// - caméra thermique : cliquer sur la petite thermistance TH1 de la carte des compétences ;
// - mode schéma : code Konami (↑ ↑ ↓ ↓ ← → ← → B A) ou 5 tapes sur « RÉV. 2026.10 » en bas de page ;
// - piste coupée : gérée dans hero.js.

import { $, $$ } from './util.js';
import { sfx } from './audio.js';
import { discover, toast } from './hud.js';

// Températures affichées par la caméra (°C)
const HOT = [
  ['.hero-name', 36.6],
  ['.hero-canvas', 31],
  ['.u1-body', 64],
  ['.comp[data-skill="materiel"]', 46],
  ['.th1', 52],
  ['.bled', 39],
  ['[data-part="R1"]', 41],
  ['[data-part="BAT1"]', 24],
  ['[data-part="D1"]', 33],
  ['.meter-body', 27],
  ['.pc-part[data-pc="CPU"]', 71],
  ['.pc-part[data-pc="GPU"]', 58],
  ['.pc-part[data-pc="PSU"]', 44],
  ['.pc-part[data-pc="RAM"]', 42],
  ['.coin', 24],
  ['.oled', 34],
  ['.iron', 340],
  ['.dip8-body', 38],
];

export function initSecrets() {
  const root = document.documentElement;
  const ui = $('.thermal-ui');
  const reticle = $('.th-reticle', ui);
  const tempEl = $('.th-temp', ui);

  /* ---------- Caméra thermique ---------- */
  for (const [sel, t] of HOT) {
    $$(sel).forEach((n) => {
      n.dataset.temp = String(t);
      if (t >= 40) n.classList.add('th-hot');
    });
  }

  let ambient = 23.4;
  const onMove = (e) => {
    reticle.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-temp]');
    ambient += (Math.random() - 0.5) * 0.2;
    ambient = Math.min(26.5, Math.max(21.5, ambient));
    const t = hit ? Number(hit.dataset.temp) + (Math.random() - 0.5) * 0.6 : ambient;
    tempEl.textContent = `${t.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
    reticle.classList.toggle('is-hot', t >= 40);
  };

  function thermal(on) {
    if (on) blueprint(false);
    root.classList.toggle('thermal', on);
    ui.hidden = !on;
    if (on) {
      window.addEventListener('pointermove', onMove);
      sfx('zap');
      discover('thermal') || toast('Caméra thermique activée');
      $('[data-thermal-off]', ui).focus({ preventScroll: true });
    } else {
      window.removeEventListener('pointermove', onMove);
    }
  }

  $('.th1')?.addEventListener('click', (e) => {
    e.stopPropagation();
    thermal(!root.classList.contains('thermal'));
  });
  $('[data-thermal-off]', ui)?.addEventListener('click', () => thermal(false));

  /* ---------- Mode schéma (blueprint) ---------- */
  function blueprint(on) {
    if (on) thermal(false);
    if (root.classList.contains('blueprint') === on) return;
    root.classList.toggle('blueprint', on);
    if (on) {
      sfx('fanfare');
      discover('blueprint') || toast('Mode schéma activé');
    } else {
      toast('Retour au rendu normal');
    }
  }

  const CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (root.classList.contains('thermal')) thermal(false);
      else if (root.classList.contains('blueprint')) blueprint(false);
    }
    if (e.target.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    pos = k === CODE[pos] ? pos + 1 : k === CODE[0] ? 1 : 0;
    if (pos === CODE.length) {
      pos = 0;
      blueprint(!root.classList.contains('blueprint'));
    }
  });

  // Sur mobile (pas de flèches) : 5 tapes rapides sur « RÉV. 2026.10 »
  let taps = [];
  $('.rev-tag')?.addEventListener('click', () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 3000).concat(now);
    if (taps.length >= 5) {
      taps = [];
      blueprint(!root.classList.contains('blueprint'));
    }
  });
}
