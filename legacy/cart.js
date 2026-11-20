/* Maison Archam — panier (partagé entre toutes les pages)
   Le contenu est gardé dans le navigateur du visiteur (localStorage).
   « Commander » mène à la page commande.html (adresse + paiement). */
(function () {
  var KEY = 'archam-cart';
  var PRODUCTS = {
    'creme-dararat-50': {
      name: "Crème d'Ararat",
      variant: 'Extrait de parfum · 50 ml',
      price: 185,
      img: 'assets/product-bottle.webp',
      url: 'produit.html'
    }
  };

  var memory = [];
  function load() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : memory; }
    catch (e) { return memory; }
  }
  function save(items) {
    memory = items;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    render();
  }
  function euro(n) { return n.toLocaleString('fr-FR') + ' €'; }

  function add(id, qty) {
    if (!PRODUCTS[id]) return;
    var items = load(), line = items.find(function (i) { return i.id === id; });
    if (line) line.qty = Math.min(line.qty + qty, 10); else items.push({ id: id, qty: qty });
    save(items);
    open();
  }
  function setQty(id, qty) {
    var items = load().map(function (i) { if (i.id === id) i.qty = qty; return i; })
                      .filter(function (i) { return i.qty > 0; });
    save(items);
  }

  // Tiroir du panier, injecté dans chaque page
  var drawer = document.createElement('div');
  drawer.className = 'cart';
  drawer.innerHTML =
    '<div class="cart-overlay" data-cart-close></div>' +
    '<aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">' +
      '<div class="cart-head"><h2 id="cart-title">Votre panier</h2>' +
      '<button type="button" class="cart-x" data-cart-close aria-label="Fermer le panier">×</button></div>' +
      '<div class="cart-lines"></div>' +
      '<div class="cart-foot">' +
        '<div class="cart-row"><span>Livraison</span><span>Offerte</span></div>' +
        '<div class="cart-row cart-total"><span>Total</span><span class="cart-sum">0 €</span></div>' +
        '<p class="cart-gift">Un échantillon offert avec chaque commande</p>' +
        '<a href="commande.html" class="btn cart-checkout">Commander</a>' +
        '<p class="cart-secure">Paiement sécurisé par Stripe</p>' +
      '</div>' +
    '</aside>';
  document.body.appendChild(drawer);

  function render() {
    var items = load(), count = 0, sum = 0, html = '';
    items.forEach(function (i) {
      var p = PRODUCTS[i.id]; if (!p) return;
      count += i.qty; sum += i.qty * p.price;
      html +=
        '<div class="cart-line">' +
          '<a href="' + p.url + '" class="cart-thumb"><img src="' + p.img + '" alt=""></a>' +
          '<div class="cart-info">' +
            '<p class="cart-name">' + p.name + '</p>' +
            '<p class="cart-variant">' + p.variant + '</p>' +
            '<div class="qty qty-sm">' +
              '<button type="button" data-dec="' + i.id + '" aria-label="Retirer un">−</button>' +
              '<span>' + i.qty + '</span>' +
              '<button type="button" data-inc="' + i.id + '" aria-label="Ajouter un">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-side">' +
            '<p>' + euro(i.qty * p.price) + '</p>' +
            '<button type="button" class="cart-remove" data-remove="' + i.id + '">Retirer</button>' +
          '</div>' +
        '</div>';
    });
    drawer.querySelector('.cart-lines').innerHTML =
      html || '<p class="cart-empty">Votre panier est vide.</p>';
    drawer.querySelector('.cart-sum').textContent = euro(sum);
    drawer.querySelector('.cart-foot').hidden = count === 0;
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = count; });
    if (typeof listeners !== 'undefined') listeners.forEach(function (fn) { fn(); });
    document.querySelectorAll('[data-cart-open]').forEach(function (el) {
      el.setAttribute('aria-label', 'Panier (' + count + ' article' + (count > 1 ? 's' : '') + ')');
    });
  }

  var listeners = [];
  window.ArchamCart = {
    clear: function () { save([]); },
    lines: function () {
      return load().filter(function (i) { return PRODUCTS[i.id]; }).map(function (i) {
        var p = PRODUCTS[i.id];
        return { id: i.id, qty: i.qty, name: p.name, variant: p.variant, price: p.price, img: p.img, url: p.url };
      });
    },
    setQty: function (id, qty) { setQty(id, Math.max(0, Math.min(qty, 10))); },
    onChange: function (fn) { listeners.push(fn); },
    euro: euro
  };

  function open() { drawer.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function close() { drawer.classList.remove('is-open'); document.body.style.overflow = ''; }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a, [data-cart-close]');
    if (!t) return;
    if (t.hasAttribute('data-cart-open')) { open(); return; }
    if (t.hasAttribute('data-cart-close')) { close(); return; }
    if (t.hasAttribute('data-add-to-cart')) {
      var qtyEl = document.querySelector(t.getAttribute('data-qty-from') || '#none');
      add(t.getAttribute('data-add-to-cart'), qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1);
      return;
    }
    var id;
    if ((id = t.getAttribute('data-inc'))) { var l = load().find(function (i) { return i.id === id; }); setQty(id, Math.min(l.qty + 1, 10)); }
    else if ((id = t.getAttribute('data-dec'))) { var m = load().find(function (i) { return i.id === id; }); setQty(id, m.qty - 1); }
    else if ((id = t.getAttribute('data-remove'))) { setQty(id, 0); }

  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('storage', render);

  render();
})();
