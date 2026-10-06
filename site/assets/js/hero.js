// Accueil : circuit imprimé généré à la volée.
// - des impulsions de courant parcourent les pistes ;
// - le curseur agit comme une loupe qui révèle le cuivre sous le vernis ;
// - un clic envoie une onde de choc et des impulsions depuis ce point.

import { $, el, mulberry32, reducedMotion, watchVisibility } from './util.js';
import { sfx } from './audio.js';
import { discover } from './hud.js';

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
  let link = null; // nappe entre la carte d'infos et le connecteur J3 du fond
  let broken = null; // piste coupée (secret)
  let traceFixed = false;
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

    // Carte fille (bloc d'infos, sur ordinateur) : un connecteur J3 est soudé sur le fond,
    // relié au connecteur de la carte par une nappe. Sur téléphone, le connecteur est masqué.
    const hr = hero.getBoundingClientRect();
    const card = $('.info-board', hero);
    const conn = $('.ib-conn', hero);
    link = null;
    let reserveRight = 0;
    if (card && conn && conn.offsetParent !== null) {
      const kr = card.getBoundingClientRect();
      const c2 = conn.getBoundingClientRect();
      const connH = c2.height;
      const fromX = c2.right - hr.left;
      const midY = c2.top + connH / 2 - hr.top;
      const PINS = 5;
      const hc = Math.round((kr.right - hr.left + 170) / G);
      const r0 = Math.round(midY / G) - 2;
      if (hc + 3 < cols && r0 > 1 && r0 + PINS < rows) {
        // J3 : même taille que le connecteur de la carte, à la même hauteur (la nappe reste droite)
        const box = { x: hc * G - 12, y: midY - connH / 2, w: 24, h: connH };
        const rTop = Math.floor(box.y / G) - 1;
        const rBot = Math.ceil((box.y + box.h) / G) + 1;
        const cFrom = Math.floor(fromX / G);
        for (let r = rTop; r <= rBot; r++) for (let c = cFrom; c <= hc + 1; c++) if (inside(c, r)) occ[id(c, r)] = 1;
        link = { fromX, midY, connH, box, pins: [] };
        for (let k = 0; k < PINS; k++) {
          const p = { x: hc * G, y: (r0 + k) * G };
          link.pins.push(p);
          walk(hc + 2, r0 + k, 0, 4, 22, { x: p.x + 12, y: p.y });
        }
        reserveRight = 250;
      }
    }

    // Puce centrale : seulement s'il reste de la place à droite de la carte (et de la nappe)
    const size = W > 1400 ? 10 : 8;
    const textRight = card ? card.getBoundingClientRect().right - hr.left + reserveRight : W * 0.6;
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

    pickBrokenTrace();
  }

  // Secret : une piste est coupée. Invisible sous le vernis, visible seulement sous la sonde.
  function pickBrokenTrace() {
    broken = null;
    const hr = hero.getBoundingClientRect();
    const blocks = ['.info-board', '.hero-hint', '.hero-scroll']
      .map((s) => $(s, hero)?.getBoundingClientRect())
      .filter((r) => r && r.width)
      .map((r) => ({ l: r.left - hr.left - 30, t: r.top - hr.top - 30, r: r.right - hr.left + 30, b: r.bottom - hr.top + 30 }));
    if (chip) blocks.push({ l: chip.x - 30, t: chip.y - 30, r: chip.x + chip.s + 30, b: chip.y + chip.s + 30 });
    if (link) {
      // Ni sous la nappe ni sous le connecteur
      const xs = [link.fromX, link.box.x + link.box.w + 12];
      const ys = [link.box.y, link.box.y + link.box.h];
      blocks.push({ l: Math.min(...xs) - 40, t: Math.min(...ys) - 40, r: Math.max(...xs) + 40, b: Math.max(...ys) + 40 });
    }
    const free = (p) => p.x > 40 && p.x < W - 40 && p.y > 90 && p.y < H - 60 && !blocks.some((b) => p.x > b.l && p.x < b.r && p.y > b.t && p.y < b.b);
    let best = null;
    for (const tr of traces) {
      if (tr.len < 120) continue;
      const s = tr.len / 2;
      const p = pointAt(tr, s);
      if (free(p) && (!best || tr.len > best.tr.len)) best = { tr, s, x: p.x, y: p.y };
    }
    if (best) broken = { ...best, fixed: traceFixed };
  }

  // Dessine seulement la portion [s0, s1] d'une piste
  function strokeSub(g, tr, s0, s1) {
    const a = pointAt(tr, s0);
    g.beginPath();
    g.moveTo(a.x, a.y);
    for (let i = 1; i < tr.pts.length; i++) {
      if (tr.cum[i] > s0 && tr.cum[i] < s1) g.lineTo(tr.pts[i].x, tr.pts[i].y);
    }
    const b = pointAt(tr, s1);
    g.lineTo(b.x, b.y);
    g.stroke();
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
      if (lit && broken && !broken.fixed && t === broken.tr) {
        strokeSub(g, t, 0, broken.s - 10);
        strokeSub(g, t, broken.s + 10, t.len);
        continue;
      }
      g.beginPath();
      g.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < t.pts.length; i++) g.lineTo(t.pts[i].x, t.pts[i].y);
      g.stroke();
    }
    g.shadowBlur = 0;

    if (broken) {
      const { x, y } = broken;
      if (!broken.fixed && lit) {
        // Coupure brûlée : trou sombre, bords rougis, petite fissure
        g.fillStyle = '#140805';
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255, 75, 58, 0.95)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255, 200, 150, 0.8)';
        g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x - 1, y - 1); g.lineTo(x - 3, y + 2); g.lineTo(x + 1, y + 6); g.stroke();
      } else if (broken.fixed) {
        // Réparée : petit pont de soudure brillant
        g.fillStyle = lit ? '#f4f6f4' : 'rgba(220, 225, 222, 0.45)';
        g.beginPath(); g.ellipse(x, y, 7, 4.5, 0, 0, Math.PI * 2); g.fill();
      }
    }

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

    // Connecteur J3 : ses pattes soudées sortent à droite (le boîtier est dessiné en SVG, par-dessus la nappe)
    if (link) {
      const { box, pins } = link;
      g.fillStyle = lit ? '#ffe2a8' : 'rgba(216, 178, 90, 0.75)';
      for (const p of pins) g.fillRect(box.x + box.w - 2, p.y - 3, 10, 6);
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
      const before = p.s;
      p.s += p.dir * p.v * dt;
      // Sur la piste coupée, le courant s'arrête net à la coupure (petite étincelle)
      if (broken && !broken.fixed && p.tr === broken.tr && (before - broken.s) * (p.s - broken.s) <= 0) {
        flashes.push({ x: broken.x, y: broken.y, life: 0.8 });
        pulses.splice(i, 1);
        continue;
      }
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
    // Piste coupée : petites étincelles qui crépitent, seulement quand la sonde s'en approche
    if (broken && !broken.fixed && mouse.a > 0.05) {
      const d = Math.hypot(mouse.sx - broken.x, mouse.sy - broken.y);
      if (d < 170) {
        const a = mouse.a * (1 - d / 170);
        for (let k = 0; k < 5; k++) {
          if (Math.random() > 0.6) continue;
          const ang = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * 10;
          ctx.fillStyle = `rgba(255, ${(140 + Math.random() * 110) | 0}, 70, ${a.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(broken.x + Math.cos(ang) * r, broken.y + Math.sin(ang) * r, 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = a * (0.4 + Math.random() * 0.4);
        ctx.drawImage(glow, broken.x - 14, broken.y - 14, 28, 28);
      }
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
    drawRibbon();
    pulses = [];
    surges = [];
    flashes = [];
    if (!still) for (let i = 0; i < Math.min(30, traces.length * 0.2); i++) {
      const tr = traces[Math.floor(Math.random() * traces.length)];
      spawnPulse(tr, Math.random() * tr.len);
    }
    draw();
  }

  // Nappe souple (FFC) entre le connecteur de la carte d'infos et J3, en SVG au-dessus du circuit
  function drawRibbon() {
    const ribbon = $('.hero-ribbon', hero);
    if (!ribbon) return;
    ribbon.replaceChildren();
    ribbon.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!link) return;
    const { fromX, midY, connH, box } = link;
    const rw = connH - 10; // la nappe est à peine moins large que ses connecteurs
    const top = midY - rw / 2;
    const x0 = fromX - 8; // les extrémités glissent sous les deux connecteurs
    const x1 = box.x + 8;

    // Dégradé : plus clair au milieu, comme une nappe qui se soulève en arc
    const defs = svgEl('defs', {}, ribbon);
    const grad = svgEl('linearGradient', { id: 'rb-shade', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    [['0', '#9c5414'], ['0.18', '#d9852c'], ['0.5', '#f6b25c'], ['0.82', '#d9852c'], ['1', '#9c5414']]
      .forEach(([o, c]) => svgEl('stop', { offset: o, 'stop-color': c }, grad));

    svgEl('rect', { class: 'rb-shadow', x: x0 + 10, y: top + 10, width: x1 - x0 - 20, height: rw, rx: 4 }, ribbon);
    svgEl('rect', { class: 'rb-film', x: x0, y: top, width: x1 - x0, height: rw, fill: 'url(#rb-shade)' }, ribbon);
    for (let y = top + 5; y <= top + rw - 5; y += 4.6) {
      svgEl('line', { class: 'rb-wire', x1: x0, x2: x1, y1: y.toFixed(1), y2: y.toFixed(1) }, ribbon);
    }
    svgEl('line', { class: 'rb-pin1', x1: x0, x2: x1, y1: top + 2, y2: top + 2 }, ribbon);
    for (let k = 1; k <= 3; k++) {
      const y = (top + (rw * k) / 4).toFixed(1);
      svgEl('line', { class: 'rb-data', x1: x0, x2: x1, y1: y, y2: y }, ribbon);
    }
    // Renforts bleus aux extrémités (comme sur les vraies nappes FFC)
    svgEl('rect', { class: 'rb-stiff', x: x0, y: top, width: 22, height: rw }, ribbon);
    svgEl('rect', { class: 'rb-stiff', x: x1 - 22, y: top, width: 22, height: rw }, ribbon);

    // Boîtier de J3 par-dessus la nappe, avec son levier de verrouillage
    svgEl('rect', { class: 'rb-conn', x: box.x, y: box.y, width: box.w, height: box.h, rx: 3 }, ribbon);
    svgEl('rect', { class: 'rb-latch', x: box.x - 3, y: box.y + 4, width: 6, height: box.h - 8, rx: 2 }, ribbon);
    const label = svgEl('text', { class: 'rb-label', x: box.x - 4, y: box.y - 8 }, ribbon);
    label.textContent = 'J3';
  }
  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.appendChild(n);
    return n;
  };

  /* ---------- Interactions ---------- */
  const local = (e) => {
    const r = hero.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  hero.addEventListener('pointermove', (e) => {
    const p = local(e);
    // Au-dessus de la coupure, le curseur devient un fer à souder
    hero.classList.toggle('is-solder', !!broken && !broken.fixed && Math.hypot(p.x - broken.x, p.y - broken.y) < 26);
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
    if (e.target.closest('a, button, .info-board')) return;
    const p = local(e);

    // Clic sur la coupure : on la répare (secret)
    if (broken && !broken.fixed && Math.hypot(p.x - broken.x, p.y - broken.y) < 26) {
      broken.fixed = traceFixed = true;
      hero.classList.remove('is-solder');
      paint(dimC.getContext('2d'), false);
      paint(litC.getContext('2d'), true);
      sfx('tink');
      discover('trace');
      flashes.push({ x: broken.x, y: broken.y, life: 1 });
      if (!still) {
        for (let k = 0; k < 3; k++) {
          spawnPulse(broken.tr, broken.s, 1, 200 + k * 60);
          spawnPulse(broken.tr, broken.s, -1, 200 + k * 60);
        }
      }
      draw();
      return;
    }

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

  // Le circuit (calcul assez lourd) est généré juste après le premier affichage :
  // le nom et le texte apparaissent sans attendre.
  requestAnimationFrame(() => setTimeout(() => {
    lastW = hero.clientWidth;
    build();
    start();
    // Les polices changent la largeur du nom (et donc la place de la puce) : on régénère
    document.fonts?.ready.then(build);
  }, 0));
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
  const tag = $('.role-tag');
  if (!fx || reducedMotion()) {
    tag?.classList.add('is-on');
    return;
  }
  // Le texte complet garde sa place dès le départ (lettres non tapées invisibles) :
  // la largeur de la carte d'infos ne bouge donc pas pendant la frappe.
  const full = fx.textContent.trim();
  const typed = el('span', { cls: 'typed' });
  const rest = el('span', { cls: 'rest', text: full });
  fx.replaceChildren(typed, rest);
  fx.classList.add('is-typing');
  let i = 0;
  const step = () => {
    i++;
    typed.textContent = full.slice(0, i);
    rest.textContent = full.slice(i);
    if (i < full.length) setTimeout(step, 26 + Math.random() * 42);
    else setTimeout(() => tag?.classList.add('is-on'), 250); // l'étiquette s'allume après la frappe
  };
  setTimeout(step, 1100);
}
