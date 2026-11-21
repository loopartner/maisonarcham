/* Fiche parfum : galerie, contenance, quantité, ajout au panier. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const main = document.querySelector('[data-main-img]');
    document.querySelectorAll('.pdp-thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.pdp-thumb').forEach(function (o) { o.setAttribute('aria-pressed', String(o === t)); });
        main.src = t.dataset.img; main.alt = t.dataset.alt;
      });
    });

    const P = window.MACart ? MACart.products : {};
    const MAX = 5;
    let size = (document.querySelector('.size-opt[aria-pressed="true"]') || {}).dataset;
    size = size ? size.size : Object.keys(P)[0];
    let q = 1;
    const qEl = document.querySelector('[data-q]'), dec = document.querySelector('[data-q-dec]'), inc = document.querySelector('[data-q-inc]');
    function render() {
      const p = P[size]; if (!p) return;
      qEl.textContent = String(q);
      dec.disabled = q <= 1; inc.disabled = q >= MAX;
      document.querySelector('[data-price]').textContent = MACart.euros(p.price);
      document.querySelector('[data-line-total]').textContent = MACart.euros(p.price * q);
    }
    document.querySelectorAll('.size-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        size = b.dataset.size;
        document.querySelectorAll('.size-opt').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        render();
      });
    });
    dec.addEventListener('click', function () { q = Math.max(1, q - 1); render(); });
    inc.addEventListener('click', function () { q = Math.min(MAX, q + 1); render(); });
    document.querySelector('[data-buy]').addEventListener('click', function () { MACart.add(size, q); });
    render();
    document.addEventListener('catalogue:change', render);
  });
})();
