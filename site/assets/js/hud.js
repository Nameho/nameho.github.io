// « Banc de test » : petits défis réussis par le visiteur + notifications.

import { $, $$, el, reducedMotion, store } from './util.js';
import { sfx } from './audio.js';

const LABELS = {
  case: 'Boîtier ouvert',
  repair: 'Panne réparée',
  scope: 'Oscilloscope maîtrisé',
  bios: 'PC redémarré',
  colors: 'Code couleur maîtrisé',
  dip: 'Veille filtrée',
  solder: 'Soudures réussies',
};
const SECRETS = {
  trace: 'piste coupée réparée',
  thermal: 'caméra thermique',
  blueprint: 'mode schéma',
  cordons: 'test des cordons',
  fuse: 'fusible maltraité',
  console: 'console du développeur',
  page404: 'page 404 réparée',
};
const SECRETS_KEY = 'at-secrets';
const done = new Set();
const found = new Set();

const paintSecret = (id) => {
  $(`.hud-secrets [data-secret="${id}"]`)?.classList.add('done');
  const count = $('[data-secret-count]');
  if (count) count.textContent = String(found.size);
};

/** Secret découvert (compté à part du contrôle qualité, mémorisé dans ce navigateur). */
export function discover(id) {
  if (!SECRETS[id] || found.has(id)) return false;
  found.add(id);
  store.set(SECRETS_KEY, JSON.stringify([...found]));
  paintSecret(id);
  const total = Object.keys(SECRETS).length;
  if (found.size === total) {
    toast(`Les ${total} secrets sont trouvés : un vrai fouineur d’atelier 🕵️`);
    sfx('fanfare');
    confetti();
  } else {
    toast(`Secret trouvé : ${SECRETS[id]} (${found.size}/${total})`);
    sfx('chime');
  }
  return true;
}

export function toast(text) {
  const box = $('.toasts');
  if (!box) return;
  const t = el('p', { cls: 'toast' }, [el('span', { cls: 'led led-green', attrs: { 'aria-hidden': 'true' } }), el('span', { text })]);
  box.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

export function achieve(id) {
  if (!LABELS[id] || done.has(id)) return;
  done.add(id);
  const total = Object.keys(LABELS).length;

  $$('.hud-leds i').forEach((led, i) => led.classList.toggle('on', i < done.size));
  const count = $('.hud-count b');
  if (count) count.textContent = String(done.size);
  $(`.hud-list [data-ach="${id}"]`)?.classList.add('done');

  const hud = $('.hud');
  hud?.classList.remove('is-bump');
  void hud?.offsetWidth;
  hud?.classList.add('is-bump');

  if (done.size === total) {
    setTimeout(() => {
      toast(`Contrôle qualité ${total}/${total} : technicien validé, bon pour l’embauche !`);
      sfx('fanfare');
      confetti();
    }, 900);
  } else {
    toast(`Test réussi : ${LABELS[id]} (${done.size}/${total})`);
  }
}

// Pluie de petits composants (résistances, LED, condensateurs)
function confetti() {
  if (reducedMotion()) return;
  const canvas = el('canvas', { cls: 'confetti', attrs: { 'aria-hidden': 'true' } });
  document.body.appendChild(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const kinds = ['res', 'led', 'cap'];
  const parts = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 1.6,
    vy: 1.5 + Math.random() * 2.5,
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.15,
    kind: kinds[Math.floor(Math.random() * kinds.length)],
    color: ['#ff4b3a', '#52ff86', '#ffd74a', '#45d6ff'][Math.floor(Math.random() * 4)],
  }));

  const drawPart = (p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    if (p.kind === 'res') {
      ctx.fillStyle = '#c3c6c2';
      ctx.fillRect(-14, -1, 28, 2);
      ctx.fillStyle = '#d8c59c';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = '#f2c400'; ctx.fillRect(-5, -4, 2, 8);
      ctx.fillStyle = '#8b3fd1'; ctx.fillRect(-1, -4, 2, 8);
      ctx.fillStyle = '#7a4a1f'; ctx.fillRect(3, -4, 2, 8);
    } else if (p.kind === 'led') {
      ctx.fillStyle = '#c3c6c2';
      ctx.fillRect(-3, 4, 1.5, 10);
      ctx.fillRect(2, 4, 1.5, 8);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 5, Math.PI, 0);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2b55b5';
      ctx.fillRect(-5, -7, 10, 14);
      ctx.fillStyle = '#cfd8ea';
      ctx.fillRect(2, -7, 2, 14);
    }
    ctx.restore();
  };

  const start = performance.now();
  const tick = (now) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.05;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      drawPart(p);
    }
    if (now - start < 4200) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

export function initHud() {
  // Secrets déjà trouvés lors d'une visite précédente (affichés sans fanfare)
  let saved = [];
  try { saved = JSON.parse(store.get(SECRETS_KEY, '[]')); } catch { saved = []; }
  if (Array.isArray(saved)) {
    for (const id of saved) {
      if (SECRETS[id]) { found.add(id); paintSecret(id); }
    }
  }
  // Retour depuis la page 404 réparée
  if (store.get('at-404-fixed') === '1') {
    store.set('at-404-fixed', '0');
    setTimeout(() => discover('page404') || toast('Circuit 404 rétabli : bon retour à l’atelier !'), 1200);
  }

  // Choix des animations (prioritaire sur le réglage du système)
  const motion = $('.motion-toggle');
  if (motion) {
    const reduced = reducedMotion();
    motion.setAttribute('aria-pressed', String(!reduced));
    motion.title = reduced ? 'Animations réduites : cliquer pour tout activer' : 'Animations complètes : cliquer pour les réduire';
    $('.sr-only', motion).textContent = motion.title;
    motion.addEventListener('click', () => {
      store.set('at-motion', reduced ? 'full' : 'reduced');
      window.location.reload();
    });
  }

  const btn = $('.hud-toggle');
  const panel = $('#hud-panel');
  if (!btn || !panel) return;
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  btn.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); } });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.target.closest('.hud')) setOpen(false);
  });
}
