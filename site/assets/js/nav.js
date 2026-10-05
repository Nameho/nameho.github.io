// Navigation : piste de cuivre qui se remplit au défilement, points de test = sections.

import { $, $$, clamp } from './util.js';

export function initNav() {
  const nav = $('.trace-nav');
  const topbar = $('.topbar');
  const menuBtn = $('.topbar-menu');
  const current = $('.topbar-current');
  if (!nav) return;

  const links = $$('a[href^="#"]', nav);
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  const root = document.documentElement;

  // Chaque point de test est placé là où la piste arrive quand on atteint sa section.
  const placeTps = () => {
    const max = root.scrollHeight - window.innerHeight;
    links.forEach((a, i) => {
      const s = sections[i];
      const pos = max > 0 ? clamp((s.offsetTop - 24) / max, 0, 1) : i / (links.length - 1);
      a.parentElement.style.setProperty('--pos', pos.toFixed(4));
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = root.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      nav.style.setProperty('--progress', p.toFixed(4));
      topbar?.style.setProperty('--progress', p.toFixed(4));
      ticking = false;
    });
  };

  // Section active = celle qui traverse le milieu de l'écran
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = sections.indexOf(e.target);
      links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      if (current) current.textContent = links[i].querySelector('.tp-label')?.textContent ?? '';
    }
  }, { rootMargin: '-45% 0px -54% 0px' });
  sections.forEach((s) => io.observe(s));

  // Menu mobile
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); menuBtn?.focus(); }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => { placeTps(); onScroll(); }).observe(document.body);
  placeTps();
  onScroll();
}

export function initReveal() {
  const items = $$('[data-reveal]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((n) => io.observe(n));
}
