// Onglets génériques et accessibles (flèches, Début, Fin) : défis de l'atelier.

import { $$ } from './util.js';
import { sfx } from './audio.js';

export function initTabs(tablist, onSelect) {
  const tabs = $$('[role="tab"]', tablist);
  const select = (tab, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel && panel.getAttribute('role') === 'tabpanel' && tabs.filter((x) => x.getAttribute('aria-controls') === t.getAttribute('aria-controls')).length === 1) {
        const changed = panel.hidden === on;
        panel.hidden = !on;
        // Prévient le défi concerné : il se met en pause quand on le quitte
        if (changed) panel.dispatchEvent(new CustomEvent(on ? 'panel:show' : 'panel:hide'));
      }
    }
    if (focus) tab.focus();
    onSelect?.(tab);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { select(t); sfx('click'); });
    t.addEventListener('keydown', (e) => {
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let n = null;
      if (e.key in moves) n = (i + moves[e.key] + tabs.length) % tabs.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(tabs[n], true);
    });
  });
  return select;
}

export function initDefis() {
  const list = document.querySelector('.defis-tabs');
  if (list) initTabs(list);
}
