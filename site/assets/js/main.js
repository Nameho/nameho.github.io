// Point d'entrée : chaque module est indépendant ; si l'un plante, les autres continuent.

import { initAudio } from './audio.js';
import { initHud } from './hud.js';
import { initInfo } from './info.js';
import { initNav, initReveal } from './nav.js';
import { initExpress } from './express.js';
import { initCv } from './cv.js';
import { initHero } from './hero.js';
import { initProfile } from './profile.js';
import { initSkills } from './skills.js';
import { initDiag } from './diag.js';
import { initScope } from './scope.js';
import { initWorkshop } from './workshop.js';
import { initDefis } from './defis.js';
import { initBios } from './bios.js';
import { initColors } from './colors.js';
import { initVeille } from './veille.js';
import { initRecruit } from './recruit.js';
import { initContact } from './contact.js';
import { initSecrets } from './secrets.js';
import { initConsole } from './console.js';
import { initSeasons } from './seasons.js';

const modules = {
  audio: initAudio,
  hud: initHud,
  info: initInfo,
  nav: initNav,
  reveal: initReveal,
  express: initExpress,
  cv: initCv,
  hero: initHero,
  profil: initProfile,
  competences: initSkills,
  diagnostic: initDiag,
  parcours: initScope,
  atelier: initWorkshop,
  defis: initDefis,
  bios: initBios,
  couleurs: initColors,
  veille: initVeille,
  recruter: initRecruit,
  contact: initContact,
  secrets: initSecrets,
  console: initConsole,
  saisons: initSeasons,
};

// Tout ce qui est visible à l'arrivée (jusqu'à l'en-tête) démarre avant le premier affichage ;
// le reste attend que la page soit peinte, pour qu'elle apparaisse sans délai sur les petits téléphones.
const FIRST_SCREEN = 'hero';
const nextPaint = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));

for (const [name, init] of Object.entries(modules)) {
  try {
    init();
  } catch (err) {
    console.error(`[${name}]`, err);
  }
  if (name === FIRST_SCREEN) await nextPaint();
}
