// Défi « Code couleur » : 10 résistances à lire contre la montre, avec un mémo à côté.

import { $, $$, el, store } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

const COLORS = [
  { n: 'noir', c: '#141414' },
  { n: 'marron', c: '#7a4a1f' },
  { n: 'rouge', c: '#d9342b' },
  { n: 'orange', c: '#f08a24' },
  { n: 'jaune', c: '#f2c400' },
  { n: 'vert', c: '#2f9e44' },
  { n: 'bleu', c: '#2b6fd6' },
  { n: 'violet', c: '#8b3fd1' },
  { n: 'gris', c: '#8d9196' },
  { n: 'blanc', c: '#f4f4f2' },
];
const GOLD = { n: 'or', c: '#c9a23a' };
const SILVER = { n: 'argent', c: '#c3c7cb' };
const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
const ROUNDS = 10;
const LIMIT = 12; // secondes par question

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const secs = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function formatOhms(v) {
  if (v >= 1e6) return `${nf.format(v / 1e6)} MΩ`;
  if (v >= 1e3) return `${nf.format(v / 1e3)} kΩ`;
  return `${nf.format(v)} Ω`;
}

function makeQuestion() {
  const two = E12[Math.floor(Math.random() * E12.length)];
  const mult = Math.floor(Math.random() * 6); // ×1 à ×100 k
  const value = two * 10 ** mult;
  const d1 = Math.floor(two / 10);
  const d2 = two % 10;
  const bands = [COLORS[d1], COLORS[d2], COLORS[mult], Math.random() < 0.8 ? GOLD : SILVER];

  // Pièges classiques : mauvais multiplicateur, chiffres inversés, valeur voisine
  const traps = new Set([value * 10, value / 10, (d2 * 10 + d1) * 10 ** mult]);
  const idx = E12.indexOf(two);
  traps.add(E12[(idx + 1) % E12.length] * 10 ** mult);
  traps.add(E12[(idx + E12.length - 1) % E12.length] * 10 ** mult);
  const choices = [...traps].filter((v) => v !== value && v >= 1 && Number.isInteger(v * 10)).sort(() => Math.random() - 0.5).slice(0, 3);
  const answers = [value, ...choices].sort(() => Math.random() - 0.5);
  return { value, bands, answers };
}

export function initColors() {
  const root = $('.defi-colors');
  if (!root) return;
  const bandsEl = $$('.cq-band', root);
  const desc = $('#cq-res-desc');
  const answersEl = $('.cq-answers', root);
  const feedback = $('.cq-feedback', root);
  const startBtn = $('[data-cq-start]', root);
  const end = $('.cq-end', root);
  const bar = $('.cq-timer span', root);
  const out = Object.fromEntries($$('[data-cq]', root).map((n) => [n.dataset.cq, n]));

  const pauseBox = $('.cq-pause', root);
  const st = { round: 0, score: 0, q: null, t0: 0, qt0: 0, raf: 0, locked: false, playing: false, paused: false, pausedAt: 0, nextTimer: 0, pendingNext: false };

  function paint(bands) {
    bands.forEach((b, i) => bandsEl[i].setAttribute('fill', b.c));
    desc.textContent = `Résistance à 4 anneaux : ${bands.map((b) => b.n).join(', ')}.`;
  }
  // Exemple affiché avant de jouer : jaune violet marron or = 470 Ω
  paint([COLORS[4], COLORS[7], COLORS[1], GOLD]);

  function tick() {
    if (!st.playing || st.paused) return;
    const now = performance.now();
    out.time.textContent = secs.format((now - st.t0) / 1000);
    const left = Math.max(0, 1 - (now - st.qt0) / (LIMIT * 1000));
    bar.style.transform = `scaleX(${left.toFixed(3)})`;
    bar.classList.toggle('is-low', left < 0.3);
    if (left === 0 && !st.locked) answer(null);
    st.raf = requestAnimationFrame(tick);
  }

  function next() {
    if (st.round >= ROUNDS) { finish(); return; }
    st.round++;
    st.q = makeQuestion();
    st.locked = false;
    st.qt0 = performance.now();
    out.round.textContent = String(st.round);
    paint(st.q.bands);
    feedback.textContent = '';
    feedback.dataset.kind = '';
    answersEl.replaceChildren(...st.q.answers.map((v) => {
      const b = el('button', { cls: 'cq-answer', text: formatOhms(v), attrs: { type: 'button' } });
      b.addEventListener('click', () => answer(v, b));
      return b;
    }));
    answersEl.firstElementChild?.focus({ preventScroll: true });
  }

  function answer(v, btn = null) {
    if (st.locked) return;
    st.locked = true;
    const ok = v === st.q.value;
    $$('.cq-answer', answersEl).forEach((b) => {
      b.disabled = true;
      if (b.textContent === formatOhms(st.q.value)) b.classList.add('is-right');
    });
    if (ok) {
      st.score++;
      out.score.textContent = String(st.score);
      sfx('ok');
      feedback.textContent = `Exact : ${formatOhms(st.q.value)} ✔`;
      feedback.dataset.kind = 'good';
    } else {
      btn?.classList.add('is-wrong');
      sfx('buzz');
      const [a, b, c] = st.q.bands;
      feedback.textContent = `${v === null ? 'Temps écoulé ! ' : ''}C'était ${formatOhms(st.q.value)} : ${a.n} (${COLORS.indexOf(a)}), ${b.n} (${COLORS.indexOf(b)}), ${c.n} (× ${formatOhms(10 ** COLORS.indexOf(c)).replace(' Ω', '').replace('Ω', '')}).`;
      feedback.dataset.kind = 'bad';
    }
    st.nextTimer = setTimeout(() => { st.nextTimer = 0; next(); }, ok ? 700 : 2200);
  }

  /* ---------- Pause (changement d'onglet ou de page) ---------- */
  function pause() {
    if (!st.playing || st.paused) return;
    st.paused = true;
    st.pausedAt = performance.now();
    cancelAnimationFrame(st.raf);
    if (st.nextTimer) {
      clearTimeout(st.nextTimer);
      st.nextTimer = 0;
      st.pendingNext = true;
    }
    pauseBox.hidden = false;
  }
  function resume() {
    if (!st.paused) return;
    const d = performance.now() - st.pausedAt;
    st.t0 += d;
    st.qt0 += d;
    st.paused = false;
    pauseBox.hidden = true;
    sfx('click');
    if (st.pendingNext) {
      st.pendingNext = false;
      next();
    } else {
      $('.cq-answer:not([disabled])', answersEl)?.focus({ preventScroll: true });
    }
    st.raf = requestAnimationFrame(tick);
  }
  root.addEventListener('panel:hide', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  $('[data-cq-resume]', root).addEventListener('click', resume);

  function finish() {
    st.playing = false;
    cancelAnimationFrame(st.raf);
    const time = (performance.now() - st.t0) / 1000;
    answersEl.replaceChildren();
    feedback.textContent = '';
    let best = null;
    try { best = JSON.parse(store.get('at-cq-best', 'null')); } catch { best = null; }
    if (!best || typeof best.score !== 'number' || typeof best.time !== 'number') best = null;
    const better = !best || st.score > best.score || (st.score === best.score && time < best.time);
    if (better) store.set('at-cq-best', JSON.stringify({ score: st.score, time }));
    $('.cq-end-title', end).textContent = `${st.score}/${ROUNDS} en ${secs.format(time)} s ${st.score >= 9 ? '🏆' : st.score >= 7 ? '👍' : '💪'}`;
    $('.cq-end-best', end).textContent = better
      ? 'Nouveau record personnel !'
      : `Record : ${best.score}/${ROUNDS} en ${secs.format(best.time)} s`;
    end.hidden = false;
    $('[data-cq-restart]', end).focus();
    if (st.score >= 7) achieve('colors');
    sfx(st.score >= 7 ? 'chime' : 'click');
  }

  function start() {
    clearTimeout(st.nextTimer);
    Object.assign(st, { round: 0, score: 0, playing: true, paused: false, pendingNext: false, nextTimer: 0, t0: performance.now() });
    pauseBox.hidden = true;
    out.score.textContent = '0';
    end.hidden = true;
    startBtn.hidden = true;
    sfx('click');
    next();
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  startBtn.addEventListener('click', start);
  $('[data-cq-restart]', end).addEventListener('click', start);
}
