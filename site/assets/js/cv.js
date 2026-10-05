// CV : le PDF est publié chiffré (assets/cv/cv.bin). Il n'est déchiffré dans le navigateur
// qu'après un petit test anti-robot : brancher la fiche dans la prise.
// Les moteurs de recherche et les aspirateurs de pages ne peuvent donc pas le lire.

import { $, $$, el, clamp, reducedMotion } from './util.js';
import { sfx } from './audio.js';
import { toast } from './hud.js';
import { CV_KEY, CV_NAME } from './cv-key.js';

let unlocked = false;
let pdfUrl = null;

async function decryptCv() {
  if (pdfUrl) return pdfUrl;
  const res = await fetch('assets/cv/cv.bin', { cache: 'no-cache', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const raw = Uint8Array.from(atob(CV_KEY), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const pdf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
  pdfUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  return pdfUrl;
}

function download(url) {
  const a = el('a', { attrs: { href: url, download: CV_NAME } });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function initCv() {
  const dlg = $('.cv-gate');
  if (!dlg) return;
  const track = $('.plug-track', dlg);
  const plug = $('.plug', dlg);
  const status = $('.cvg-status', dlg);
  const after = $('.cvg-after', dlg);
  const openLink = $('[data-cv-open]', dlg);
  const reduce = reducedMotion();

  let x = 0;
  let max = 0;
  let pid = null;
  let off = 0;
  let moves = 0;
  let t0 = 0;
  let keySteps = 0;

  const say = (text, kind = '') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };
  // Course maximale : la collerette de la fiche vient buter contre la façade de la prise,
  // les broches (qui dépassent) s'enfoncent alors dans la cavité.
  const socket = $('.socket', dlg);
  // On lit la position CSS de départ (et non offsetLeft, faussé par l'animation d'indication)
  const measure = () => {
    const left = parseFloat(getComputedStyle(plug).left) || 0;
    max = Math.max(0, socket.offsetLeft - left - plug.offsetWidth - 6);
  };
  const stopHint = () => plug.classList.remove('is-hint');
  const place = (v, animate = false) => {
    x = clamp(v, 0, max);
    plug.classList.toggle('is-spring', animate);
    plug.style.transform = `translateX(${x.toFixed(1)}px)`;
    track.style.setProperty('--cable', `${x.toFixed(1)}px`);
    plug.setAttribute('aria-valuenow', String(Math.round((x / (max || 1)) * 100)));
  };

  async function success() {
    unlocked = true;
    stopHint();
    measure();
    place(max, true);
    track.classList.add('is-connected');
    sfx('snap');
    say('Connexion établie… déchiffrement du CV', 'busy');
    try {
      const url = await decryptCv();
      sfx('ok');
      say('Téléchargement lancé ✔', 'good');
      openLink.href = url;
      after.hidden = false;
      download(url);
    } catch (err) {
      console.error('[cv]', err);
      sfx('buzz');
      say('Le CV est momentanément indisponible. Contactez-moi directement !', 'bad');
    }
  }

  function fail(text) {
    sfx('buzz');
    say(text, 'bad');
    place(0, true);
  }

  function reset() {
    track.classList.toggle('is-connected', unlocked);
    after.hidden = !unlocked;
    keySteps = 0;
    measure();
    place(unlocked ? max : 0);
    say(unlocked ? 'Déjà branché : vous pouvez retélécharger le CV.' : '');
  }

  // Glisser la fiche
  plug.addEventListener('pointerdown', (e) => {
    if (unlocked) return;
    e.preventDefault();
    stopHint();
    measure();
    pid = e.pointerId;
    try { plug.setPointerCapture(pid); } catch { /* suivi via la fenêtre */ }
    off = e.clientX - x;
    moves = 0;
    t0 = performance.now();
    plug.classList.add('is-drag');
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    moves++;
    place(e.clientX - off);
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    plug.classList.remove('is-drag');
    if (x < max - 6) { place(0, true); return; }
    // Un robot « téléporte » la fiche : un humain la fait glisser
    if (moves < 6 || performance.now() - t0 < 250) fail('Trop rapide pour un humain 🤖 Faites glisser la fiche jusqu’à la prise.');
    else success();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  // Clavier : flèche droite pour avancer
  plug.addEventListener('keydown', (e) => {
    if (unlocked) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      stopHint();
      measure();
      keySteps++;
      place(x + max / 5);
      sfx('click');
      if (x >= max - 1 && keySteps >= 5) success();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      place(x - max / 5);
    }
  });

  $('[data-cv-retry]', dlg)?.addEventListener('click', () => decryptCv().then(download).catch(() => {}));
  $$('[data-dlg-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // Tous les boutons « Télécharger mon CV » du site
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cv]');
    if (!btn) return;
    e.preventDefault();
    sfx('click');
    if (!dlg.open) dlg.showModal();
    reset();
    if (!reduce && !unlocked) plug.classList.add('is-hint');
    setTimeout(stopHint, 1600);
    (unlocked ? $('[data-cv-retry]', dlg) : plug).focus();
    if (unlocked) toast('CV déjà déverrouillé ✔');
  });
}
