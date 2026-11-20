/* Maison Archam — petites interactions communes */
(function () {
  // Menu mobile
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.classList.toggle('menu-open', open);
    if (open) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('is-open'); }); }
    else { menu.classList.remove('is-open'); setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300); }
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1024) setMenu(false); });

  // Barre « Ajouter au panier » fixe sur mobile (fiche produit)
  var mainBuy = document.querySelector('.pdp-info [data-add-to-cart]');
  var sticky = document.querySelector('.sticky-buy');
  if (mainBuy && sticky && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var past = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      sticky.classList.toggle('is-visible', past);
    }).observe(mainBuy);
  }

  // Points des carrousels mobiles
  document.querySelectorAll('[data-carousel]').forEach(function (track) {
    var dots = document.createElement('div');
    dots.className = 'carousel-dots';
    var items = Array.prototype.slice.call(track.children);
    items.forEach(function (_, k) {
      var d = document.createElement('button');
      d.type = 'button'; d.setAttribute('aria-label', 'Image ' + (k + 1));
      d.addEventListener('click', function () { track.scrollTo({ left: items[k].offsetLeft - track.offsetLeft, behavior: 'smooth' }); });
      dots.appendChild(d);
    });
    track.after(dots);
    function update() {
      var idx = Math.round(track.scrollLeft / (items[0].offsetWidth + 16));
      Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('is-active', k === Math.min(idx, items.length - 1)); });
    }
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('load', update);
    update();
  });

  // Formulaires pas encore reliés à un service : on affiche un message de confirmation
  document.querySelectorAll('form[data-fake-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-msg');
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'form-msg';
        msg.setAttribute('role', 'status');
        form.appendChild(msg);
      }
      msg.textContent = form.getAttribute('data-fake-form');
      form.reset();
    });
  });

  // Formulaires reliés au serveur (newsletter, contact, suivi de commande)
  function message(form, text, isError) {
    var msg = form.querySelector('.form-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-msg'; msg.setAttribute('role', 'status'); form.appendChild(msg); }
    msg.textContent = text;
    msg.classList.toggle('is-error', !!isError);
    return msg;
  }
  function values(form) {
    var data = {};
    form.querySelectorAll('[name]').forEach(function (el) { data[el.name] = el.value; });
    return data;
  }
  var STATUS_STEPS = ['confirmee', 'preparation', 'expediee', 'livree'];
  function renderOrder(form, o) {
    var box = form.parentNode.querySelector('.order-result') || document.createElement('div');
    box.className = 'order-result';
    var idx = STATUS_STEPS.indexOf(o.status);
    var steps = ['Confirmée', 'En préparation', 'Expédiée', 'Livrée'].map(function (label, k) {
      return '<li class="' + (k <= idx ? 'is-done' : '') + '">' + label + '</li>';
    }).join('');
    var items = o.items.map(function (i) { return i.name + ' × ' + i.quantity; }).join(', ');
    var date = new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    box.innerHTML = '<p class="eyebrow">Commande ' + o.number + ' · ' + date + '</p>' +
      '<h3 class="order-status">' + o.statusLabel + '</h3>' +
      (o.status === 'annulee' ? '' : '<ol class="order-steps">' + steps + '</ol>') +
      '<p class="order-items">' + items + ' — ' + (o.total / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + '</p>' +
      (o.trackingUrl ? '<a class="link-underline" href="' + o.trackingUrl + '" target="_blank" rel="noopener">Suivre le colis →</a>' : '');
    form.parentNode.appendChild(box);
  }
  document.querySelectorAll('form[data-api]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var url = form.getAttribute('data-api');
      var method = (form.getAttribute('data-method') || 'POST').toUpperCase();
      var data = values(form);
      var req = method === 'GET'
        ? fetch(url + '?' + new URLSearchParams(data).toString())
        : fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      if (btn) btn.disabled = true;
      message(form, 'Envoi en cours…');
      req.then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.error || 'Une erreur est survenue.');
          if (res.order) { message(form, ''); form.querySelector('.form-msg').remove(); renderOrder(form, res.order); return; }
          message(form, form.getAttribute('data-success') || 'Merci.');
          form.reset();
        })
        .catch(function (err) {
          message(form, err.message && err.message !== 'Failed to fetch' ? err.message : 'Service momentanément indisponible. Merci de réessayer.', true);
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  });

  // Filtres du Journal
  var filters = document.querySelectorAll('[data-filter]');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      document.querySelectorAll('.post[data-cat]').forEach(function (post) {
        post.hidden = cat !== 'all' && post.getAttribute('data-cat') !== cat;
      });
    });
  });
})();
