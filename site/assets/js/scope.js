// Parcours : un oscilloscope 2 voies.
// CH1 = expériences, CH2 = formations. Chaque période est une impulsion ;
// on la mesure avec les curseurs A/B (Δt) et on zoome avec TIME/DIV.

import { $, $$, svg, el, clamp, mulberry32, reducedMotion, watchVisibility } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

const T_MIN = 2008;
const T_MAX = 2028;
const LEVELS = [
  { span: 20, div: 2, label: '2 ans' },
  { span: 10, div: 1, label: '1 an' },
  { span: 5, div: 0.5, label: '6 mois' },
];
const KNOB = [-45, 0, 45];

export function initScope() {
  const root = $('.scope');
  if (!root) return;
  const screen = $('.scope-screen', root);
  const svgEl = $('.scope-svg', root);
  const readout = $('.scope-readout', root);
  const knob = $('[data-knob]', root);
  const timeLabel = $('[data-timediv]', root);
  const items = $$('.tl-item');
  const events = items.map(parseItem);
  const reduce = reducedMotion();

  const st = { level: 0, center: 2018, ch: { 1: true, 2: true }, sel: null, measured: new Set(), seen: false };
  let W = 1000;
  let H = 380;
  let t0 = T_MIN;
  let span = 20;
  let paths = [];
  let beam = null;

  const X = (t) => ((t - t0) / span) * W;
  const lanes = () => ({
    1: { base: H * 0.42, hi: H * 0.42 - H * 0.2 },
    2: { base: H * 0.84, hi: H * 0.84 - H * 0.2 },
  });

  function setRange() {
    const L = LEVELS[st.level];
    span = L.span;
    let start = Math.round((st.center - span / 2) / L.div) * L.div;
    t0 = clamp(start, T_MIN, T_MAX - span);
  }

  function buildPath(ch) {
    const { base, hi } = lanes()[ch];
    const evs = events
      .filter((e) => e.ch === ch && e.kind !== 'continuous')
      .map((e) => ({ x0: X(e.start), x1: Math.max(X(e.end), X(e.start) + 5) }));
    const ripple = ch === 1 && events.some((e) => e.ch === 1 && e.kind === 'continuous') ? 2.4 : 0;
    const edges = evs.flatMap((v) => [{ x: v.x0, up: true }, { x: v.x1, up: false }]);
    const xs = new Set();
    for (let x = 0; x <= W; x += 4) xs.add(x);
    for (const ed of edges) {
      if (ed.x <= 0 || ed.x >= W) continue;
      xs.add(ed.x - 0.01);
      xs.add(ed.x + 0.01);
      for (let k = 1; k <= 16; k++) xs.add(ed.x + k * 1.6);
    }
    const rnd = mulberry32(ch * 97);
    const pts = [...xs].filter((x) => x >= 0 && x <= W).sort((a, b) => a - b).map((x) => {
      let y = evs.some((v) => x >= v.x0 && x <= v.x1) ? hi : base;
      for (const ed of edges) {
        const d = x - ed.x;
        if (d > 0 && d < 30) y += (ed.up ? -1 : 1) * 6 * Math.exp(-d / 6) * Math.cos(d / 2.1);
      }
      y += (rnd() - 0.5) * 1.3 + ripple * Math.sin(x / 7);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M${pts.join(' L')}`;
  }

  function render() {
    W = Math.max(280, Math.round(screen.clientWidth));
    H = Math.round(clamp(W * 0.4, 230, 380));
    setRange();
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.replaceChildren();

    const defs = svg('defs', {}, svgEl);
    const f = svg('filter', { id: 'phosphor', x: '-10%', y: '-30%', width: '120%', height: '160%' }, defs);
    svg('feGaussianBlur', { stdDeviation: 3 }, f);

    // Graticule
    const grat = svg('g', { class: 'grat' }, svgEl);
    for (let k = 1; k < 10; k++) svg('line', { x1: (W * k) / 10, x2: (W * k) / 10, y1: 0, y2: H, class: k === 5 ? 'axis' : '' }, grat);
    for (let k = 1; k < 8; k++) svg('line', { x1: 0, x2: W, y1: (H * k) / 8, y2: (H * k) / 8, class: k === 4 ? 'axis' : '' }, grat);
    for (let k = 1; k < 50; k++) svg('line', { x1: (W * k) / 50, x2: (W * k) / 50, y1: H / 2 - 3, y2: H / 2 + 3, class: 'tick' }, grat);
    for (let k = 1; k < 40; k++) svg('line', { x1: W / 2 - 3, x2: W / 2 + 3, y1: (H * k) / 40, y2: (H * k) / 40, class: 'tick' }, grat);

    // Années
    const L = LEVELS[st.level];
    for (let k = 0; k < 10; k++) {
      const t = t0 + k * L.div;
      const lbl = Number.isInteger(t) ? String(t) : `mi-${Math.floor(t)}`;
      svg('text', { class: 'axis-label', x: (W * k) / 10 + 4, y: H - 6 }, svgEl).textContent = lbl;
    }

    // Curseurs de mesure (sous les traces)
    const sel = st.sel !== null ? events[st.sel] : null;
    if (sel) {
      const g = svg('g', {}, svgEl);
      if (sel.kind === 'continuous') {
        svg('rect', { class: 'cursor-band', x: 0, y: 0, width: W, height: H }, g);
      } else {
        const xa = X(sel.start);
        const xb = Math.max(X(sel.end), xa + 5);
        svg('rect', { class: 'cursor-band', x: xa, y: 0, width: Math.max(1, xb - xa), height: H }, g);
        svg('line', { class: 'cursor-line', x1: xa, x2: xa, y1: 0, y2: H }, g);
        svg('line', { class: 'cursor-line', x1: xb, x2: xb, y1: 0, y2: H }, g);
        svg('text', { class: 'cursor-label', x: xa - 12, y: 14 }, g).textContent = 'A';
        svg('text', { class: 'cursor-label', x: xb + 4, y: 14 }, g).textContent = 'B';
      }
    }

    // Traces
    paths = [];
    const lane = lanes();
    for (const ch of [1, 2]) {
      const g = svg('g', { class: `scope-ch-g ch${ch}${st.ch[ch] ? '' : ' is-off'}` }, svgEl);
      const d = buildPath(ch);
      const glow = svg('path', { class: 'trace-glow', d, filter: 'url(#phosphor)' }, g);
      const line = svg('path', { class: 'trace-line', d }, g);
      paths.push({ ch, glow, line });
      const mark = svg('text', { class: 'ch-mark', x: 6, y: lane[ch].base - 8 }, g);
      mark.textContent = `${ch}▸`;

      events.forEach((e, i) => {
        if (e.ch !== ch || e.kind === 'continuous') return;
        const x0 = X(e.start);
        const x1 = Math.max(X(e.end), x0 + 5);
        if (x1 < 0 || x0 > W) return;
        const tag = svg('text', { class: 'ev-tag', x: (x0 + x1) / 2, y: lane[ch].hi - 12, 'text-anchor': 'middle' }, g);
        tag.textContent = i === st.sel ? '▼' : '▿';
        const hit = svg('rect', {
          class: 'ev-hit',
          x: x0 - 8,
          y: lane[ch].hi - 26,
          width: Math.max(18, x1 - x0 + 16),
          height: lane[ch].base - lane[ch].hi + 36,
        }, g);
        hit.addEventListener('click', () => select(i));
        const title = svg('title', {}, hit);
        title.textContent = e.title;
      });
    }
    beam = svg('circle', { class: 'beam', r: 3.5, cx: -10, cy: -10, filter: 'url(#phosphor)' }, svgEl);
  }

  function renderReadout() {
    readout.replaceChildren();
    if (st.sel === null) return;
    const e = events[st.sel];
    readout.append(
      el('span', { cls: `ro-ch c${e.ch}`, text: e.ch === 1 ? 'CH1 · EXPÉRIENCE' : 'CH2 · FORMATION' }),
      el('span', { cls: 'ro-title', text: e.title }),
    );
    if (e.org) readout.append(el('span', { text: e.org }));
    readout.append(el('span', { text: e.label }));
    const dt = durationText(e);
    if (dt) readout.append(el('span', { cls: 'ro-dt', text: `Δt = ${dt}` }));
    if (e.kind === 'continuous') readout.append(el('span', { cls: 'ro-dt', text: 'Ondulation permanente sur CH1' }));
  }

  /* ---------- Animations du faisceau ---------- */
  function sweep(dur = 1500) {
    if (reduce) return;
    for (const { line, glow } of paths) {
      const len = line.getTotalLength();
      for (const p of [line, glow]) {
        p.style.strokeDasharray = `${len}`;
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, easing: 'cubic-bezier(.45,.05,.4,1)' });
      }
    }
    runBeam(dur);
  }

  let beamRaf = 0;
  function runBeam(dur) {
    cancelAnimationFrame(beamRaf);
    const visible = paths.filter((p) => st.ch[p.ch]);
    if (!visible.length || !beam) return;
    const t0b = performance.now();
    const lens = visible.map((p) => p.line.getTotalLength());
    const step = (t) => {
      const k = clamp((t - t0b) / dur, 0, 1);
      const idx = Math.min(visible.length - 1, Math.floor(k * visible.length));
      const local = k * visible.length - idx;
      const pt = visible[idx].line.getPointAtLength(lens[idx] * Math.min(1, local));
      beam.setAttribute('cx', pt.x);
      beam.setAttribute('cy', pt.y);
      if (k < 1) beamRaf = requestAnimationFrame(step);
      else beam.setAttribute('cx', -10);
    };
    beamRaf = requestAnimationFrame(step);
  }

  let idleTimer = 0;
  function idle(on) {
    clearInterval(idleTimer);
    if (on && !reduce) idleTimer = setInterval(() => runBeam(2600), 7000);
  }

  /* ---------- Interactions ---------- */
  function select(i, { user = true } = {}) {
    st.sel = i;
    const e = events[i];
    items.forEach((li, k) => li.classList.toggle('is-selected', k === i));
    if (e.kind !== 'continuous') st.center = (e.start + e.end) / 2;
    if (user) {
      sfx('click');
      st.measured.add(i);
      if (st.measured.size >= 3) achieve('scope');
    }
    render();
    renderReadout();
  }

  items.forEach((li, i) => {
    $('.tl-btn', li)?.addEventListener('click', () => {
      select(i);
      const r = screen.getBoundingClientRect();
      if (r.bottom < 60 || r.top > window.innerHeight - 60) {
        root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
    });
  });

  knob?.addEventListener('click', () => {
    st.level = (st.level + 1) % LEVELS.length;
    knob.style.setProperty('--knob', `${KNOB[st.level]}deg`);
    timeLabel.textContent = LEVELS[st.level].label;
    knob.querySelector('.sr-only').textContent = `Base de temps : ${LEVELS[st.level].label} par division. Changer`;
    sfx('clack');
    render();
    sweep(700);
  });

  $$('.ch-btn', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const ch = Number(btn.dataset.ch);
      st.ch[ch] = !st.ch[ch];
      btn.setAttribute('aria-pressed', String(st.ch[ch]));
      items.forEach((li, i) => li.classList.toggle('is-muted', !st.ch[events[i].ch]));
      sfx('click');
      render();
    });
  });

  const order = events.map((e, i) => ({ i, t: e.kind === 'continuous' ? 9999 : e.start })).sort((a, b) => a.t - b.t).map((o) => o.i);
  $$('[data-step]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const visible = order.filter((i) => st.ch[events[i].ch]);
      if (!visible.length) return;
      const pos = visible.indexOf(st.sel);
      const next = visible[(pos + Number(btn.dataset.step) + visible.length) % visible.length];
      select(next);
    });
  });

  new ResizeObserver(() => render()).observe(screen);
  watchVisibility(root, (v) => {
    if (v && !st.seen) {
      st.seen = true;
      render();
      sweep();
    }
    idle(v);
  });

  const first = events.findIndex((e) => e.ch === 1 && e.kind !== 'continuous');
  select(first >= 0 ? first : 0, { user: false });
}

function parseItem(li) {
  const ym = (s, end = false) => {
    const [y, m] = s.split('-').map(Number);
    return y + (m - (end ? 0 : 1)) / 12;
  };
  let kind = 'approx';
  let start = 0;
  let end = 0;
  if (li.dataset.continuous) kind = 'continuous';
  else if (li.dataset.start) {
    kind = 'exact';
    start = ym(li.dataset.start);
    end = ym(li.dataset.end, true);
  } else if (li.dataset.span) {
    [start, end] = li.dataset.span.split('-').map(Number);
  }
  return {
    li,
    ch: Number(li.dataset.ch),
    kind,
    start,
    end,
    title: $('.tl-btn', li)?.textContent.trim() ?? '',
    org: $('.tl-org', li)?.textContent.trim() ?? '',
    label: li.dataset.label ?? '',
  };
}

function durationText(e) {
  if (e.kind !== 'exact') return '';
  const months = Math.round((e.end - e.start) * 12);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} an${y > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} mois`);
  return parts.join(' ');
}
