/* Maison Archam — script commun à toutes les pages (menu mobile, compteur du panier, appels API). */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // ---------- Langue et textes (injectés par la page) ----------
  let I18N = { lang: document.documentElement.lang || 'fr', routes: {}, t: {} };
  try { I18N = JSON.parse(document.getElementById('ma-i18n').textContent); } catch (e) { /* page sans textes */ }
  function t(key, vars) {
    let s = I18N.t[key] !== undefined ? I18N.t[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  // Adresse localisée d'une page : MA.route('compte') → /compte ou /en/account
  function route(key) { return I18N.routes[key] || '/'; }
  // Les adresses renvoyées par le serveur (/compte, /connexion…) sont converties dans la langue de la page.
  const SERVER_PATHS = { '/compte': 'compte', '/connexion': 'connexion', '/': 'home' };
  function localize(p) {
    if (typeof p !== 'string') return p;
    const base = p.split(/[?#]/)[0], rest = p.slice(base.length);
    return SERVER_PATHS[base] && I18N.routes[SERVER_PATHS[base]] ? I18N.routes[SERVER_PATHS[base]] + rest : p;
  }
  const locale = I18N.lang === 'en' ? 'en-GB' : 'fr-FR';

  // ---------- Appels API (JSON, même origine, cookies de session inclus) ----------
  async function api(path, options) {
    const opts = options || {};
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: { accept: 'application/json', 'x-lang': I18N.lang } };
    if (opts.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    let res;
    try { res = await fetch(path, init); }
    catch (e) { return { ok: false, status: 0, error: t('network') }; }
    let data = {};
    try { data = await res.json(); } catch (e) { /* réponse vide */ }
    if (!res.ok || data.ok === false) return Object.assign({ ok: false, status: res.status, error: data.error || t('error') }, data, { ok: false });
    return Object.assign({ ok: true, status: res.status }, data);
  }

  // Bouton occupé pendant une requête
  function busy(button, on, label) {
    if (!button) return;
    // Le contenu d'origine (y compris les zones mises à jour dynamiquement) est conservé tel quel.
    if (on) { button._orig = Array.from(button.childNodes); button.textContent = label || t('wait'); button.setAttribute('aria-busy', 'true'); button.disabled = true; }
    else { if (button._orig) button.replaceChildren.apply(button, button._orig); button.removeAttribute('aria-busy'); button.disabled = false; }
  }

  // Redirection uniquement vers une adresse interne au site
  function safeRedirect(target, fallback) {
    if (typeof target === 'string' && /^\/(?!\/)[\w\-/.?=&#%]*$/.test(target)) return localize(target);
    return fallback || route('home');
  }

  window.MA = { api: api, busy: busy, safeRedirect: safeRedirect, t: t, route: route, lang: I18N.lang, locale: locale };

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
    document.querySelectorAll('[data-cart-link]').forEach(function (el) { el.setAttribute('aria-label', t(n > 1 ? 'cartLabelPlural' : 'cartLabel', { n: n })); });
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
        btn.setAttribute('aria-label', show ? t('hidePwd') : t('showPwd'));
      });
    });
  }

  // ---------- Déconnexion ----------
  function initLogout() {
    document.querySelectorAll('[data-logout]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        busy(btn, true, t('logout'));
        await api('/api/auth/logout', { method: 'POST', body: {} });
        location.assign(route('connexion') + '?deconnecte=1');
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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show(t('nlInvalid')); form.elements.email.focus(); return; }
        if (form.elements.consent && !form.elements.consent.checked) { show(t('nlConsent')); return; }
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, t('nlSending'));
        const r = await api('/api/newsletter', { method: 'POST', body: { email: email, consent: true, source: form.dataset.source || 'site', website: form.elements.website ? form.elements.website.value : '' } });
        busy(btn, false);
        if (!r.ok) { show(r.error); return; }
        if (!done) return;
        const t = done.querySelector('[data-nl-done-title]'), x = done.querySelector('[data-nl-done-text]'), s = done.querySelector('[data-nl-email]');
        const texts = {
          pending: [t('nlPendingT'), t('nlPendingX', { email: email })],
          subscribed: [(done && done.dataset.confirm) || t('nlDoneT'), t('nlDoneX', { email: email })],
          already: [t('nlAlreadyT'), t('nlAlreadyX', { email: email })],
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

  // ---------- Apparition des blocs au défilement ----------
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  // Ferme le menu de langue au clic à l'extérieur ou avec Échap
  function initLangMenu() {
    const d = document.querySelector('[data-lang-menu]'); if (!d) return;
    document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { d.open = false; d.querySelector('summary').focus(); } });
    // Mémorise la langue choisie (cookie fonctionnel, sans suivi)
    d.querySelectorAll('a[hreflang]').forEach(function (a) { a.addEventListener('click', function () { document.cookie = 'ma_lang=' + a.hreflang + ';path=/;max-age=31536000;samesite=lax;secure'; }); });
  }

  document.addEventListener('DOMContentLoaded', function () { initReveal(); initLangMenu(); initMenu(); renderCart(); initPasswordToggles(); initLogout(); initNewsletter(); });
})();
