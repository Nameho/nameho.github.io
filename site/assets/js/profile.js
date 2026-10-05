// Profil : brochage du circuit intégré « AT-2026 » — chaque broche décrit une qualité.

import { $, $$ } from './util.js';
import { sfx } from './audio.js';

export function initProfile() {
  const chip = $('.dip8');
  const caption = $('.pin-caption');
  if (!chip || !caption) return;
  const pins = $$('.pin', chip);
  const initial = caption.textContent;

  const show = (pin) => {
    pins.forEach((p) => p.classList.toggle('is-active', p === pin));
    chip.classList.toggle('is-hot', !!pin);
    caption.textContent = pin
      ? `Broche ${pin.querySelector('.pin-num').textContent} · ${pin.dataset.desc}`
      : initial;
  };

  for (const pin of pins) {
    pin.addEventListener('pointerenter', () => show(pin));
    pin.addEventListener('focus', () => show(pin));
    pin.addEventListener('click', () => { show(pin); sfx('click'); });
  }
  chip.addEventListener('pointerleave', () => {
    if (!chip.contains(document.activeElement)) show(null);
  });
}
