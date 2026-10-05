// Surprises de saison :
// - en décembre, une guirlande de LED s'allume le long de la piste de navigation ;
// - le 1er avril, le site s'affiche… à l'envers (avec un bouton pour le remettre à l'endroit).
// Aperçu possible à tout moment : ?date=2026-12-24 ou ?date=2027-04-01 dans l'adresse.

import { el, store } from './util.js';
import { sfx } from './audio.js';
import { toast } from './hud.js';

function today() {
  const p = new URLSearchParams(location.search).get('date');
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const d = new Date(`${p}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function initSeasons() {
  const d = today();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const stamp = d.toISOString().slice(0, 10);
  if (month === 12) garland(d.getFullYear());
  if (month === 4 && day === 1) aprilFool(stamp);
}

function garland(year) {
  const COLORS = ['#ff4b3a', '#52ff86', '#ffd74a', '#45d6ff', '#ff7ad9'];
  const box = el('div', { cls: 'garland', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 24; i++) {
    const bulb = el('i');
    bulb.style.setProperty('--c', COLORS[i % COLORS.length]);
    bulb.style.setProperty('--d', `${(i % 5) * 0.3}s`);
    box.appendChild(bulb);
  }
  document.body.appendChild(box);
  if (store.get('at-xmas') !== String(year)) {
    store.set('at-xmas', String(year));
    setTimeout(() => toast('🎄 Mode fêtes : l’atelier a sorti sa guirlande de LED !'), 2500);
  }
}

function aprilFool(stamp) {
  if (store.get('at-april') === stamp) return; // déjà remis à l'endroit aujourd'hui
  const root = document.documentElement;
  root.classList.add('april');
  const btn = el('button', { cls: 'april-fix btn btn-copper', text: '🐟 Poisson d’avril ! Remettre à l’endroit', attrs: { type: 'button' } });
  btn.addEventListener('click', () => {
    root.classList.remove('april');
    store.set('at-april', stamp);
    btn.remove();
    sfx('chime');
    toast('Ouf, tout est rentré dans l’ordre 🙃');
  });
  document.body.appendChild(btn);
  setTimeout(() => toast('Quelqu’un a monté le site à l’envers… 🐟'), 800);
}
