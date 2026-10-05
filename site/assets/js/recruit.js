// « Me recruter » : un devis qui s'imprime ligne à ligne selon la formule choisie.
// Informations vérifiées sur francetravail.fr (octobre 2026), présentées de façon indicative.

import { $, el, reducedMotion } from './util.js';
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

export function initRecruit() {
  const devis = $('#devis');
  const list = $('.hire-plans');
  if (!devis || !list) return;
  const reduce = reducedMotion();
  const tbody = $('.dv-lines tbody', devis);
  let timers = [];

  function render(key) {
    const p = PLANS[key];
    if (!p) return;
    timers.forEach(clearTimeout);
    timers = [];
    devis.setAttribute('aria-labelledby', `plan-${key}`);
    $('.dv-title', devis).textContent = p.title;
    $('.dv-desc', devis).textContent = p.desc;
    $('.dv-total span', devis).textContent = p.label ?? 'Coût pour vous';
    $('.dv-amount', devis).textContent = p.total;
    $('.dv-ideal', devis).replaceChildren(el('b', { text: 'Idéal pour : ' }), document.createTextNode(p.ideal));
    tbody.replaceChildren();
    devis.classList.remove('is-printing');
    void devis.offsetWidth;
    devis.classList.add('is-printing');
    p.lines.forEach(([k, v], i) => {
      const row = el('tr', { cls: 'dv-row' }, [el('th', { text: k, attrs: { scope: 'row' } }), el('td', { text: v })]);
      if (reduce) { tbody.appendChild(row); return; }
      timers.push(setTimeout(() => {
        tbody.appendChild(row);
        sfx('click', { passive: true });
      }, 120 + i * 140));
    });
  }

  initTabs(list, (tab) => render(tab.dataset.plan));
}
