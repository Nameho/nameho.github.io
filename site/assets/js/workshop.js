// Atelier : les bons d'intervention se font tamponner à leur arrivée à l'écran
// et s'inclinent légèrement sous la souris.

import { $$, reducedMotion } from './util.js';
import { sfx } from './audio.js';

export function initWorkshop() {
  const tickets = $$('.ticket');
  if (!tickets.length) return;

  const stamp = (t) => {
    t.classList.remove('is-stamped');
    void t.offsetWidth; // relance l'animation
    t.classList.add('is-stamped');
  };

  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      io.unobserve(e.target);
      setTimeout(() => {
        stamp(e.target);
        sfx('stamp', { passive: true });
      }, 450 + i * 280);
    });
  }, { threshold: 0.6 });

  for (const t of tickets) {
    io.observe(t);
    t.querySelector('.t-stamp')?.addEventListener('click', () => { stamp(t); sfx('stamp'); });

    if (reducedMotion()) continue;
    t.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = t.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      t.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
      t.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
    });
    t.addEventListener('pointerleave', () => {
      t.style.setProperty('--ry', '0deg');
      t.style.setProperty('--rx', '0deg');
    });
  }
}
