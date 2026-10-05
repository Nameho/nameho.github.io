// Point d'entrée : chaque module est indépendant ; si l'un plante, les autres continuent.

import { initAudio } from './audio.js';
import { initHud } from './hud.js';
import { initNav, initReveal } from './nav.js';
import { initHero } from './hero.js';
import { initProfile } from './profile.js';
import { initSkills } from './skills.js';
import { initDiag } from './diag.js';
import { initScope } from './scope.js';
import { initWorkshop } from './workshop.js';
import { initVeille } from './veille.js';
import { initContact } from './contact.js';

const modules = {
  audio: initAudio,
  hud: initHud,
  nav: initNav,
  reveal: initReveal,
  hero: initHero,
  profil: initProfile,
  competences: initSkills,
  diagnostic: initDiag,
  parcours: initScope,
  atelier: initWorkshop,
  veille: initVeille,
  contact: initContact,
};

for (const [name, init] of Object.entries(modules)) {
  try {
    init();
  } catch (err) {
    console.error(`[${name}]`, err);
  }
}
