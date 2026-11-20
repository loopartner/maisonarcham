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
    if (on) { button.dataset.label = button.textContent; button.textContent = label || 'Un instant…'; button.setAttribute('aria-busy', 'true'); button.disabled = true; }
    else { button.textContent = button.dataset.label || button.textContent; button.removeAttribute('aria-busy'); button.disabled = false; }
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

  document.addEventListener('DOMContentLoaded', function () { initMenu(); renderCart(); initPasswordToggles(); initLogout(); });
})();
