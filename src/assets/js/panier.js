/* Page panier : lignes, livraison, code promo. Les montants affichés viennent du serveur (/api/cart/quote). */
(function () {
  'use strict';
  const PREFS = 'archam-checkout';
  function prefs() { try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem(PREFS, JSON.stringify({ shipping: p.shipping, code: p.code })); } catch (e) { /* ignoré */ } }
  window.MACheckoutPrefs = { get: prefs, set: savePrefs };

  const $ = (s, r) => (r || document).querySelector(s);
  let state = prefs(), seq = 0;

  function renderLines(items) {
    const P = MACart.products, ul = $('[data-page-lines]');
    const focused = document.activeElement && ul.contains(document.activeElement) ? Array.from(document.activeElement.attributes).map(function (a) { return a.name; }).find(function (n) { return n.indexOf('data-l-') === 0; }) : null;
    ul.replaceChildren.apply(ul, items.map(function (i) {
      const p = P[i.id], n = $('#tpl-page-line').content.firstElementChild.cloneNode(true);
      n.querySelector('[data-l-img]').src = p.image;
      n.querySelector('[data-l-name]').textContent = p.name;
      n.querySelector('[data-l-variant]').textContent = p.variant;
      n.querySelector('[data-l-unit]').textContent = MACart.euros(p.price);
      n.querySelector('[data-l-qty]').textContent = String(i.qty);
      n.querySelector('[data-l-total]').textContent = MACart.euros(p.price * i.qty);
      const dec = n.querySelector('[data-l-dec]'), inc = n.querySelector('[data-l-inc]');
      dec.setAttribute('aria-label', 'Diminuer la quantité de ' + p.name); inc.setAttribute('aria-label', 'Augmenter la quantité de ' + p.name);
      inc.disabled = i.qty >= 10;
      dec.addEventListener('click', function () { if (i.qty <= 1) MACart.remove(i.id); else MACart.setQty(i.id, i.qty - 1); });
      inc.addEventListener('click', function () { MACart.setQty(i.id, i.qty + 1); });
      n.querySelector('[data-l-remove]').addEventListener('click', function () { MACart.remove(i.id); });
      return n;
    }));
    if (focused) { const el = ul.querySelector('[' + focused + ']:not([disabled])'); if (el) el.focus(); }
  }

  function renderShips(options, current) {
    const box = $('[data-q-ships]');
    if (box.childElementCount === options.length) {
      box.querySelectorAll('input').forEach(function (r) { r.checked = r.value === current; r.closest('label').classList.toggle('on', r.checked); });
      return;
    }
    box.replaceChildren.apply(box, options.map(function (o) {
      const l = document.createElement('label'); l.className = 'ship-opt' + (o.id === current ? ' on' : '');
      const r = document.createElement('input'); r.type = 'radio'; r.name = 'ship'; r.value = o.id; r.checked = o.id === current;
      r.addEventListener('change', function () { state.shipping = o.id; savePrefs(state); refresh(); });
      const a = document.createElement('span'); a.className = 'ship-l'; a.textContent = o.label;
      const b = document.createElement('span'); b.textContent = o.price ? MACart.euros(o.price) : 'Offerte';
      l.append(r, a, b); return l;
    }));
  }

  async function refresh(showPromo) {
    const items = MACart.items();
    $('[data-page-empty]').hidden = items.length > 0;
    $('[data-page-filled]').hidden = items.length === 0;
    if (!items.length) return;
    renderLines(items);
    const my = ++seq;
    const r = await MA.api('/api/cart/quote', { method: 'POST', body: { items: items, shipping: state.shipping, code: state.code || '' } });
    if (my !== seq) return;
    const msg = $('[data-promo-msg]');
    if (!r.ok) { msg.textContent = r.error; msg.className = 'promo-msg err'; msg.hidden = false; return; }
    const q = r.quote;
    $('[data-q-subtotal]').textContent = MACart.euros(q.subtotal);
    $('[data-q-discount-row]').hidden = !q.discount;
    $('[data-q-discount-label]').textContent = q.promo ? q.promo.label : '';
    $('[data-q-discount]').textContent = '− ' + MACart.euros(q.discount);
    $('[data-q-total]').textContent = MACart.euros(q.total);
    renderShips(q.shippingOptions, q.shipping.id);
    if (q.promoError && state.code) { state.code = ''; savePrefs(state); }
    if (showPromo) {
      msg.hidden = false;
      msg.textContent = q.promo ? 'Code appliqué : ' + q.promo.label.replace(/^Code \S+ ?/, '').replace(/[()]/g, '') + ' sur votre commande.' : (q.promoError || '');
      msg.className = 'promo-msg ' + (q.promo ? 'ok' : 'err');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = $('[data-promo]');
    if (state.code) form.elements.code.value = state.code;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      state.code = form.elements.code.value.trim().toUpperCase();
      savePrefs(state); refresh(true);
    });
    document.addEventListener('cart:change', function () { refresh(); });
    refresh();
  });
})();
