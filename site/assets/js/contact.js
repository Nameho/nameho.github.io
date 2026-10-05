// Contact : trois ponts de soudure à réussir pour « fermer le circuit ».
// Les coordonnées ne sont jamais écrites en clair dans le code : elles sont
// encodées et ne sont décodées qu'une fois le circuit fermé (les robots qui
// aspirent les pages ne les trouvent pas).

import { $, $$, svg, clamp, reducedMotion } from './util.js';
import { sfx, loopStart, loopStop } from './audio.js';
import { achieve } from './hud.js';
import { getContact, copyContact } from './contact-data.js';

const HEAT_TIME = 1.55; // secondes pour remplir la jauge
const GOOD_MIN = 0.55;
const GOOD_MAX = 0.82;

export function initContact() {
  const root = $('.solder');
  if (!root) return;
  const boardBox = $('.solder-board', root);
  const svgEl = $('.solder-svg', root);
  const iron = $('.iron', root);
  const smoke = $('.smoke', svgEl);
  const oled = $('.oled-text', svgEl);
  const count = $('[data-solder-count]', root);
  const msg = $('.solder-msg', root);
  const skip = $('[data-solder-skip]', root);
  const card = $('.contact-card');
  const joints = $$('.joint', svgEl);
  const reduce = reducedMotion();

  const st = joints.map(() => ({ status: 'idle', heat: 0 }));
  let active = -1;
  let raf = 0;
  let lastT = 0;
  let lastPuff = 0;
  let revealed = false;

  const say = (text, kind = '') => {
    msg.textContent = text;
    msg.classList.toggle('is-good', kind === 'good');
    msg.classList.toggle('is-bad', kind === 'bad');
  };

  const jointCenter = (i) => {
    const b = $('.blob', joints[i]);
    return { x: Number(b.getAttribute('cx')), y: Number(b.getAttribute('cy')) };
  };

  function puff(i, dark = false) {
    if (reduce) return;
    const c = jointCenter(i);
    const p = svg('circle', { class: `puff${dark ? ' puff-dark' : ''}`, cx: c.x + (Math.random() - 0.5) * 10, cy: c.y - 6, r: 5 }, smoke);
    p.style.setProperty('--dx', `${((Math.random() - 0.5) * 40).toFixed(0)}px`);
    setTimeout(() => p.remove(), 1500);
  }

  // Température de la pastille (pédagogique) : froide < 250 °C, idéale 250-320 °C, trop chaude au-delà
  const tempBox = $('.solder-temp', root);
  const tempEl = $('[data-solder-temp]', root);
  const tempOf = (h) => (h < GOOD_MIN
    ? 25 + (h / GOOD_MIN) * 225
    : h <= GOOD_MAX
      ? 250 + ((h - GOOD_MIN) / (GOOD_MAX - GOOD_MIN)) * 70
      : 320 + ((Math.min(h, 1) - GOOD_MAX) / (1 - GOOD_MAX)) * 110);
  const showTemp = (h) => {
    const t = tempOf(h);
    tempEl.textContent = `${Math.round(t)} °C`;
    tempBox.dataset.zone = h < GOOD_MIN ? 'cold' : h <= GOOD_MAX ? 'good' : 'hot';
  };

  function paintJoint(i) {
    const j = joints[i];
    const h = st[i].heat;
    showTemp(h);
    j.style.setProperty('--p', (h * 100).toFixed(1));
    j.style.setProperty('--melt', clamp((h - 0.22) / 0.2, 0, 1).toFixed(2));
    j.style.setProperty('--grow', (0.3 + 0.7 * clamp((h - 0.25) / 0.35, 0, 1)).toFixed(2));
  }

  function moveIron(x, y) {
    iron.style.transform = `translate(${(x - 4).toFixed(0)}px, ${(y - 116).toFixed(0)}px)`;
  }
  function ironToJoint(i) {
    const blob = $('.blob', joints[i]).getBoundingClientRect();
    const box = boardBox.getBoundingClientRect();
    moveIron(blob.left + blob.width / 2 - box.left, blob.top + blob.height / 2 - box.top);
  }

  function startHeat(i) {
    if (revealed || st[i].status === 'good' || active !== -1) return;
    active = i;
    st[i].heat = 0;
    st[i].status = 'heating';
    const j = joints[i];
    j.classList.remove('is-cold', 'is-burnt');
    j.classList.add('is-heating');
    paintJoint(i);
    iron.classList.add('is-hot');
    if (!boardBox.classList.contains('has-iron') || !matchMedia('(pointer: fine)').matches) {
      boardBox.classList.add('has-iron');
      ironToJoint(i);
    }
    loopStart('sizzle');
    say('Ça chauffe… relâche dans le vert !');
    lastT = performance.now();
    lastPuff = 0;
    raf = requestAnimationFrame(tick);
  }

  function tick(t) {
    if (active === -1) return;
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;
    const s = st[active];
    s.heat += dt / HEAT_TIME;
    paintJoint(active);
    if (t - lastPuff > (s.heat > GOOD_MAX ? 70 : 150)) {
      lastPuff = t;
      puff(active, s.heat > GOOD_MAX);
    }
    if (s.heat >= 1) {
      stopHeat(true);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function stopHeat(forced = false) {
    if (active === -1) return;
    const i = active;
    active = -1;
    cancelAnimationFrame(raf);
    loopStop('sizzle');
    iron.classList.remove('is-hot');
    const j = joints[i];
    j.classList.remove('is-heating');
    const h = st[i].heat;
    if (!forced && h >= GOOD_MIN && h <= GOOD_MAX) {
      st[i].status = 'good';
      j.classList.add('is-good');
      j.setAttribute('aria-label', `Soudure de ${j.dataset.name} réussie`);
      sfx('ok');
      const n = st.filter((s) => s.status === 'good').length;
      count.textContent = String(n);
      say(n < 3 ? `Parfait : soudure brillante et bien conique ✔ Encore ${3 - n}.` : 'Circuit fermé !', 'good');
      if (n === 3) reveal(true);
    } else if (!forced && h < GOOD_MIN) {
      st[i].status = 'cold';
      j.classList.add('is-cold');
      sfx('buzz');
      say('Trop tôt : soudure froide, mate et granuleuse. Réchauffe-la plus longtemps !', 'bad');
    } else {
      st[i].status = 'burnt';
      j.classList.add('is-burnt');
      for (let k = 0; k < 5; k++) setTimeout(() => puff(i, true), k * 60);
      sfx('buzz');
      say('Trop chaud ! Le flux a brûlé et la pastille souffre… Nettoie et recommence.', 'bad');
    }
    if (!matchMedia('(pointer: fine)').matches) setTimeout(() => boardBox.classList.remove('has-iron'), 500);
    // La pastille refroidit doucement après le passage du fer
    setTimeout(() => { if (active === -1) { tempEl.textContent = '25 °C'; tempBox.dataset.zone = ''; } }, 2500);
  }

  /* ---------- Révélation des coordonnées ---------- */
  function reveal(earned) {
    if (revealed) return;
    revealed = true;
    skip.hidden = true;
    root.classList.add('is-live');
    boardBox.classList.remove('has-iron');
    const { email, phone, phoneTxt } = getContact();
    if (earned) {
      achieve('solder');
      sfx('chime');
    }

    // Copie au clic (sur la carte de contact comme sur l'écran OLED)
    const values = { email, phone: phoneTxt };
    const copy = (kind, source) => copyContact(kind, source);

    const lines = [
      ['> INIT ........ OK', 'o-dim', 80],
      ['> CIRCUIT ..... FERMÉ', 'o-dim', 98],
      ['Alexis Trudelle', 'o-big', 130],
      [email, 'o-sm o-link', 154, 'email'],
      [phoneTxt, 'o-link', 174, 'phone'],
      ['Disponible ✔', 'o-dim', 196],
    ];
    oled.replaceChildren();
    lines.forEach(([text, cls, y, kind], k) => {
      setTimeout(() => {
        const t = svg('text', { x: 538, y, class: cls }, oled);
        t.textContent = text;
        if (kind) {
          t.setAttribute('role', 'button');
          t.setAttribute('tabindex', '0');
          t.setAttribute('aria-label', kind === 'email' ? `Copier l'adresse e-mail ${email}` : `Copier le numéro ${phoneTxt}`);
          t.addEventListener('click', () => copy(kind, t));
          t.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(kind, t); }
          });
        }
        if (!reduce) sfx('click', { passive: true });
      }, reduce ? 0 : 400 + k * 260);
    });

    setTimeout(() => {
      const mail = $('[data-contact="email"]', card);
      const tel = $('[data-contact="phone"]', card);
      mail.href = `mailto:${email}`;
      mail.setAttribute('aria-label', `Écrire un e-mail à ${email}`);
      tel.href = `tel:${phone}`;
      tel.setAttribute('aria-label', `Appeler le ${phoneTxt}`);
      $$('[data-copy]', card).forEach((b) => {
        b.textContent = values[b.dataset.copy];
        b.setAttribute('aria-label', `${values[b.dataset.copy]} — cliquer pour copier`);
        b.addEventListener('click', () => copy(b.dataset.copy, b));
      });
      card.hidden = false;
    }, reduce ? 0 : 400 + lines.length * 260);
  }

  /* ---------- Événements ---------- */
  joints.forEach((j, i) => {
    j.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { j.setPointerCapture(e.pointerId); } catch { /* le relâchement est aussi suivi sur la fenêtre */ }
      startHeat(i);
    });
    j.addEventListener('pointerup', () => { if (active === i) stopHeat(); });
    j.addEventListener('pointercancel', () => { if (active === i) stopHeat(); });
    j.addEventListener('lostpointercapture', () => { if (active === i) stopHeat(); });
    j.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        startHeat(i);
      }
    });
    j.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && active === i) stopHeat();
    });
    j.addEventListener('blur', () => { if (active === i) stopHeat(); });
  });

  window.addEventListener('pointerup', () => { if (active !== -1) stopHeat(); });
  window.addEventListener('pointercancel', () => { if (active !== -1) stopHeat(); });

  boardBox.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || revealed) return;
    const box = boardBox.getBoundingClientRect();
    boardBox.classList.add('has-iron');
    moveIron(e.clientX - box.left, e.clientY - box.top);
  });
  boardBox.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && active === -1) boardBox.classList.remove('has-iron');
  });

  skip?.addEventListener('click', () => {
    sfx('click');
    joints.forEach((j, i) => {
      setTimeout(() => {
        st[i].status = 'good';
        j.classList.remove('is-cold', 'is-burnt', 'is-heating');
        j.classList.add('is-good');
        sfx('tink');
      }, reduce ? 0 : i * 220);
    });
    count.textContent = '3';
    say('Soudures posées par le technicien de garde 😉', 'good');
    setTimeout(() => reveal(false), reduce ? 0 : 750);
  });
}
