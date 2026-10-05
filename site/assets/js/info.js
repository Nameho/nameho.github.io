// Fiches pédagogiques : un encadré non bloquant (on peut continuer à naviguer),
// ouvert par les boutons [data-info="…"] ou à la découverte d'un secret.

import { $, el } from './util.js';
import { sfx } from './audio.js';
import { INFO } from './info-data.js';

let card = null;
let opener = null;

function build() {
  card = el('aside', { cls: 'info-card', attrs: { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'info-title', tabindex: '-1', hidden: '' } });
  const close = el('button', { cls: 'dlg-close', text: '×', attrs: { type: 'button', 'aria-label': 'Fermer la fiche' } });
  close.addEventListener('click', closeInfo);
  card.append(
    close,
    el('p', { cls: 'ic-kicker' }),
    el('h2', { cls: 'ic-title', attrs: { id: 'info-title' } }),
    el('div', { cls: 'ic-body' }),
    el('a', { cls: 'ic-link', attrs: { target: '_blank', rel: 'noopener noreferrer external' } }),
  );
  card.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfo(); });
  document.body.appendChild(card);
}

/** Ouvre une fiche. kicker : petit titre au-dessus (« Secret débloqué · 3/7 »…). */
export function openInfo(key, { kicker = 'Le saviez-vous ?' } = {}) {
  const data = INFO[key];
  if (!data) return;
  if (!card) build();
  opener = document.activeElement;
  $('.ic-kicker', card).textContent = kicker;
  $('.ic-title', card).textContent = `${data.icon ? `${data.icon} ` : ''}${data.title}`;
  const body = $('.ic-body', card);
  body.replaceChildren(...data.text.map((t) => el('p', { text: t })));
  if (data.facts?.length) body.appendChild(el('ul', {}, data.facts.map((f) => el('li', { text: f }))));
  const link = $('.ic-link', card);
  link.hidden = !data.link;
  if (data.link) {
    link.href = data.link.href;
    link.textContent = `${data.link.label} ↗`;
  }
  card.classList.toggle('is-secret', key.startsWith('secret-'));
  card.hidden = false;
  card.classList.remove('is-in');
  void card.offsetWidth;
  card.classList.add('is-in');
  card.scrollTop = 0;
  card.focus({ preventScroll: true });
  sfx('pop', { passive: true });
}

export function closeInfo() {
  if (!card || card.hidden) return;
  card.hidden = true;
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
}

export function initInfo() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-info]');
    if (!btn) return;
    e.preventDefault();
    openInfo(btn.dataset.info, btn.dataset.infoKicker ? { kicker: btn.dataset.infoKicker } : undefined);
  });
}
