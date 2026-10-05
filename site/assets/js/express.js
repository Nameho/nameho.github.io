// Version express : tout l'essentiel en 30 secondes pour les recruteurs pressés.
// S'ouvre avec les boutons [data-express] ou via le lien https://nameho.github.io/#express

import { $, $$ } from './util.js';
import { sfx } from './audio.js';
import { getContact, copyContact } from './contact-data.js';

export function initExpress() {
  const dlg = $('#express');
  if (!dlg) return;
  const coords = $('.xp-coords', dlg);
  const revealBtn = $('[data-xp-reveal]', dlg);
  let opener = null;

  const open = () => {
    if (dlg.open) return;
    opener = document.activeElement;
    dlg.showModal();
    document.documentElement.classList.add('has-dialog');
    $('.dlg-close', dlg).focus();
    sfx('whoosh', { passive: true });
  };

  function reveal() {
    const c = getContact();
    const [mail, tel] = $$('[data-xp-copy]', dlg);
    mail.textContent = c.email;
    tel.textContent = c.phoneTxt;
    mail.setAttribute('aria-label', `${c.email} — cliquer pour copier`);
    tel.setAttribute('aria-label', `${c.phoneTxt} — cliquer pour copier`);
    coords.hidden = false;
    revealBtn.hidden = true;
    dlg.classList.add('has-coords');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-express]')) {
      e.preventDefault();
      open();
    }
  });
  $$('[data-dlg-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog');
    if (location.hash === '#express') history.replaceState(null, '', location.pathname + location.search);
    opener?.focus?.();
  });

  revealBtn.addEventListener('click', () => { reveal(); sfx('ok'); });
  $$('[data-xp-copy]', dlg).forEach((b) => b.addEventListener('click', () => copyContact(b.dataset.xpCopy, b)));
  $('[data-xp-print]', dlg).addEventListener('click', () => {
    if (coords.hidden) reveal();
    window.print();
  });

  // Lien direct à envoyer : …/#express
  const fromHash = () => { if (location.hash === '#express') open(); };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}
