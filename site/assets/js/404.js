// Page 404 jouable : on rebranche le fil sur la pastille pour fermer le circuit,
// la LED s'allume… et on retourne à l'accueil (secret « page 404 réparée »).
(function () {
  'use strict';
  var svgEl = document.querySelector('.e404-svg');
  if (!svgEl) return;
  var tip = svgEl.querySelector('.e404-tip');
  var wire = svgEl.querySelector('.e404-wire');
  var lcd = svgEl.querySelector('.e404-lcd');
  var msg = document.querySelector('.e404-msg');
  var START = { x: 200, y: 110 };
  var TARGET = { x: 320, y: 110 };
  var pos = { x: 236, y: 164 };
  var dragging = null;
  var done = false;

  function draw() {
    tip.setAttribute('transform', 'translate(' + pos.x.toFixed(1) + ' ' + pos.y.toFixed(1) + ')');
    var sag = Math.max(20, 90 - Math.abs(pos.x - START.x) * 0.4);
    var mx = (START.x + pos.x) / 2;
    var my = Math.max(START.y, pos.y) + sag;
    wire.setAttribute('d', 'M' + START.x + ' ' + START.y + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + (pos.x - 9).toFixed(1) + ' ' + pos.y.toFixed(1));
  }

  function toSvg(e) {
    var pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  function close() {
    if (done) return;
    done = true;
    pos = { x: TARGET.x - 14, y: TARGET.y };
    draw();
    document.documentElement.classList.add('e404-fixed');
    lcd.textContent = '0.0 Ω';
    msg.textContent = 'Circuit fermé : la LED s’allume ! Retour à l’accueil…';
    try { localStorage.setItem('at-404-fixed', '1'); } catch (err) { /* stockage indisponible */ }
    setTimeout(function () { window.location.href = '/'; }, 1700);
  }

  tip.addEventListener('pointerdown', function (e) {
    if (done) return;
    e.preventDefault();
    var p = toSvg(e);
    dragging = { id: e.pointerId, dx: pos.x - p.x, dy: pos.y - p.y };
    try { tip.setPointerCapture(e.pointerId); } catch (err) { /* suivi via la fenêtre */ }
    tip.classList.add('is-drag');
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    var p = toSvg(e);
    pos = { x: Math.min(500, Math.max(20, p.x + dragging.dx)), y: Math.min(205, Math.max(15, p.y + dragging.dy)) };
    draw();
    svgEl.classList.toggle('is-near', Math.hypot(pos.x + 14 - TARGET.x, pos.y - TARGET.y) < 30);
  });
  function end(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging = null;
    tip.classList.remove('is-drag');
    if (Math.hypot(pos.x + 14 - TARGET.x, pos.y - TARGET.y) < 30) close();
  }
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  tip.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      close();
    }
  });

  draw();
})();
