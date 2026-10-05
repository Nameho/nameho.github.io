// Contenu des fiches « Le saviez-vous ? » et « Secret débloqué ».
// Chaque fiche : titre, texte, quelques faits, et un lien pour aller plus loin.

const W = (page) => `https://fr.wikipedia.org/wiki/${page}`;

export const INFO = {
  /* ---------- Secrets ---------- */
  'secret-blueprint': {
    icon: '🎮',
    title: 'Vous avez activé le code Konami !',
    text: [
      '↑ ↑ ↓ ↓ ← → ← → B A : c’est le « code de triche » le plus célèbre du jeu vidéo. Il a été créé par Kazuhisa Hashimoto, développeur chez Konami, pendant l’adaptation du jeu Gradius sur la console Famicom de Nintendo (1986).',
      'Il trouvait le jeu trop difficile pour ses propres tests : le code donnait d’un coup tous les bonus. Il l’a laissé dans la version finale… et les joueurs l’ont découvert.',
    ],
    facts: [
      'Il est devenu légendaire avec Contra (1988), où il donne 30 vies au lieu de 3.',
      'Depuis, des centaines de sites web le cachent en clin d’œil, comme celui-ci.',
      'Pourquoi le site devient bleu ? Les plans techniques étaient autrefois tirés en cyanotype (procédé inventé par John Herschel en 1842) : des tirages bleus, d’où le mot anglais « blueprint ».',
    ],
    link: { href: W('Code_Konami'), label: 'Le code Konami sur Wikipédia' },
  },
  'secret-thermal': {
    icon: '🌡️',
    title: 'Caméra thermique activée',
    text: [
      'Tout objet émet un rayonnement infrarouge, d’autant plus intense qu’il est chaud. Une caméra thermique mesure ce rayonnement et le traduit en « fausses couleurs » : violet pour le froid, jaune puis blanc pour le chaud.',
    ],
    facts: [
      'En réparation, elle trouve en quelques secondes un composant en court-circuit : c’est lui qui chauffe anormalement.',
      'Astuce d’atelier : injecter une petite tension, limitée en courant, sur une ligne en court-circuit, puis chercher le point chaud.',
      'Les surfaces métalliques brillantes trompent la caméra : elles émettent peu d’infrarouge (on parle d’émissivité).',
    ],
    link: { href: W('Cam%C3%A9ra_thermique'), label: 'La caméra thermique sur Wikipédia' },
  },
  'secret-trace': {
    icon: '🔧',
    title: 'Piste coupée réparée',
    text: [
      'Sur un circuit imprimé, une piste est un fin ruban de cuivre (souvent 35 µm d’épaisseur, moins qu’un cheveu). Elle peut se couper : choc, carte tordue, corrosion après un liquide renversé, ou surintensité qui la fait brûler.',
    ],
    facts: [
      'On la repère à la loupe et au multimètre, en mode continuité.',
      'Réparation classique : gratter le vernis, étamer le cuivre, puis souder un fil fin (un « strap ») par-dessus la coupure.',
      'Une piste brûlée signale souvent une autre panne : on cherche toujours ce qui a provoqué la surintensité.',
    ],
    link: { href: W('Circuit_imprim%C3%A9'), label: 'Le circuit imprimé sur Wikipédia' },
  },
  'secret-cordons': {
    icon: '📏',
    title: 'Test des cordons : le bon réflexe',
    text: [
      'Avant de mesurer, on touche les deux pointes ensemble : l’ohmmètre doit afficher presque 0 Ω (ici 0,2 Ω, la résistance des fils). Un cordon coupé ou usé fausserait toutes les mesures suivantes.',
    ],
    facts: [
      'Beaucoup de multimètres ont une touche REL (relatif) qui retranche automatiquement cette valeur.',
      'En électricité, la vérification d’absence de tension (VAT) suit le même principe : on contrôle son appareil sur une source connue, avant et après la mesure.',
      'Les cordons doivent aussi correspondre à la catégorie de mesure (CAT II, III ou IV) indiquée sur le multimètre.',
    ],
    link: { href: W('Multim%C3%A8tre'), label: 'Le multimètre sur Wikipédia' },
  },
  'secret-fuse': {
    icon: '💥',
    title: 'Fusible maltraité',
    text: [
      'Un fusible est un point faible volontaire : un fil calibré qui fond quand le courant dépasse sa valeur. Il se sacrifie pour protéger le reste de l’appareil, et éviter un départ de feu.',
    ],
    facts: [
      'Le marquage compte : « F » = rapide, « T » = temporisé (il tolère les pics au démarrage, d’un moteur par exemple).',
      'On le remplace toujours par un modèle identique : même calibre, même type, même tension.',
      'Ne jamais le « shunter » avec un fil : c’est supprimer la protection.',
      'Un fusible neuf qui saute aussitôt signale une panne en aval à trouver.',
    ],
    link: { href: W('Fusible_(%C3%A9lectricit%C3%A9)'), label: 'Le fusible sur Wikipédia' },
  },
  'secret-console': {
    icon: '💻',
    title: 'Bienvenue dans la console',
    text: [
      'La touche F12 ouvre les outils de développement du navigateur : on y voit le code de la page, les fichiers chargés, les erreurs… C’est l’atelier du développeur web, avec ses propres « multimètres ».',
    ],
    facts: [
      'Tous les grands navigateurs en ont : Chrome, Firefox, Edge, Safari.',
      'Ce site n’utilise aucune bibliothèque : tout est écrit à la main en HTML, CSS et JavaScript.',
      'Conseil de sécurité : ne collez jamais dans la console un code que vous ne comprenez pas. C’est une arnaque courante pour voler des comptes.',
    ],
    link: { href: 'https://github.com/Nameho/nameho.github.io', label: 'Le code source de ce site' },
  },
  'secret-page404': {
    icon: '🧭',
    title: 'Page 404 réparée',
    text: [
      '« 404 » est un code du protocole HTTP, la langue que parlent navigateurs et serveurs. Il signifie : « je ne trouve pas cette page ». Ces codes sont rangés par centaines.',
    ],
    facts: [
      '2xx : tout va bien (200 = OK).',
      '3xx : redirection (301 = la page a déménagé).',
      '4xx : erreur côté visiteur (404 = introuvable, 403 = accès interdit).',
      '5xx : erreur côté serveur (500 = erreur interne).',
      'La légende d’un « bureau 404 » au CERN, berceau du Web, est un mythe sympathique.',
    ],
    link: { href: W('Liste_des_codes_HTTP'), label: 'Les codes HTTP sur Wikipédia' },
  },

  /* ---------- Le saviez-vous ? ---------- */
  multimetre: {
    icon: '🔌',
    title: 'Le multimètre, outil n° 1 du réparateur',
    text: [
      'Il mesure surtout trois grandeurs : la tension (en volts), la résistance (en ohms) et l’intensité (en ampères). Il sait aussi tester la continuité (bip) et les diodes.',
    ],
    facts: [
      'La tension se mesure en parallèle, aux bornes du composant ; l’intensité en série, en ouvrant le circuit.',
      'Jamais de mesure de résistance sous tension : la mesure est fausse… et l’appareil peut souffrir.',
      'Loi d’Ohm : U = R × I. Dans ce jeu, quand tout marche, environ 15 mA traversent R1 (470 Ω), soit à peu près 7 V à ses bornes.',
      'Dans un circuit en série ouvert, presque toute la tension se retrouve aux bornes de la coupure : c’est la clé du jeu.',
    ],
    link: { href: W('Multim%C3%A8tre'), label: 'Le multimètre sur Wikipédia' },
  },
  oscilloscope: {
    icon: '📈',
    title: 'L’oscilloscope : voir l’électricité bouger',
    text: [
      'Un multimètre donne un chiffre ; un oscilloscope trace la tension en fonction du temps. On voit la forme d’un signal : une horloge, des données, une alimentation qui ondule…',
    ],
    facts: [
      'Chaque voie (CH1, CH2) affiche un signal : on peut en comparer plusieurs.',
      'TIME/DIV règle l’échelle horizontale : la durée représentée par chaque carreau de la grille.',
      'Les curseurs A et B mesurent un écart de temps (Δt) ou de tension entre deux points.',
      'En réparation, il sert par exemple à contrôler une alimentation à découpage ou un signal d’horloge.',
    ],
    link: { href: W('Oscilloscope'), label: 'L’oscilloscope sur Wikipédia' },
  },
  post: {
    icon: '🖥',
    title: 'Le POST : l’autotest du démarrage',
    text: [
      'À chaque mise sous tension, le BIOS (ou l’UEFI, son successeur) lance le POST, pour « Power-On Self-Test » : il vérifie le processeur, la mémoire et la carte graphique avant de démarrer le système.',
    ],
    facts: [
      'Si une panne survient avant que l’écran fonctionne, la carte mère s’exprime autrement : bips sur le haut-parleur ou voyants de diagnostic.',
      'Les codes changent selon le fabricant du BIOS (AMI, Award, Phoenix…) : on consulte toujours le manuel de la carte.',
      'Beaucoup de cartes récentes ont des voyants « DEBUG » (CPU, DRAM, VGA, BOOT) qui montrent l’étape bloquante.',
      'Premiers réflexes, avant tout remplacement : réinsérer la RAM et vérifier les câbles d’alimentation.',
    ],
    link: { href: W('Power-on_self-test'), label: 'Le POST sur Wikipédia' },
  },
  couleurs: {
    icon: '🎨',
    title: 'Pourquoi des anneaux de couleur ?',
    text: [
      'Sur une petite résistance cylindrique, des chiffres imprimés seraient minuscules et cachés selon l’angle. Des anneaux de couleur se lisent de tous les côtés : c’est un code normalisé (norme CEI 60062).',
    ],
    facts: [
      'Les valeurs suivent des « séries » : la série E12 propose 12 valeurs par décade (10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82).',
      'Chaque valeur vaut environ 1,2 fois la précédente : avec une tolérance de ±10 %, elles se recouvrent et couvrent tous les besoins.',
      'Sens de lecture : l’anneau de tolérance (or ou argent) est à droite, souvent un peu écarté des autres.',
      'Les composants CMS, trop petits pour des anneaux, portent un code chiffré : « 471 » = 47 × 10 = 470 Ω.',
    ],
    link: { href: W('Code_couleur_des_r%C3%A9sistances'), label: 'Le code couleur sur Wikipédia' },
  },
  soudure: {
    icon: '🔥',
    title: 'Souder avec ou sans plomb ?',
    text: [
      'Depuis le 1er juillet 2006, la directive européenne RoHS interdit le plomb dans la plupart des appareils électroniques vendus en Europe. Les fabricants sont passés aux alliages sans plomb, à base d’étain, d’argent et de cuivre.',
    ],
    facts: [
      'L’étain-plomb (63/37) fond à 183 °C ; le sans-plomb vers 217 °C : il demande plus de chaleur.',
      'Une soudure sans plomb réussie est souvent un peu moins brillante : ce n’est pas forcément une soudure froide.',
      'Le flux nettoie les oxydes et aide l’étain à « mouiller » la pastille ; ses fumées s’aspirent avec un extracteur.',
      'En réparation, on évite de mélanger les deux alliages sur une même soudure.',
    ],
    link: { href: W('Directive_RoHS'), label: 'La directive RoHS sur Wikipédia' },
  },
  reparation: {
    icon: '♻️',
    title: 'Le droit à la réparation',
    text: [
      'Réparer plutôt que jeter devient une politique publique. En France, la loi anti-gaspillage (AGEC, 2020) a créé l’indice de réparabilité, affiché depuis 2021 sur des produits comme les smartphones ou les ordinateurs portables.',
    ],
    facts: [
      'En 2025, l’indice de durabilité l’a remplacé pour les téléviseurs (janvier) et les lave-linge (avril) : il ajoute la fiabilité aux critères de réparation.',
      'Le « bonus réparation » réduit directement la facture chez les réparateurs labellisés QualiRépar.',
      'En Europe, la directive 2024/1799 sur la réparation des biens s’applique depuis juillet 2026.',
      'iFixit et l’association HOP, présents dans la veille ci-dessous, partagent des guides et défendent ce droit.',
    ],
    link: { href: 'https://www.ecologie.gouv.fr/politiques-publiques/indice-reparabilite', label: 'L’indice de réparabilité (ministère)' },
  },
};
