/* Panier Maison Archam — gardé dans le navigateur (localStorage).
   Les prix affichés viennent du catalogue injecté au build ; le serveur recalcule TOUJOURS le prix au paiement. */
(function () {
  'use strict';
  const KEY = 'archam-cart';
  let catalogue = { maxQty: 10, products: {} };
  try { catalogue = JSON.parse(document.getElementById('ma-catalogue').textContent); } catch (e) { /* catalogue absent */ }
  const P = catalogue.products, MAX = catalogue.maxQty || 10;
  let memory = [];

  function sanitize(items) {
    if (!Array.isArray(items)) return [];
    const out = [];
    items.forEach(function (i) {
      const qty = Math.floor(Number(i && i.qty));
      if (i && P[i.id] && qty > 0 && !out.some(function (o) { return o.id === i.id; })) out.push({ id: i.id, qty: Math.min(qty, MAX) });
    });
    return out;
  }
  function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return sanitize(memory); } }
  function save(items) {
    memory = sanitize(items);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* navigation privée */ }
    render();
    document.dispatchEvent(new CustomEvent('cart:change', { detail: memory }));
  }
  function euros(cents) {
    return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }) + '\u00a0€';
  }
  function totals(items) {
    const qty = items.reduce(function (n, i) { return n + i.qty; }, 0);
    const sub = items.reduce(function (n, i) { return n + i.qty * P[i.id].price; }, 0);
    return { qty: qty, subtotal: sub };
  }

  function add(id, qty) {
    if (!P[id]) return;
    const items = load(), line = items.find(function (i) { return i.id === id; });
    if (line) line.qty = Math.min(line.qty + (qty || 1), MAX); else items.push({ id: id, qty: Math.min(qty || 1, MAX) });
    save(items);
    toast(P[id].name + ' a été ajouté à votre panier');
    open();
  }
  function setQty(id, qty) { save(load().map(function (i) { return i.id === id ? { id: id, qty: qty } : i; })); }
  function remove(id) { save(load().filter(function (i) { return i.id !== id; })); }
  function clear() { save([]); }

  // ---------- Tiroir ----------
  const drawer = document.querySelector('[data-cart-drawer]');
  let lastFocus = null;
  function open() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false; document.body.classList.add('menu-open');
    const c = drawer.querySelector('.cd-head [data-cart-close]'); if (c) c.focus();
  }
  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true; document.body.classList.remove('menu-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function lineNode(i) {
    const tpl = document.getElementById('tpl-cart-line');
    const n = tpl.content.firstElementChild.cloneNode(true);
    const p = P[i.id];
    n.querySelector('[data-l-img]').src = p.image;
    n.querySelector('[data-l-name]').textContent = p.name;
    n.querySelector('[data-l-variant]').textContent = p.variant;
    n.querySelector('[data-l-qty]').textContent = String(i.qty);
    n.querySelector('[data-l-total]').textContent = euros(i.qty * p.price);
    const dec = n.querySelector('[data-l-dec]'), inc = n.querySelector('[data-l-inc]');
    dec.setAttribute('aria-label', 'Retirer un ' + p.name); inc.setAttribute('aria-label', 'Ajouter un ' + p.name);
    inc.disabled = i.qty >= MAX;
    dec.addEventListener('click', function () { if (i.qty <= 1) remove(i.id); else setQty(i.id, i.qty - 1); });
    inc.addEventListener('click', function () { setQty(i.id, i.qty + 1); });
    n.querySelector('[data-l-remove]').addEventListener('click', function () { remove(i.id); });
    return n;
  }

  function render() {
    const items = load(), t = totals(items);
    document.querySelectorAll('[data-cart-qty]').forEach(function (el) { el.textContent = String(t.qty); });
    document.querySelectorAll('[data-cart-subtotal]').forEach(function (el) { el.textContent = euros(t.subtotal); });
    document.querySelectorAll('[data-cart-empty]').forEach(function (el) { el.hidden = t.qty > 0; });
    document.querySelectorAll('[data-cart-filled]').forEach(function (el) { el.hidden = t.qty === 0; });
    document.querySelectorAll('[data-cart-lines]').forEach(function (ul) {
      const focusedAction = document.activeElement && ul.contains(document.activeElement) ? Array.from(document.activeElement.attributes).map(function (a) { return a.name; }).find(function (n) { return n.indexOf('data-l-') === 0; }) : null;
      ul.replaceChildren.apply(ul, items.map(lineNode));
      if (focusedAction) { const el = ul.querySelector('[' + focusedAction + ']:not([disabled])'); if (el) el.focus(); }
    });
    if (window.MA && MA.renderCart) MA.renderCart();
  }

  let toastTimer;
  function toast(msg) {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  window.MACart = { add: add, setQty: setQty, remove: remove, clear: clear, items: load, totals: function () { return totals(load()); }, euros: euros, products: P, open: open, toast: toast };

  // Prix à jour : le catalogue du serveur remplace celui injecté au build (modifications faites depuis l'admin).
  async function refreshCatalogue() {
    try {
      const res = await fetch('/api/catalogue', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !data.products) return;
      Object.keys(P).forEach(function (id) { if (!data.products[id]) delete P[id]; });
      Object.keys(data.products).forEach(function (id) { P[id] = data.products[id]; });
      document.querySelectorAll('[data-price-of]').forEach(function (el) { const p = P[el.dataset.priceOf]; if (p) el.textContent = euros(p.price); });
      document.querySelectorAll('[data-add-to-cart]').forEach(function (b) {
        const p = P[b.dataset.addToCart];
        if (p && p.available === false) { b.disabled = true; b.textContent = 'Épuisé'; }
      });
      render();
      document.dispatchEvent(new CustomEvent('catalogue:change'));
    } catch (e) { /* le catalogue du build reste utilisé */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    refreshCatalogue();
    // Le pictogramme panier de l'en-tête ouvre le tiroir (lien de secours vers /panier sans JavaScript)
    document.querySelectorAll('[data-cart-link]').forEach(function (a) { a.addEventListener('click', function (e) { if (drawer) { e.preventDefault(); open(); } }); });
    document.querySelectorAll('[data-add-to-cart]').forEach(function (b) {
      b.addEventListener('click', function () {
        const qtyInput = b.dataset.qtyFrom ? document.querySelector(b.dataset.qtyFrom) : null;
        add(b.dataset.addToCart, qtyInput ? Math.max(1, Math.floor(Number(qtyInput.textContent || qtyInput.value) || 1)) : 1);
      });
    });
    if (drawer) {
      drawer.querySelectorAll('[data-cart-close]').forEach(function (b) { b.addEventListener('click', close); });
      drawer.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
          const f = Array.from(drawer.querySelectorAll('.cd-panel a, .cd-panel button:not([disabled])')).filter(function (x) { return x.offsetParent !== null; });
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
    }
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) render(); });
})();
