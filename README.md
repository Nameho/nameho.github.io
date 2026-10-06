# Portfolio — Alexis Trudelle, technicien réparateur en électronique

**Site en ligne : https://nameho.github.io**

Un portfolio « one-page » pensé comme un banc de réparation : on ne fait pas que lire, on dépanne.

| Section | Interaction |
| --- | --- |
| Accueil | Circuit imprimé généré en temps réel : la souris révèle le cuivre sous le vernis, un clic envoie une impulsion de courant. |
| Profil | Fiche technique façon *datasheet*, avec le brochage d'un circuit intégré (une qualité par broche). |
| Compétences | Un boîtier à dévisser (geste circulaire ou clic), puis une carte dont chaque composant est une compétence. |
| Trouve la panne | Un vrai petit circuit simulé et un multimètre (V, Ω, continuité avec bip, test diode). Une panne aléatoire est cachée : mesurer, trouver, remplacer, vérifier. Les pièces soudées se remplacent au **poste de soudure** (vue en coupe) : flux, tresse et fer pour dessouder, pose dans le bon sens, soudure fer puis étain, coupe des pattes, nettoyage à l'alcool, contrôle qualité. Une soudure froide ou un composant à l'envers se paient à la mise sous tension. |
| Parcours | Un oscilloscope 2 voies (expériences / formations) avec curseurs de mesure Δt et base de temps réglable. |
| Atelier | Des bons d'intervention tamponnés et un rapport d'évaluation d'immersion. |
| Défis de l'atelier | « Bips du BIOS » (un PC refuse de démarrer : bips, voyants, ventilateur, écran) et un quiz chronométré du code couleur des résistances, avec mémo. |
| Veille | Articles et vidéos sur la réparation et l'électronique, mis à jour automatiquement chaque jour, filtrables avec des interrupteurs DIP. |
| Me recruter | PMSMP, POEI, formation interne expliquées sous forme de devis. |
| Contact | Trois composants à souder (avec échelle de températures) ; l'écran OLED démarre alors (barre de chargement irrégulière, journal de démarrage, le fameux 99 %) puis affiche les coordonnées (protection contre les robots). |

- **Version express** : un résumé « recruteur pressé » en 30 secondes, imprimable (lien direct : `https://nameho.github.io/#express`).
- **CV en PDF** : publié chiffré, déverrouillé après un petit test anti-robot (brancher la fiche dans la prise).
- **Banc de test** en bas à droite : 7 défis… et 7 secrets à trouver (indices dans le panneau).
- **Surprises de saison** : en décembre et le 1er avril.

## Technique

- HTML, CSS et JavaScript natifs : **aucune bibliothèque, aucun framework, aucune dépendance npm**.
- Animations en Canvas 2D, SVG et Web Animations API ; sons synthétisés avec Web Audio (rien à télécharger).
- Accessible : navigation au clavier, lecteurs d'écran (mesures annoncées), alternative aux glisser-déposer, respect du réglage « animations réduites » (modifiable avec le bouton ∿).
- Responsive : téléphone, tablette, ordinateur.
- Référencement : données structurées schema.org (ProfilePage / Person), plan du site `sitemap.xml`, aperçu de lien (Open Graph).
- Audit Lighthouse (octobre 2026) : accessibilité, bonnes pratiques et SEO à 100 ; performance 99 sur ordinateur.

## Sécurité et vie privée

- Politique de sécurité du contenu (CSP) stricte : seuls les fichiers du site peuvent être chargés.
- Aucun cookie, aucun traceur, aucune ressource externe (polices hébergées sur le site).
- Coordonnées absentes du code HTML : encodées, puis décodées seulement après une action du visiteur.
- CV chiffré (AES-256-GCM) : le PDF en clair n'est jamais publié, ni sur le site ni dans le dépôt.
- Les données de veille sont nettoyées à la récupération **et** à l'affichage (texte brut uniquement, liens HTTPS vérifiés).
- GitHub Actions : droits minimaux par tâche, actions épinglées par empreinte SHA, mises à jour proposées par Dependabot.

## Veille automatique

[`scripts/veille.mjs`](scripts/veille.mjs) lit les flux RSS listés dans [`scripts/veille-sources.json`](scripts/veille-sources.json) et écrit `site/data/veille.json`.
Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) le lance chaque matin puis republie le site.

Sources actuelles : iFixit, HOP (Halte à l'obsolescence programmée), Learn Electronics Repair, Électro-Bidouilleur, Hackaday, Framboise314.

## Aperçu en local

```bash
node scripts/serve.mjs
```

Puis ouvrir http://localhost:8080 (Node.js 20 ou plus récent).

## Structure

```
site/                    ← ce qui est publié
  index.html
  mentions-legales.html
  404.html
  robots.txt, sitemap.xml
  assets/css, js, fonts
  assets/cv/cv.bin       ← CV chiffré
  data/veille.json       ← généré automatiquement
scripts/
  veille.mjs             ← robot de veille (sans dépendance)
  veille-sources.json    ← liste des flux
  encrypt-cv.mjs         ← chiffre le CV (prive/ → site/assets/cv/)
  serve.mjs              ← serveur d'aperçu local
  og-image.html / .mjs   ← image d'aperçu des liens (node scripts/og-image.mjs → site/assets/og-image.png)
.github/workflows/deploy.yml
```

## Crédits

Code écrit avec [Claude](https://www.anthropic.com/claude) (IA d'Anthropic), à partir des idées, des demandes et des contenus d'Alexis Trudelle, qui a tout testé et fait retoucher au fil des versions.

Polices [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) et [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), sous licence SIL Open Font License 1.1 (voir `site/assets/fonts/`).
