// Petits outils partagés par tous les modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Décidé par boot.js (préférence du visiteur, sinon réglage du système)
export const reducedMotion = () => document.documentElement.classList.contains('reduce-motion');

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crée un élément SVG avec ses attributs. */
export function svg(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/** Crée un élément HTML ; le texte passe toujours par textContent (jamais d'injection HTML). */
export function el(tag, { cls, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.appendChild(child);
  return node;
}

/** Générateur pseudo-aléatoire déterministe (même graine = même circuit). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Appelle cb(true/false) quand l'élément entre / sort de l'écran. */
export function watchVisibility(node, cb, rootMargin = '0px') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) cb(e.isIntersecting);
  }, { rootMargin });
  io.observe(node);
  return io;
}

/** Position du centre d'un élément, relative à un conteneur. */
export function centerIn(node, container) {
  const a = node.getBoundingClientRect();
  const b = container.getBoundingClientRect();
  return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
}

/** Copie dans le presse-papiers (avec repli pour les vieux navigateurs). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea', { attrs: { readonly: '', 'aria-hidden': 'true' } });
    area.value = text;
    area.className = 'sr-only';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/** Lecture / écriture locale tolérante (navigation privée, stockage bloqué…). */
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* stockage indisponible : tant pis */ }
  },
};
