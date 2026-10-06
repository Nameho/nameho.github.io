// « Me recruter » : un devis imprimé sur un ticket, selon la formule choisie.
// Au changement de formule, l'ancien ticket est arraché et le nouveau sort de
// l'imprimante par à-coups, comme un ticket de caisse.
// Informations vérifiées sur francetravail.fr (octobre 2026), présentées de façon indicative.

import { $, $$, el, reducedMotion } from './util.js';
import { sfx } from './audio.js';
import { initTabs } from './defis.js';

const PLANS = {
  pmsmp: {
    title: 'Immersion professionnelle (PMSMP)',
    desc: "Vous me prenez à l'essai dans votre atelier, sans engagement.",
    lines: [
      ['Durée', "Jusqu'à 1 mois (renouvelable sous conditions)"],
      ['Rémunération', 'Aucune : je garde mon statut et mes allocations'],
      ['Accident du travail', 'Je reste couvert'],
      ['Formalités', 'Convention en ligne avec France Travail (« Immersion facilitée »)'],
    ],
    total: '0 €',
    ideal: 'me voir à l’œuvre avant de décider.',
  },
  poei: {
    title: 'Préparation opérationnelle à l’emploi (POEI)',
    desc: 'Je suis formé à votre poste avant d’être embauché.',
    lines: [
      ['Formation', "Jusqu'à 450 h en organisme, ou 300 h en tutorat chez vous"],
      ['Coût de la formation', 'Pris en charge par France Travail (sur dossier)'],
      ['Aide au tutorat', "Jusqu'à 5 € net de l'heure pour vous"],
      ['Ma rémunération', 'Versée par France Travail pendant la formation'],
      ['Votre engagement', 'Une offre déposée, puis une embauche (CDI ou contrat de 6 mois et plus)'],
    ],
    label: 'Salaire pendant la formation',
    total: '0 €',
    ideal: 'former quelqu’un exactement à vos méthodes.',
  },
  interne: {
    title: 'Embauche directe + formation interne',
    desc: 'Vous m’embauchez et me formez à vos appareils.',
    lines: [
      ['Contrat', 'CDI ou CDD, selon vos besoins'],
      ['Salaire', 'Selon votre convention collective'],
      ['Formation', 'À vos méthodes et à vos appareils, au poste'],
      ['Mes bases', 'Diagnostic méthodique, multimètre, montage de PC, soudure (bases)'],
    ],
    total: 'À définir ensemble',
    ideal: 'un technicien motivé, rapidement opérationnel.',
  },
};

// Arrachage : durée totale (ms), fin du soulèvement, fin de la déchirure (fractions de la durée)
const TEAR = { time: 900, lift: 0.3, free: 0.62 };
// Le nouveau ticket sort juste après que l'ancien s'est libéré, pendant qu'il tombe
const FEED_DELAY = Math.round(TEAR.time * TEAR.free) + 90;
const LINE_PX = 40; // hauteur de papier avancée à chaque pas du moteur

export function initRecruit() {
  const devis = $('#devis');
  const list = $('.hire-plans');
  if (!devis || !list) return;
  const printer = devis.closest('.printer');
  const tbody = $('.dv-lines tbody', devis);
  let current = 'pmsmp';
  let timers = [];

  function fill(p) {
    $('.dv-title', devis).textContent = p.title;
    $('.dv-desc', devis).textContent = p.desc;
    $('.dv-total span', devis).textContent = p.label ?? 'Coût pour vous';
    $('.dv-amount', devis).textContent = p.total;
    $('.dv-ideal', devis).replaceChildren(el('b', { text: 'Idéal pour : ' }), document.createTextNode(p.ideal));
    tbody.replaceChildren(...p.lines.map(([k, v]) =>
      el('tr', {}, [el('th', { text: k, attrs: { scope: 'row' } }), el('td', { text: v })])));
  }

  /** Copie décorative du ticket affiché, arrachée puis jetée (le vrai ticket, lui, est réimprimé). */
  function tear() {
    const box = devis.getBoundingClientRect();
    const ref = printer.getBoundingClientRect();
    const torn = devis.cloneNode(true);
    for (const a of ['id', 'role', 'aria-labelledby', 'aria-live']) torn.removeAttribute(a);
    torn.classList.add('devis-torn');
    torn.setAttribute('aria-hidden', 'true');
    torn.inert = true;
    torn.style.setProperty('top', `${box.top - ref.top}px`);
    torn.style.setProperty('left', `${box.left - ref.left}px`);
    torn.style.setProperty('width', `${box.width}px`);
    printer.appendChild(torn);
    // Pivot sur le coin haut gauche : on soulève le côté droit (il vient vers nous),
    // la déchirure court le long de la lame de droite à gauche, puis le ticket tombe.
    const pose = (x, y, lift, tilt) => `perspective(1200px) translate(${x}px, ${y}px) rotateY(${lift}deg) rotateZ(${tilt}deg)`;
    torn.animate([
      { transform: pose(0, 0, 0, 0), opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
      { transform: pose(0, 0, -13, 0.5), opacity: 1, offset: TEAR.lift, easing: 'cubic-bezier(0.55, 0, 0.45, 1)' },
      { transform: pose(2, 1, -16, 7), opacity: 1, offset: TEAR.free, easing: 'cubic-bezier(0.45, 0, 0.85, 0.55)' },
      { transform: pose(14, 90, -19, 13), opacity: 0.3, offset: 0.82 }, // il s'efface vite : le nouveau ticket arrive
      { transform: pose(30, 200, -22, 20), opacity: 0 },
    ], { duration: TEAR.time, fill: 'forwards' }) // reste invisible jusqu'à sa suppression
      .finished.then(() => torn.remove(), () => torn.remove());
    timers.push(setTimeout(() => sfx('rip', { passive: true }), TEAR.time * TEAR.lift));
  }

  /** Le nouveau ticket sort de la fente par à-coups : avance d'une ligne, pause (impression), etc. */
  function feed() {
    const h = devis.offsetHeight + 16; // ticket + dents du haut et du bas
    const steps = Math.max(8, Math.round(h / LINE_PX));
    const marks = [];
    let t = 0;
    for (let s = 1; s <= steps; s++) {
      timers.push(setTimeout(() => sfx('feed', { passive: true }), FEED_DELAY + t));
      t += 32 + Math.random() * 20; // le moteur avance le papier
      const moved = t;
      t += 16 + Math.random() * 36; // la tête thermique imprime la ligne
      marks.push({ y: -h + (h * s) / steps, moved, held: t });
    }
    const snap = 'cubic-bezier(0.3, 0.7, 0.4, 1)';
    const frames = [{ transform: `translateY(${-h}px)`, offset: 0, easing: snap }];
    for (const m of marks) {
      frames.push({ transform: `translateY(${m.y}px)`, offset: m.moved / t });
      frames.push({ transform: `translateY(${m.y}px)`, offset: m.held / t, easing: snap });
    }
    printer.classList.add('is-feeding');
    const anim = devis.animate(frames, { duration: t, delay: FEED_DELAY, fill: 'backwards' });
    const done = () => printer.classList.remove('is-feeding');
    anim.finished.then(done, done);
  }

  function render(key) {
    const p = PLANS[key];
    if (!p || key === current) return;
    current = key;
    timers.forEach(clearTimeout);
    timers = [];
    devis.getAnimations().forEach((a) => a.cancel());
    $$('.devis-torn', printer).forEach((c) => c.remove());
    devis.setAttribute('aria-labelledby', `plan-${key}`);
    if (reducedMotion()) {
      fill(p);
      return;
    }
    tear();
    fill(p);
    feed();
  }

  initTabs(list, (tab) => render(tab.dataset.plan));
}
