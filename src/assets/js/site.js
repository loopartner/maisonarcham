/* Maison Archam — script commun à toutes les pages (menu mobile, compteur du panier, appels API). */
(function () {
  'use strict';

  // ---------- Appels API (JSON, même origine, cookies de session inclus) ----------
  async function api(path, options) {
    const opts = options || {};
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } };
    if (opts.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    let res;
    try { res = await fetch(path, init); }
    catch (e) { return { ok: false, status: 0, error: 'Connexion impossible. Vérifiez votre réseau puis réessayez.' }; }
    let data = {};
    try { data = await res.json(); } catch (e) { /* réponse vide */ }
    if (!res.ok || data.ok === false) return Object.assign({ ok: false, status: res.status, error: data.error || 'Une erreur est survenue. Merci de réessayer.' }, data, { ok: false });
    return Object.assign({ ok: true, status: res.status }, data);
  }

  // Bouton occupé pendant une requête
  function busy(button, on, label) {
    if (!button) return;
    // Le contenu d'origine (y compris les zones mises à jour dynamiquement) est conservé tel quel.
    if (on) { button._orig = Array.from(button.childNodes); button.textContent = label || 'Un instant…'; button.setAttribute('aria-busy', 'true'); button.disabled = true; }
    else { if (button._orig) button.replaceChildren.apply(button, button._orig); button.removeAttribute('aria-busy'); button.disabled = false; }
  }

  // Redirection uniquement vers une adresse interne au site
  function safeRedirect(target, fallback) {
    if (typeof target === 'string' && /^\/(?!\/)[\w\-/.?=&#%]*$/.test(target)) return target;
    return fallback || '/';
  }

  window.MA = { api: api, busy: busy, safeRedirect: safeRedirect };

  // ---------- Menu mobile ----------
  function initMenu() {
    const menu = document.getElementById('menu-mobile');
    const openBtn = document.querySelector('[data-menu-open]');
    if (!menu || !openBtn) return;
    const closeBtn = menu.querySelector('[data-menu-close]');
    function open() {
      menu.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); document.body.classList.add('menu-open');
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open');
      openBtn.focus();
    }
    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = menu.querySelectorAll('a, button');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // ---------- Compteur du panier (le panier est gardé dans le navigateur) ----------
  function cartCount() {
    try {
      const items = JSON.parse(localStorage.getItem('archam-cart') || '[]');
      return Array.isArray(items) ? items.reduce(function (n, i) { return n + (Number(i.qty) > 0 ? Math.min(Number(i.qty), 10) : 0); }, 0) : 0;
    } catch (e) { return 0; }
  }
  function renderCart() {
    const n = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = String(n); el.hidden = n === 0; });
    document.querySelectorAll('[data-cart-link]').forEach(function (el) { el.setAttribute('aria-label', 'Panier, ' + n + (n > 1 ? ' articles' : ' article')); });
  }
  window.addEventListener('storage', function (e) { if (e.key === 'archam-cart') renderCart(); });
  window.MA.renderCart = renderCart;

  // ---------- Champs mot de passe : afficher / masquer ----------
  function initPasswordToggles() {
    document.querySelectorAll('[data-pwd-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.getElementById(btn.getAttribute('aria-controls'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });
    });
  }

  // ---------- Déconnexion ----------
  function initLogout() {
    document.querySelectorAll('[data-logout]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        busy(btn, true, 'Déconnexion…');
        await api('/api/auth/logout', { method: 'POST', body: {} });
        location.assign('/connexion?deconnecte=1');
      });
    });
  }

  // ---------- Inscription à la newsletter (consentement explicite, confirmation par e-mail) ----------
  function initNewsletter() {
    document.querySelectorAll('form[data-newsletter]').forEach(function (form) {
      const err = form.querySelector('[data-error]');
      const show = function (m) { if (err) { err.textContent = m || ''; err.hidden = !m; } };
      const wrap = form.parentElement, done = wrap.querySelector('[data-nl-done]');
      form.addEventListener('submit', async function (e) {
        e.preventDefault(); show('');
        const email = form.elements.email.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show('Merci de saisir une adresse e-mail valide.'); form.elements.email.focus(); return; }
        if (form.elements.consent && !form.elements.consent.checked) { show('Merci d’accepter de recevoir notre correspondance.'); return; }
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'Inscription…');
        const r = await api('/api/newsletter', { method: 'POST', body: { email: email, consent: true, source: form.dataset.source || 'site', website: form.elements.website ? form.elements.website.value : '' } });
        busy(btn, false);
        if (!r.ok) { show(r.error); return; }
        if (!done) return;
        const t = done.querySelector('[data-nl-done-title]'), x = done.querySelector('[data-nl-done-text]'), s = done.querySelector('[data-nl-email]');
        const texts = {
          pending: ['Bienvenue dans la correspondance.', 'Un e-mail de confirmation vient d’être envoyé à ' + email + '. Pensez à valider votre inscription.'],
          subscribed: [(done && done.dataset.confirm) || 'Merci, votre inscription est confirmée.', 'La prochaine lettre vous parviendra à ' + email + '.'],
          already: ['Vous êtes déjà inscrit.', 'L’adresse ' + email + ' reçoit déjà les lettres de la Maison.'],
        }[r.status] || ['Merci.', ''];
        if (t) t.textContent = texts[0];
        if (x) x.textContent = texts[1];
        if (s) s.textContent = email;
        done.hidden = false; form.hidden = true; done.setAttribute('tabindex', '-1'); done.focus();
      });
      const reset = done && done.querySelector('[data-nl-reset]');
      if (reset) reset.addEventListener('click', function () { form.reset(); done.hidden = true; form.hidden = false; form.elements.email.focus(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () { initMenu(); renderCart(); initPasswordToggles(); initLogout(); initNewsletter(); });
})();
