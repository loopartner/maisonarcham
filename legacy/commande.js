/* Maison Archam — page de commande
   1. Récapitulatif du panier (modifiable)
   2. Coordonnées + adresse avec auto-complétion (Base Adresse Nationale, via la Géoplateforme IGN)
   3. Paiement par carte / Apple Pay / Google Pay avec Stripe Payment Element */
(function () {
  var cart = window.ArchamCart;
  var root = document.getElementById('co');
  if (!cart || !root) return;
  // Les prix du panier sont en euros
  var euro = function (n) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); };
  var $ = function (sel) { return root.querySelector(sel); };

  // ---------------------------------------------------------------- 1. Récapitulatif
  function renderSummary() {
    var lines = cart.lines();
    var empty = lines.length === 0;
    $('.co-empty').hidden = !empty;
    $('.co-main').hidden = empty;
    root.querySelector('.co-aside').hidden = empty;
    var total = 0, html = '';
    lines.forEach(function (l) {
      total += l.price * l.qty;
      html += '<div class="co-line">' +
        '<div class="co-thumb"><img src="' + l.img + '" alt=""><span class="co-qty-badge">' + l.qty + '</span></div>' +
        '<div class="co-line-info"><p class="cart-name">' + l.name + '</p><p class="cart-variant">' + l.variant + '</p>' +
          (locked ? '' : '<div class="qty qty-sm"><button type="button" data-co-dec="' + l.id + '" aria-label="Retirer un">−</button><span>' + l.qty + '</span><button type="button" data-co-inc="' + l.id + '" aria-label="Ajouter un">+</button></div>') +
        '</div>' +
        '<p class="co-line-price">' + euro(l.price * l.qty) + '</p>' +
      '</div>';
    });
    root.querySelectorAll('.co-lines').forEach(function (el) { el.innerHTML = html; });
    root.querySelectorAll('.co-sub, .co-total, .co-total-inline').forEach(function (el) { el.textContent = euro(total); });
    var pay = document.getElementById('co-pay');
    pay.textContent = 'Payer ' + euro(total);
    return total;
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-co-inc],[data-co-dec]');
    if (!b || locked) return;
    var id = b.getAttribute('data-co-inc') || b.getAttribute('data-co-dec');
    var line = cart.lines().filter(function (l) { return l.id === id; })[0];
    if (line) cart.setQty(id, line.qty + (b.hasAttribute('data-co-inc') ? 1 : -1));
  });
  cart.onChange(renderSummary);

  // ---------------------------------------------------------------- 2. Adresse auto-complétée
  var input = document.getElementById('co-line1');
  var list = document.getElementById('co-ac-list');
  var zip = document.getElementById('co-zip');
  var city = document.getElementById('co-city');
  var country = document.getElementById('co-country');
  var results = [], active = -1, timer = null, lastQuery = '', controller = null;

  function closeList() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); }
  function openList() {
    if (!results.length) return closeList();
    list.innerHTML = results.map(function (r, k) {
      var p = r.properties;
      return '<li role="option" id="co-ac-' + k + '" data-k="' + k + '"' + (k === active ? ' aria-selected="true"' : '') + '>' +
        '<span class="co-ac-main">' + p.name + '</span><span class="co-ac-sub">' + p.postcode + ' ' + p.city + '</span></li>';
    }).join('') + '<li class="co-ac-credit" aria-hidden="true">Base Adresse Nationale</li>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', 'co-ac-' + active);
  }
  function choose(k) {
    var p = results[k] && results[k].properties;
    if (!p) return;
    input.value = p.name;
    zip.value = p.postcode || '';
    city.value = p.city || '';
    closeList();
    [input, zip, city].forEach(function (el) { el.classList.add('is-filled'); });
    document.getElementById('co-line2').focus();
  }
  function search(q) {
    if (controller) controller.abort();
    controller = 'AbortController' in window ? new AbortController() : null;
    var url = 'https://data.geopf.fr/geocodage/search?index=address&autocomplete=1&limit=5&q=' + encodeURIComponent(q);
    fetch(url, controller ? { signal: controller.signal } : {})
      .then(function (r) { return r.ok ? r.json() : { features: [] }; })
      .then(function (data) {
        if (input.value.trim() !== q) return;
        results = (data.features || []).filter(function (f) { return f.properties && f.properties.name; });
        active = -1; openList();
      })
      .catch(function () { /* service indisponible : on saisit simplement à la main */ });
  }
  input.addEventListener('input', function () {
    input.classList.remove('is-filled');
    var q = input.value.trim();
    clearTimeout(timer);
    if (country.value !== 'FR' || q.length < 3) { results = []; return closeList(); }
    if (q === lastQuery) return;
    timer = setTimeout(function () { lastQuery = q; search(q); }, 200);
  });
  input.addEventListener('keydown', function (e) {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % results.length; openList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % results.length; openList(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { closeList(); }
  });
  list.addEventListener('mousedown', function (e) {
    var li = e.target.closest('[data-k]');
    if (li) { e.preventDefault(); choose(+li.getAttribute('data-k')); }
  });
  input.addEventListener('blur', function () { setTimeout(closeList, 120); });

  // ---------------------------------------------------------------- 3. Paiement
  var form = document.getElementById('co-form');
  var stepPay = document.getElementById('step-payment');
  var stepShip = document.getElementById('step-shipping');
  var stepContact = document.getElementById('step-contact');
  var btnContinue = document.getElementById('co-continue');
  var btnPay = document.getElementById('co-pay');
  var err1 = document.getElementById('co-error-1');
  var err2 = document.getElementById('co-error-2');
  var locked = false, stripe = null, elements = null, customer = null;

  function values() {
    var d = {};
    form.querySelectorAll('#step-contact [name], #step-shipping [name]').forEach(function (el) { d[el.name] = el.value.trim(); });
    return d;
  }
  function loadStripe() {
    return new Promise(function (resolve, reject) {
      if (window.Stripe) return resolve(window.Stripe);
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = function () { resolve(window.Stripe); };
      s.onerror = function () { reject(new Error('Impossible de charger le module de paiement. Vérifiez votre connexion.')); };
      document.head.appendChild(s);
    });
  }
  function setLocked(on) {
    locked = on;
    stepContact.disabled = on; stepShip.disabled = on;
    stepContact.classList.toggle('is-done', on); stepShip.classList.toggle('is-done', on);
    stepPay.disabled = !on; stepPay.classList.toggle('is-locked', !on);
    btnContinue.hidden = on;
    var recap = document.getElementById('co-recap');
    recap.hidden = !on;
    if (on) {
      recap.innerHTML = '<span>' + customer.firstName + ' ' + customer.lastName + ' · ' + customer.email + '<br>' +
        customer.line1 + (customer.line2 ? ', ' + customer.line2 : '') + ', ' + customer.postalCode + ' ' + customer.city + '</span>' +
        '<button type="button" class="co-edit">Modifier</button>';
    }
    renderSummary();
  }
  stepPay.addEventListener('click', function (e) {
    if (!e.target.closest('.co-edit')) return;
    setLocked(false);
    btnPay.hidden = true;
    if (elements) { var pe = elements.getElement('payment'); if (pe) pe.destroy(); elements = null; }
    document.getElementById('payment-element').innerHTML = '';
    document.getElementById('co-email').focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err1.textContent = '';
    if (!form.checkValidity()) {
      var bad = form.querySelector('#step-contact :invalid, #step-shipping :invalid');
      err1.textContent = 'Merci de compléter les champs indiqués.';
      form.classList.add('was-validated');
      if (bad) bad.focus();
      return;
    }
    customer = values();
    btnContinue.disabled = true; btnContinue.textContent = 'Préparation du paiement…';
    var items = cart.lines().map(function (l) { return { id: l.id, qty: l.qty }; });
    fetch('/api/payment-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items, customer: customer }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Le paiement est momentanément indisponible.');
        return loadStripe().then(function (Stripe) {
          stripe = Stripe(res.publishableKey, { locale: 'fr' });
          elements = stripe.elements({
            clientSecret: res.clientSecret,
            fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500&display=swap' }],
            appearance: {
              theme: 'flat',
              variables: {
                fontFamily: 'Manrope, system-ui, sans-serif', fontSizeBase: '14px', fontWeightNormal: '300',
                colorPrimary: '#1f2a2e', colorText: '#1f2a2e', colorBackground: '#ffffff', colorDanger: '#8a3b2e',
                borderRadius: '2px', spacingUnit: '4px'
              },
              rules: {
                '.Input': { border: '1px solid #d6d6d2', boxShadow: 'none', padding: '12px' },
                '.Input:focus': { border: '1px solid #1f2a2e', boxShadow: 'none' },
                '.Label': { fontSize: '10px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase' },
                '.Tab': { border: '1px solid #d6d6d2', boxShadow: 'none' },
                '.Tab--selected': { border: '1px solid #1f2a2e', boxShadow: 'none' }
              }
            }
          });
          elements.create('payment', {
            layout: { type: 'tabs' },
            defaultValues: { billingDetails: { name: customer.firstName + ' ' + customer.lastName, email: customer.email, phone: customer.phone,
              address: { line1: customer.line1, line2: customer.line2, postal_code: customer.postalCode, city: customer.city, country: customer.country } } }
          }).mount('#payment-element');
          setLocked(true);
          btnPay.hidden = false;
          stepPay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      })
      .catch(function (e) { err1.textContent = e.message; if (window.console) console.error('[commande]', e); })
      .finally(function () { btnContinue.disabled = false; btnContinue.textContent = 'Continuer vers le paiement'; });
  });

  btnPay.addEventListener('click', function () {
    if (!stripe || !elements) return;
    err2.textContent = '';
    btnPay.disabled = true; var label = btnPay.textContent; btnPay.textContent = 'Paiement en cours…';
    stripe.confirmPayment({
      elements: elements,
      confirmParams: { return_url: location.origin + '/merci.html', receipt_email: customer.email }
    }).then(function (r) {
      // On n'arrive ici qu'en cas d'erreur : sinon Stripe redirige vers merci.html
      if (r.error) err2.textContent = r.error.type === 'card_error' || r.error.type === 'validation_error'
        ? r.error.message : 'Le paiement n’a pas abouti. Merci de réessayer.';
      btnPay.disabled = false; btnPay.textContent = label;
    });
  });

  renderSummary();
})();
