// Chargé avant l'affichage :
// - signale que JavaScript est actif (évite un « flash » de la version sans JS) ;
// - applique le choix d'animations : celui du visiteur s'il en a fait un, sinon celui du système.
(function () {
  var root = document.documentElement;
  var pref = null;
  try { pref = localStorage.getItem('at-motion'); } catch (e) { /* stockage indisponible */ }
  var reduce = pref ? pref === 'reduced' : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) root.classList.add('reduce-motion');
  // Anti-« clickjacking » : GitHub Pages ne permet pas l'en-tête X-Frame-Options,
  // donc on refuse de s'afficher à l'intérieur d'un cadre (iframe) d'un autre site.
  if (window.top !== window.self) root.classList.add('is-framed');
})();
