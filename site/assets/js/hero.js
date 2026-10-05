// Accueil : circuit imprimé généré à la volée.
// - des impulsions de courant parcourent les pistes ;
// - le curseur agit comme une loupe qui révèle le cuivre sous le vernis ;
// - un clic envoie une onde de choc et des impulsions depuis ce point.

import { $, el, mulberry32, reducedMotion, watchVisibility } from './util.js';
import { sfx } from './audio.js';

const G = 22; // pas de la grille (px)
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export function initHero() {
  const hero = $('.hero');
  const canvas = $('.hero-canvas', hero ?? document);
  if (!hero || !canvas) return;

  splitName();
  typeRole();

  const ctx = canvas.getContext('2d');
  const dimC = document.createElement('canvas');
  const litC = document.createElement('canvas');
  const fxC = document.createElement('canvas');
  const glow = makeGlowSprite();
  const still = reducedMotion();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let traces = [];
  let parts = [];
  let chip = null;
  let pulses = [];
  let surges = [];
  let flashes = [];
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, on: false, a: 0 };
  let running = false;
  let inView = true;
  let raf = 0;
  let last = 0;

  /* ---------- Génération du circuit ---------- */
  function generate() {
    const rnd = mulberry32(2026);
    const cols = Math.ceil(W / G) + 1;
    const rows = Math.ceil(H / G) + 1;
    const occ = new Uint8Array(cols * rows);
    const id = (c, r) => r * cols + c;
    const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
    const free = (c, r) => inside(c, r) && !occ[id(c, r)];
    traces = [];
    parts = [];
    chip = null;

    const walk = (c, r, d, minL, maxL, head = null) => {
      if (!free(c, r)) return;
      const cells = [[c, r]];
      occ[id(c, r)] = 1;
      const len = minL + Math.floor(rnd() * (maxL - minL));
      let straight = 0;
      for (let s = 0; s < len; s++) {
        const turn = straight > 2 && rnd() < 0.2 ? (d + (rnd() < 0.5 ? 1 : 7)) % 8 : d;
        let moved = false;
        for (const cand of [turn, d, (d + 1) % 8, (d + 7) % 8]) {
          const [dc, dr] = DIRS[cand];
          const nc = c + dc;
          const nr = r + dr;
          if (!free(nc, nr)) continue;
          if (dc && dr && occ[id(c + dc, r)] && occ[id(c, r + dr)]) continue; // pas de croisement
          straight = cand === d ? straight + 1 : 0;
          c = nc;
          r = nr;
          d = cand;
          occ[id(c, r)] = 1;
          cells.push([c, r]);
          moved = true;
          break;
        }
        if (!moved) break;
      }
      if (cells.length < minL) {
        for (const [cc, rr] of cells) occ[id(cc, rr)] = 0;
        return;
      }
      const pts = head ? [head] : [];
      cells.forEach(([cc, rr], i) => {
        if (i > 0 && i < cells.length - 1) {
          const [pc, pr] = cells[i - 1];
          const [nc, nr] = cells[i + 1];
          if (cc - pc === nc - cc && rr - pr === nr - rr) return; // point aligné : inutile
        }
        pts.push({ x: cc * G, y: rr * G });
      });
      traces.push(makeTrace(pts, head ? 'none' : rnd() < 0.5 ? 'pad' : 'via', rnd() < 0.55 ? 'pad' : 'via', !!head));
    };

    // Puce centrale : seulement s'il reste de la place à droite du nom
    const size = W > 1400 ? 10 : 8;
    const name = $('.hero-name-fx');
    const textRight = name ? name.getBoundingClientRect().right - hero.getBoundingClientRect().left : W * 0.6;
    const room = W - textRight;
    if (room >= size * G + 140) {
      const cc = Math.round((textRight + room / 2) / G) - size / 2;
      const cr = Math.round((H * 0.48) / G) - size / 2;
      chip = { x: (cc - 0.5) * G, y: (cr - 0.5) * G, s: size * G, cc, cr, size };
      for (let r = cr - 1; r <= cr + size; r++) for (let c = cc - 1; c <= cc + size; c++) if (inside(c, r)) occ[id(c, r)] = 1;
      for (let k = 0; k < size; k++) {
        walk(cc + size + 1, cr + k, 0, 3, 24, { x: chip.x + chip.s, y: (cr + k) * G });
        walk(cc - 2, cr + k, 4, 3, 24, { x: chip.x, y: (cr + k) * G });
        walk(cc + k, cr - 2, 6, 3, 18, { x: (cc + k) * G, y: chip.y });
        walk(cc + k, cr + size + 1, 2, 3, 18, { x: (cc + k) * G, y: chip.y + chip.s });
      }
    }

    // Composants CMS (deux pastilles + corps)
    const nParts = Math.round((W * H) / 52000);
    for (let i = 0, tries = 0; i < nParts && tries < nParts * 20; tries++) {
      const c = 1 + Math.floor(rnd() * (cols - 3));
      const r = 1 + Math.floor(rnd() * (rows - 2));
      if (!free(c, r) || !free(c + 1, r)) continue;
      occ[id(c, r)] = occ[id(c + 1, r)] = 1;
      const kind = rnd() < 0.6 ? 'R' : 'C';
      parts.push({ x: c * G, y: r * G, kind, label: `${kind}${1 + Math.floor(rnd() * 48)}` });
      i++;
    }

    // Pistes aléatoires
    const target = Math.round((cols * rows) / 15) + traces.length;
    for (let tries = 0; traces.length < target && tries < cols * rows; tries++) {
      walk(Math.floor(rnd() * cols), Math.floor(rnd() * rows), Math.floor(rnd() * 8), 4, 18);
    }
  }

  function makeTrace(pts, start, end, fromChip) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, len: cum[cum.length - 1], start, end, fromChip };
  }

  function pointAt(tr, s) {
    const { pts, cum } = tr;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
  }

  /* ---------- Rendu des calques fixes ---------- */
  function paint(g, lit) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    g.lineWidth = lit ? 2.4 : 2.2;
    g.strokeStyle = lit ? '#ffb35c' : 'rgba(110, 215, 170, 0.15)';
    if (lit) { g.shadowColor = 'rgba(255, 140, 40, 0.9)'; g.shadowBlur = 8; }
    for (const t of traces) {
      g.beginPath();
      g.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < t.pts.length; i++) g.lineTo(t.pts[i].x, t.pts[i].y);
      g.stroke();
    }
    g.shadowBlur = 0;

    const padColor = lit ? '#ffe2a8' : 'rgba(216, 178, 90, 0.4)';
    const drawEnd = (p, kind) => {
      if (kind === 'pad') {
        g.fillStyle = padColor;
        g.beginPath(); g.arc(p.x, p.y, 3.8, 0, Math.PI * 2); g.fill();
      } else if (kind === 'via') {
        g.strokeStyle = padColor;
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#081b16';
        g.beginPath(); g.arc(p.x, p.y, 1.8, 0, Math.PI * 2); g.fill();
      }
    };
    for (const t of traces) {
      drawEnd(t.pts[0], t.start);
      drawEnd(t.pts[t.pts.length - 1], t.end);
    }

    for (const p of parts) {
      g.fillStyle = padColor;
      g.fillRect(p.x - 5, p.y - 5, 8, 10);
      g.fillRect(p.x + G - 3, p.y - 5, 8, 10);
      g.fillStyle = p.kind === 'R'
        ? (lit ? '#2b2b2b' : 'rgba(25, 30, 28, 0.75)')
        : (lit ? '#c99b62' : 'rgba(160, 120, 70, 0.4)');
      g.fillRect(p.x + 3, p.y - 4, G - 6, 8);
      if (!lit) {
        g.fillStyle = 'rgba(241, 245, 239, 0.18)';
        g.font = '600 8px "JetBrains Mono", monospace';
        g.fillText(p.label, p.x - 2, p.y - 9);
      }
    }

    if (chip) {
      const { x, y, s, size } = chip;
      g.fillStyle = lit ? '#e8eaea' : 'rgba(200, 205, 202, 0.45)';
      for (let k = 0; k < size; k++) {
        const o = (k + 0.5) * G - 3;
        g.fillRect(x + o, y - 8, 6, 10);
        g.fillRect(x + o, y + s - 2, 6, 10);
        g.fillRect(x - 8, y + o, 10, 6);
        g.fillRect(x + s - 2, y + o, 10, 6);
      }
      if (lit) { g.shadowColor = 'rgba(255, 140, 40, 0.8)'; g.shadowBlur = 18; }
      const grad = g.createLinearGradient(x, y, x, y + s);
      grad.addColorStop(0, '#2b2f2f');
      grad.addColorStop(1, '#0f1111');
      g.fillStyle = grad;
      roundRect(g, x, y, s, s, 8);
      g.fill();
      g.shadowBlur = 0;
      if (lit) { g.strokeStyle = 'rgba(255, 179, 92, 0.7)'; g.lineWidth = 2; roundRect(g, x, y, s, s, 8); g.stroke(); }
      g.fillStyle = '#0a0b0b';
      g.beginPath(); g.arc(x + 18, y + 18, 6, 0, Math.PI * 2); g.fill();
      g.textAlign = 'center';
      g.fillStyle = lit ? '#ffd29a' : 'rgba(200, 206, 202, 0.75)';
      g.font = `700 ${Math.round(s / 7.5)}px "JetBrains Mono", monospace`;
      g.fillText('AT-2026', x + s / 2, y + s / 2 + 2);
      g.font = `600 ${Math.round(s / 15)}px "JetBrains Mono", monospace`;
      g.fillStyle = lit ? '#ffb35c' : 'rgba(150, 160, 155, 0.7)';
      g.fillText('REPAIR · FR-17', x + s / 2, y + s / 2 + s / 6);
      g.textAlign = 'start';
    }
  }

  /* ---------- Animation ---------- */
  function spawnPulse(tr, s = null, dir = null, speed = null) {
    const d = dir ?? (tr.fromChip || Math.random() < 0.5 ? 1 : -1);
    pulses.push({
      tr,
      s: s ?? (d === 1 ? 0 : tr.len),
      dir: d,
      v: speed ?? 80 + Math.random() * 160,
      tail: 28 + Math.random() * 60,
    });
  }

  function update(dt) {
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 14);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 14);
    mouse.a += ((mouse.on ? 1 : 0) - mouse.a) * Math.min(1, dt * 6);

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.s += p.dir * p.v * dt;
      if (p.s > p.tr.len || p.s < 0) {
        const end = p.dir === 1 ? p.tr.pts[p.tr.pts.length - 1] : p.tr.pts[0];
        flashes.push({ x: end.x, y: end.y, life: 1 });
        pulses.splice(i, 1);
      }
    }
    const wanted = Math.min(70, Math.round(traces.length * 0.28));
    if (pulses.length < wanted && Math.random() < 0.4 && traces.length) {
      spawnPulse(traces[Math.floor(Math.random() * traces.length)]);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].life -= dt * 2.4;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
    for (let i = surges.length - 1; i >= 0; i--) {
      const s = surges[i];
      s.r += 560 * dt;
      s.life -= dt * 0.95;
      if (s.life <= 0) surges.splice(i, 1);
    }
  }

  function reveal(x, y, r, w, alpha) {
    const outer = r ? r + 12 : w;
    const x0 = Math.max(0, Math.floor((x - outer) * dpr));
    const y0 = Math.max(0, Math.floor((y - outer) * dpr));
    const x1 = Math.min(fxC.width, Math.ceil((x + outer) * dpr));
    const y1 = Math.min(fxC.height, Math.ceil((y + outer) * dpr));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;
    const g = fxC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(x0, y0, bw, bh);
    g.drawImage(litC, x0, y0, bw, bh, x0, y0, bw, bh);
    g.globalCompositeOperation = 'destination-in';
    const cx = x * dpr;
    const cy = y * dpr;
    let grad;
    if (!r) {
      grad = g.createRadialGradient(cx, cy, 0, cx, cy, w * dpr);
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.8})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grad = g.createRadialGradient(cx, cy, Math.max(0, r - w) * dpr, cx, cy, outer * dpr);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.82, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    g.fillStyle = grad;
    g.fillRect(x0, y0, bw, bh);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(fxC, x0, y0, bw, bh, x0, y0, bw, bh);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(dimC, 0, 0);
    if (mouse.a > 0.01) reveal(mouse.sx, mouse.sy, 0, 170, mouse.a);
    for (const s of surges) reveal(s.x, s.y, s.r, 80, Math.max(0, s.life));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pulses) {
      const N = 9;
      for (let k = N; k >= 1; k--) {
        const s = p.s - p.dir * (k / N) * p.tail;
        if (s < 0 || s > p.tr.len) continue;
        const pt = pointAt(p.tr, s);
        const a = 1 - k / (N + 1);
        ctx.fillStyle = `rgba(255, ${(150 + 80 * a) | 0}, ${(70 + 110 * a) | 0}, ${(a * 0.85).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 0.8 + 1.8 * a, 0, Math.PI * 2);
        ctx.fill();
      }
      const head = pointAt(p.tr, p.s);
      ctx.drawImage(glow, head.x - 14, head.y - 14, 28, 28);
    }
    for (const f of flashes) {
      const s = 18 + (1 - f.life) * 22;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.drawImage(glow, f.x - s, f.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || still || !inView || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function build() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [canvas, dimC, litC, fxC]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    generate();
    paint(dimC.getContext('2d'), false);
    paint(litC.getContext('2d'), true);
    pulses = [];
    surges = [];
    flashes = [];
    if (!still) for (let i = 0; i < Math.min(30, traces.length * 0.2); i++) {
      const tr = traces[Math.floor(Math.random() * traces.length)];
      spawnPulse(tr, Math.random() * tr.len);
    }
    draw();
  }

  /* ---------- Interactions ---------- */
  const local = (e) => {
    const r = hero.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  hero.addEventListener('pointermove', (e) => {
    const p = local(e);
    mouse.x = p.x;
    mouse.y = p.y;
    if (!mouse.on && !running) { mouse.sx = p.x; mouse.sy = p.y; }
    mouse.on = true;
    if (still) { mouse.sx = p.x; mouse.sy = p.y; mouse.a = 1; requestAnimationFrame(draw); }
  });
  hero.addEventListener('pointerleave', () => {
    mouse.on = false;
    if (still) { mouse.a = 0; requestAnimationFrame(draw); }
  });
  hero.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const p = local(e);
    sfx('zap');
    if (still) return;
    surges.push({ x: p.x, y: p.y, r: 0, life: 1 });
    let count = 0;
    for (const tr of traces) {
      if (count >= 10) break;
      let best = -1;
      let bestD = 150;
      tr.pts.forEach((pt, i) => {
        const d = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) continue;
      const s = tr.cum[best];
      spawnPulse(tr, s, 1, 260 + Math.random() * 120);
      spawnPulse(tr, s, -1, 260 + Math.random() * 120);
      count++;
    }
  });

  watchVisibility(hero, (v) => { inView = v; v ? start() : stop(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  let resizeTimer = 0;
  let lastW = 0;
  new ResizeObserver(() => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    if (Math.abs(w - lastW) < 2 && Math.abs(h - H) < 60) return; // barre d'adresse mobile : on ignore
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { lastW = w; build(); }, 160);
  }).observe(hero);

  lastW = hero.clientWidth;
  build();
  // Les polices changent la largeur du nom (et donc la place de la puce) : on régénère
  document.fonts?.ready.then(build);
  start();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function makeGlowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 246, 220, 1)');
  grad.addColorStop(0.25, 'rgba(255, 190, 110, 0.65)');
  grad.addColorStop(1, 'rgba(255, 120, 30, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function splitName() {
  const fx = $('.hero-name-fx');
  if (!fx) return;
  const words = fx.textContent.trim().split(/\s+/);
  fx.textContent = '';
  let i = 0;
  words.forEach((word, wi) => {
    const w = el('span', { cls: 'w' });
    for (const ch of word) {
      const s = el('span', { cls: 'ch', text: ch });
      s.style.setProperty('--i', String(i++));
      w.appendChild(s);
    }
    fx.appendChild(w);
    if (wi < words.length - 1) fx.appendChild(document.createTextNode(' '));
  });
}

function typeRole() {
  const fx = $('.hero-role-fx');
  if (!fx || reducedMotion()) return;
  const full = fx.textContent.trim();
  fx.textContent = '';
  let i = 0;
  const step = () => {
    fx.textContent = full.slice(0, ++i);
    if (i < full.length) setTimeout(step, 26 + Math.random() * 42);
  };
  setTimeout(step, 1100);
}
