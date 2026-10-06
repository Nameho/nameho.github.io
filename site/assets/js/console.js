// Secret pour les curieux qui ouvrent la console (F12) : un message, et une commande à taper.

import { discover } from './hud.js';

const CHIP = String.raw`
        ┌─┴─┴─┴─┴─┴─┴─┴─┐
      ──┤ ●             ├──
      ──┤    AT-2026    ├──
      ──┤  REPAIR·FR-17 ├──
      ──┤               ├──
        └─┬─┬─┬─┬─┬─┬─┬─┘`;

export function initConsole() {
  const title = 'font: 800 18px system-ui, sans-serif; color: #ffb35c;';
  const text = 'font: 13px system-ui, sans-serif; color: #b6d6c8;';
  const code = 'font: 700 13px monospace; color: #52ff86; background: #0a1d18; padding: 2px 6px; border-radius: 4px;';

  console.log(`%c${CHIP}`, 'font: 12px monospace; color: #e0821f;');
  console.log('%cVous inspectez le code ? Excellent réflexe de technicien 😉', title);
  console.log(
    '%cCe site est écrit en HTML, CSS et JavaScript natifs, sans aucune bibliothèque, et codé avec l’IA Claude à partir des idées d’Alexis.\nCode source : https://github.com/Nameho/nameho.github.io\n\nUn diagnostic complet du candidat vous attend : tapez %cdiagnostic()%c puis Entrée.',
    text, code, text,
  );

  // Fonction volontairement globale, pour être tapée dans la console
  window.diagnostic = () => {
    const ok = 'color: #52ff86; font-weight: 700;';
    const label = 'color: #d6e4dd;';
    console.log('%c▶ Autotest du candidat AT-2026…', 'color: #ffb35c; font-weight: 700;');
    const tests = [
      ['Motivation', '100 %'],
      ['Méthode', 'mesurer → isoler → réparer'],
      ['Minutie', 'élevée'],
      ['Calme sous pression', 'stable'],
      ['Ponctualité', 'quartz 32,768 kHz'],
      ['Curiosité', 'vous êtes dans sa console 😉'],
    ];
    for (const [k, v] of tests) console.log(`%c  ${k.padEnd(22, '.')} %cOK%c  (${v})`, label, ok, label);
    console.log('%c✔ Verdict : bon pour l’atelier. Pour le contacter : section Contact, ou le bouton « Version express ».', 'color: #52ff86; font-weight: 700;');
    discover('console');
    return 'Diagnostic terminé ✔';
  };
}
