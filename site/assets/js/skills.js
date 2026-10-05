// Compétences : un boîtier à dévisser (geste circulaire ou simple clic),
// puis une carte dont chaque composant est une compétence.

import { $, $$, el, clamp, reducedMotion } from './util.js';
import { sfx } from './audio.js';
import { achieve } from './hud.js';

const TURNS = 2; // tours complets pour sortir une vis

export function initSkills() {
  const section = $('#competences');
  const caseEl = section && $('.case', section);
  if (!caseEl) return;

  const screws = $$('.screw', caseEl);
  const slots = $$('.tray-slot', section);
  const openBtn = $('[data-case-open]', section);
  const closeBtn = $('[data-case-close]', section);
  const comps = $$('.comp', caseEl);
  const tabs = $$('.insp-tabs [role="tab"]', section);
  const panels = $$('.skill', section);
  const state = screws.map(() => ({ progress: 0, out: false, busy: false, notch: 0 }));
  let removed = 0;
  let current = 'diagnostic';

  /* ---------- Inspecteur (onglets accessibles) ---------- */
  function select(skill, { focus = false, scan = true } = {}) {
    current = skill;
    for (const t of tabs) {
      const on = t.dataset.skill === skill;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const p of panels) {
      const on = p.id === `skill-${skill}`;
      p.hidden = !on;
      if (on && scan && !reducedMotion()) {
        p.classList.remove('is-scan');
        void p.offsetWidth;
        p.classList.add('is-scan');
      }
    }
    comps.forEach((c) => c.classList.toggle('is-selected', c.dataset.skill === skill));
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { select(t.dataset.skill); sfx('click'); });
    t.addEventListener('keydown', (e) => {
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next = null;
      if (e.key in moves) next = (i + moves[e.key] + tabs.length) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(tabs[next].dataset.skill, { focus: true });
    });
  });
  comps.forEach((c) => c.addEventListener('click', () => { select(c.dataset.skill); sfx('click'); }));
  select(current, { scan: false });

  /* ---------- Vis ---------- */
  function setProgress(i, p) {
    const st = state[i];
    st.progress = clamp(p, 0, 1);
    const head = $('.screw-head', screws[i]);
    head.style.setProperty('--rot', `${(-st.progress * 360 * TURNS).toFixed(1)}deg`);
    head.style.setProperty('--lift', (1 + st.progress * 0.25).toFixed(3));
    const notch = Math.floor(st.progress * TURNS * 6);
    if (notch !== st.notch) {
      st.notch = notch;
      sfx('click');
    }
  }

  function autoUnscrew(i, fast = false) {
    const st = state[i];
    if (st.out || st.busy) return;
    st.busy = true;
    if (reducedMotion()) {
      setProgress(i, 1);
      st.busy = false;
      popOut(i);
      return;
    }
    const from = st.progress;
    const dur = fast ? 380 : 720;
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / dur, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setProgress(i, from + (1 - from) * e);
      if (k < 1) requestAnimationFrame(step);
      else { st.busy = false; popOut(i); }
    };
    requestAnimationFrame(step);
  }

  function popOut(i) {
    const st = state[i];
    if (st.out) return;
    st.out = true;
    sfx('pop');
    const btn = screws[i];
    const r = btn.getBoundingClientRect();
    st.slot = removed; // on retient la place dans le bac pour la remettre au bon endroit
    const slot = slots[removed];
    removed++;

    // Garder le focus clavier sur une vis restante
    if (document.activeElement === btn) {
      const next = screws.find((s, j) => !state[j].out);
      (next ?? openBtn)?.focus();
    }
    btn.classList.add('is-out');
    btn.disabled = true;

    if (slot && !reducedMotion()) {
      const s = slot.getBoundingClientRect();
      const fly = el('span', { cls: 'flying-screw', attrs: { 'aria-hidden': 'true' } });
      fly.style.left = `${r.left}px`;
      fly.style.top = `${r.top}px`;
      fly.style.width = `${r.width}px`;
      fly.style.height = `${r.height}px`;
      document.body.appendChild(fly);
      const dx = s.left + s.width / 2 - (r.left + r.width / 2);
      const dy = s.top + s.height / 2 - (r.top + r.height / 2);
      const scale = s.width / r.width;
      const anim = fly.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1.25)' },
        { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, 0) - 110}px) rotate(-380deg) scale(1.1)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) rotate(-720deg) scale(${scale})` },
      ], { duration: 780, easing: 'cubic-bezier(.3, .6, .4, 1)' });
      anim.onfinish = () => {
        fly.remove();
        slot.classList.add('has-screw');
        sfx('tink');
      };
    } else {
      slot?.classList.add('has-screw');
    }

    if (removed === screws.length) setTimeout(openCase, reducedMotion() ? 0 : 750);
  }

  function openCase() {
    caseEl.dataset.state = 'open';
    sfx('whoosh');
    openBtn.hidden = true;
    closeBtn.hidden = false;
    setTimeout(() => {
      if (caseEl.dataset.state !== 'open') return;
      caseEl.classList.add('is-powered');
      sfx('ok');
      select(current);
    }, reducedMotion() ? 0 : 950);
    achieve('case');
  }

  /* ---------- Fermeture : l'ouverture rejouée à l'envers ---------- */
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let closing = false;

  // Revisse une vis : la tête tourne dans le sens des aiguilles d'une montre et redescend
  function screwIn(i, dur) {
    return new Promise((resolve) => {
      if (!dur) {
        setProgress(i, 0);
        resolve();
        return;
      }
      const t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / dur, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        setProgress(i, 1 - e);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // Une vis quitte le bac magnétique, retourne dans son trou, puis se revisse
  async function screwBack(i, reduce) {
    const btn = screws[i];
    const slot = slots[state[i].slot];
    if (slot && !reduce) {
      const r = btn.getBoundingClientRect();
      const s = slot.getBoundingClientRect();
      slot.classList.remove('has-screw');
      sfx('pop');
      const fly = el('span', { cls: 'flying-screw', attrs: { 'aria-hidden': 'true' } });
      fly.style.left = `${r.left}px`;
      fly.style.top = `${r.top}px`;
      fly.style.width = `${r.width}px`;
      fly.style.height = `${r.height}px`;
      document.body.appendChild(fly);
      const dx = s.left + s.width / 2 - (r.left + r.width / 2);
      const dy = s.top + s.height / 2 - (r.top + r.height / 2);
      const anim = fly.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${s.width / r.width})` },
        { transform: `translate(${dx * 0.55}px, ${Math.min(dy * 0.55, 0) - 110}px) rotate(340deg) scale(1.1)`, offset: 0.55 },
        { transform: 'translate(0, 0) rotate(720deg) scale(1.25)' },
      ], { duration: 620, easing: 'cubic-bezier(.3, .6, .4, 1)' });
      await anim.finished.catch(() => {});
      fly.remove();
    } else {
      slot?.classList.remove('has-screw');
    }
    btn.classList.remove('is-out');
    state[i].out = false;
    sfx('tink');
    await screwIn(i, reduce ? 0 : 380); // même vitesse que le dévissage rapide
  }

  async function closeCase() {
    if (closing || caseEl.dataset.state !== 'open') return;
    closing = true;
    const reduce = reducedMotion();
    closeBtn.disabled = true;

    // 1. On coupe l'alimentation : les LED et le courant s'éteignent
    caseEl.classList.remove('is-powered');
    sfx('click');
    await wait(reduce ? 0 : 200);

    // 2. Le capot se rabat
    caseEl.dataset.state = 'closed';
    sfx('whoosh');
    await wait(reduce ? 0 : 850);
    caseEl.classList.remove('is-thump');
    void caseEl.offsetWidth;
    caseEl.classList.add('is-thump');
    sfx('clack');

    // 3. Les vis repartent du bac presque en même temps (léger décalage, comme à l'ouverture)
    const order = screws.map((_, i) => i).filter((i) => state[i].out).sort((a, b) => state[a].slot - state[b].slot);
    order.forEach((i) => { state[i].busy = true; });
    await Promise.all(order.map((i, k) => wait(reduce ? 0 : k * 170).then(() => screwBack(i, reduce))));

    screws.forEach((btn, i) => {
      state[i] = { progress: 0, out: false, busy: false, notch: 0 };
      btn.disabled = false;
    });
    removed = 0;
    closeBtn.disabled = false;
    closeBtn.hidden = true;
    openBtn.hidden = false;
    if (!document.activeElement || document.activeElement === document.body || document.activeElement === closeBtn) openBtn.focus();
    closing = false;
  }

  screws.forEach((btn, i) => {
    let pid = null;
    let lastAng = 0;
    let moved = 0;
    const angleOf = (e) => {
      const r = btn.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    const release = () => {
      if (pid === null) return;
      try { btn.releasePointerCapture(pid); } catch { /* déjà relâché */ }
      pid = null;
    };

    btn.addEventListener('pointerdown', (e) => {
      if (state[i].out || state[i].busy) return;
      e.preventDefault();
      pid = e.pointerId;
      try { btn.setPointerCapture(pid); } catch { /* sans capture, le geste reste possible sur la vis */ }
      lastAng = angleOf(e);
      moved = 0;
    });
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const a = angleOf(e);
      let d = a - lastAng;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      lastAng = a;
      moved += Math.abs(d);
      // L'écran a l'axe Y vers le bas : un angle qui diminue = sens inverse des aiguilles d'une montre.
      setProgress(i, state[i].progress - d / (2 * Math.PI * TURNS));
      if (state[i].progress >= 1) {
        release();
        popOut(i);
      }
    });
    btn.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pid) return;
      release();
      if (moved < 0.4 && !state[i].out) autoUnscrew(i); // simple clic
    });
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('click', (e) => {
      if (e.detail === 0) autoUnscrew(i); // clavier (Entrée / Espace)
    });
  });

  openBtn?.addEventListener('click', () => {
    screws.forEach((_, i) => setTimeout(() => autoUnscrew(i, true), i * 170));
  });
  closeBtn?.addEventListener('click', closeCase);
}
