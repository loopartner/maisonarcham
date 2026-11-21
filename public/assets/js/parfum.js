/* Fiche parfum : galerie, contenance, quantité, ajout au panier. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const main = document.querySelector('[data-main-img]');
    const thumbs = Array.from(document.querySelectorAll('.pdp-thumb'));
    const dots = document.querySelector('[data-dots]');
    let cur = 0;
    function show(i) {
      cur = (i + thumbs.length) % thumbs.length;
      const t = thumbs[cur];
      thumbs.forEach(function (o) { o.setAttribute('aria-pressed', String(o === t)); });
      main.src = t.dataset.img; main.alt = t.dataset.alt;
      Array.from(dots.children).forEach(function (d, k) { d.classList.toggle('on', k === cur); });
    }
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); dots.append(document.createElement('span')); });
    document.querySelector('[data-img-prev]').addEventListener('click', function () { show(cur - 1); });
    document.querySelector('[data-img-next]').addEventListener('click', function () { show(cur + 1); });
    // Balayage du doigt sur mobile
    let x0 = null;
    main.parentElement.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    main.parentElement.addEventListener('touchend', function (e) {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    if (thumbs.length) show(0);

    const P = window.MACart ? MACart.products : {};
    const MAX = 5;
    let size = (document.querySelector('.size-opt[aria-pressed="true"]') || {}).dataset;
    size = size ? size.size : Object.keys(P)[0];
    let q = 1;
    const all = (s) => Array.from(document.querySelectorAll(s));
    function render() {
      const p = P[size]; if (!p) return;
      all('[data-q]').forEach(function (el) { el.textContent = String(q); });
      all('[data-q-dec]').forEach(function (b) { b.disabled = q <= 1; });
      all('[data-q-inc]').forEach(function (b) { b.disabled = q >= MAX; });
      document.querySelector('[data-price]').textContent = MACart.euros(p.price);
      all('[data-line-total]').forEach(function (el) { el.textContent = MACart.euros(p.price * q); });
      all('[data-buy]').forEach(function (b) { b.disabled = p.available === false; });
    }
    document.querySelectorAll('.size-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        size = b.dataset.size;
        document.querySelectorAll('.size-opt').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        render();
      });
    });
    all('[data-q-dec]').forEach(function (b) { b.addEventListener('click', function () { q = Math.max(1, q - 1); render(); }); });
    all('[data-q-inc]').forEach(function (b) { b.addEventListener('click', function () { q = Math.min(MAX, q + 1); render(); }); });
    all('[data-buy]').forEach(function (b) { b.addEventListener('click', function () { MACart.add(size, q); }); });
    render();
    document.addEventListener('catalogue:change', render);
  });
})();
