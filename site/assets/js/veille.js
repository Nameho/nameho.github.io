// Veille technologique : lit data/veille.json (mis à jour chaque jour par GitHub Actions),
// l'affiche dans un bandeau LED à matrice de points et dans des cartes filtrables
// par interrupteurs DIP. Les données externes sont vérifiées puis affichées
// en texte brut uniquement.

import { $, el, reducedMotion, watchVisibility } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

const PAGE = 12;

export function initVeille() {
  const section = $('#veille');
  if (!section) return;
  load(section).catch((err) => {
    console.error('[veille]', err);
    const meta = $('.veille-meta', section);
    if (meta) meta.textContent = 'Le flux de veille est momentanément indisponible.';
  });
}

async function load(section) {
  const res = await fetch('data/veille.json', { cache: 'no-cache', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = sanitize(await res.json());

  const grid = $('.veille-grid', section);
  const meta = $('.veille-meta', section);
  const more = $('[data-more]', section);
  const dip = $('.dip', section);
  const reduce = reducedMotion();
  const srcIndex = new Map(data.sources.map((s, i) => [s.id, i]));
  const srcById = new Map(data.sources.map((s) => [s.id, s]));
  const st = { on: new Set(data.sources.map((s) => s.id)), shown: PAGE };
  const cards = new Map();

  /* ---------- Interrupteurs DIP ---------- */
  const switches = $('.dip-switches', dip);
  const legend = el('ol', { cls: 'dip-legend' });
  data.sources.forEach((s, i) => {
    const id = `dip-${s.id}`;
    const input = el('input', { attrs: { type: 'checkbox', id, 'aria-label': `${s.nom} (${s.theme})` } });
    input.checked = true;
    const sw = el('label', { cls: 'dip-sw' }, [
      input,
      el('span', { cls: 'dip-track', attrs: { 'aria-hidden': 'true' } }, [el('span', { cls: 'dip-lever' })]),
      el('span', { cls: 'dip-num', text: String(i + 1), attrs: { 'aria-hidden': 'true' } }),
    ]);
    switches.appendChild(sw);
    const tag = el('label', { cls: `src-${i % 6}`, attrs: { for: id } }, [el('b', { text: String(i + 1) }), el('span', { text: s.nom })]);
    legend.appendChild(el('li', {}, [tag]));
    input.addEventListener('change', () => {
      input.checked ? st.on.add(s.id) : st.on.delete(s.id);
      tag.classList.toggle('is-off', !input.checked);
      sfx('clack');
      achieve('dip');
      st.shown = PAGE;
      renderGrid();
      ticker.setText(tickerText());
    });
  });
  dip.appendChild(legend);
  dip.hidden = false;

  /* ---------- Cartes ---------- */
  const visible = () => data.items.filter((it) => st.on.has(it.source));

  function card(it) {
    const s = srcById.get(it.source);
    const isVideo = /youtube\.com|youtu\.be/.test(new URL(it.url).hostname);
    const metaLine = el('p', { cls: 'v-meta' }, [
      el('span', { cls: 'v-src', text: s.nom }),
      el('span', { cls: 'v-lang', text: s.langue }),
    ]);
    if (isVideo) metaLine.appendChild(el('span', { cls: 'v-video', text: '▶ vidéo' }));
    if (it.date) metaLine.appendChild(el('time', { text: relDate(it.date), attrs: { datetime: it.date.toISOString() } }));
    const link = el('a', { text: it.title, attrs: { href: it.url, target: '_blank', rel: 'noopener noreferrer external' } });
    const li = el('li', { cls: `v-card src-${srcIndex.get(it.source) % 6}` }, [metaLine, el('h3', {}, [link])]);
    if (it.excerpt) li.appendChild(el('p', { cls: 'v-excerpt', text: it.excerpt }));
    li.dataset.key = it.url;
    return li;
  }

  function renderGrid() {
    const before = new Map();
    for (const node of grid.children) if (node.dataset.key) before.set(node.dataset.key, node.getBoundingClientRect());
    const list = visible();
    const nodes = list.slice(0, st.shown).map((it) => {
      if (!cards.has(it.url)) cards.set(it.url, card(it));
      return cards.get(it.url);
    });
    if (!nodes.length) {
      nodes.push(el('li', { cls: 'veille-empty', text: 'Tous les interrupteurs sont sur OFF… remontez-en au moins un !' }));
    }
    grid.replaceChildren(...nodes);
    more.hidden = list.length <= st.shown;

    if (!reduce) {
      let fresh = 0;
      for (const node of nodes) {
        const b = before.get(node.dataset.key);
        node.classList.remove('is-entering');
        if (b) {
          const a = node.getBoundingClientRect();
          const dx = b.left - a.left;
          const dy = b.top - a.top;
          if (dx || dy) {
            node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
          }
        } else if (node.dataset.key) {
          void node.offsetWidth;
          node.style.setProperty('--d', String(fresh++));
          node.classList.add('is-entering');
        }
      }
    }
  }

  more.addEventListener('click', () => {
    st.shown += PAGE;
    renderGrid();
    sfx('click');
  });

  /* ---------- Bandeau LED ---------- */
  const tickerText = () => {
    const top = visible().slice(0, 8);
    if (!top.length) return '+++ VEILLE EN PAUSE +++';
    return `+++ VEILLE TECHNO +++ ${top.map((it) => `${srcById.get(it.source).nom.toUpperCase()} : ${it.title}`).join(' +++ ')} +++`;
  };
  const ticker = dotMatrix($('.ticker-canvas', section), $('.ticker', section));
  ticker.setText(tickerText());

  const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });
  meta.textContent = data.updatedAt
    ? `${data.items.length} articles · mis à jour le ${fmt.format(data.updatedAt)}`
    : `${data.items.length} articles`;

  renderGrid();
}

/* ---------- Vérification des données ---------- */
function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
function toDate(v) {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function sanitize(data) {
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.sources)) throw new Error('format de veille inattendu');
  const sources = data.sources
    .filter((s) => s && typeof s.id === 'string' && typeof s.nom === 'string')
    .slice(0, 12)
    .map((s) => ({ id: str(s.id, 30), nom: str(s.nom, 40), theme: str(s.theme, 40), langue: str(s.langue, 4) }));
  const ids = new Set(sources.map((s) => s.id));
  const items = data.items
    .filter((it) => it && ids.has(it.source) && typeof it.title === 'string' && safeUrl(it.url))
    .slice(0, 60)
    .map((it) => ({ source: it.source, title: str(it.title, 200), url: safeUrl(it.url), date: toDate(it.date), excerpt: str(it.excerpt, 300) }));
  return { updatedAt: toDate(data.updatedAt), sources, items };
}

function relDate(d) {
  const today = new Date();
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/* ---------- Afficheur LED à matrice de points ---------- */
function dotMatrix(canvas, host) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });
  const ROWS = 11;
  const PITCH = 5;
  const SPEED = 42; // colonnes par seconde
  const reduce = reducedMotion();
  let mask = new Uint8Array(0);
  let textCols = 0;
  let cols = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let pitchY = 5;
  let offset = 0;
  let raf = 0;
  let last = 0;
  let visible = false;
  let hover = false;
  let text = '';
  let marks = [0]; // colonnes où commence chaque titre (mode pas à pas)
  let mark = 0;
  let stepTimer = 0;
  const bg = document.createElement('canvas');
  const sprite = document.createElement('canvas');

  function rasterize() {
    const font = '700 10px "JetBrains Mono", ui-monospace, monospace';
    octx.font = font;
    const w = Math.max(1, Math.ceil(octx.measureText(text).width) + 2);
    off.width = w;
    off.height = ROWS;
    octx.font = font;
    octx.textBaseline = 'top';
    octx.fillStyle = '#fff';
    octx.clearRect(0, 0, w, ROWS);
    octx.fillText(text, 0, 1);
    const img = octx.getImageData(0, 0, w, ROWS).data;
    marks = [];
    for (let i = text.indexOf('+++'); i !== -1; i = text.indexOf('+++', i + 3)) {
      marks.push(Math.floor(octx.measureText(text.slice(0, i)).width));
    }
    if (!marks.length) marks = [0];
    textCols = w;
    mask = new Uint8Array(w * ROWS);
    for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4 + 3] > 120 ? 1 : 0;
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cols = Math.floor(W / PITCH);
    pitchY = H / ROWS;
    const r = Math.min(PITCH, pitchY) * 0.34;
    bg.width = canvas.width;
    bg.height = canvas.height;
    const g = bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = 'rgba(255, 80, 40, 0.09)';
    for (let c = 0; c < cols; c++) {
      for (let y = 0; y < ROWS; y++) {
        g.beginPath();
        g.arc(c * PITCH + PITCH / 2, y * pitchY + pitchY / 2, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    const s = Math.ceil(r * 5 * dpr);
    sprite.width = sprite.height = s * 2;
    const sg = sprite.getContext('2d');
    const grad = sg.createRadialGradient(s, s, 0, s, s, s);
    grad.addColorStop(0, 'rgba(255, 236, 200, 1)');
    grad.addColorStop(0.18, 'rgba(255, 120, 60, 1)');
    grad.addColorStop(0.32, 'rgba(255, 70, 30, 0.45)');
    grad.addColorStop(1, 'rgba(255, 40, 10, 0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, s * 2, s * 2);
    draw();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.min(PITCH, pitchY) * 1.7;
    const start = Math.floor(offset);
    for (let c = 0; c < cols; c++) {
      const tc = start + c - cols;
      if (tc < 0 || tc >= textCols) continue;
      for (let y = 0; y < ROWS; y++) {
        if (!mask[y * textCols + tc]) continue;
        ctx.drawImage(sprite, c * PITCH + PITCH / 2 - size / 2, y * pitchY + pitchY / 2 - size / 2, size, size);
      }
    }
  }

  function loop(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (!hover) {
      const before = Math.floor(offset);
      offset += SPEED * dt;
      if (offset > textCols + cols) offset = 0;
      if (Math.floor(offset) !== before) draw();
    }
    raf = requestAnimationFrame(loop);
  }
  // Animations réduites : pas de défilement, un titre après l'autre toutes les 5 s
  function showMark() {
    offset = cols + (marks[mark] ?? 0) - 2;
    draw();
  }
  function start() {
    if (!visible || document.hidden) return;
    if (reduce) {
      if (!stepTimer) stepTimer = setInterval(() => {
        if (hover) return;
        mark = (mark + 1) % marks.length;
        showMark();
      }, 5000);
      return;
    }
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    clearInterval(stepTimer);
    stepTimer = 0;
  }

  host.addEventListener('pointerenter', () => { hover = true; });
  host.addEventListener('pointerleave', () => { hover = false; });
  watchVisibility(canvas, (v) => { visible = v; v ? start() : stop(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new ResizeObserver(() => { resize(); if (reduce) showMark(); }).observe(canvas);
  document.fonts?.ready.then(() => { rasterize(); reduce ? showMark() : draw(); });

  return {
    setText(t) {
      text = t;
      rasterize();
      mark = 0;
      if (reduce) showMark();
      else {
        offset = Math.min(offset, cols);
        draw();
      }
    },
  };
}
