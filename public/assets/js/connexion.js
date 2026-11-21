/* Page de connexion : connexion, création de compte et mot de passe oublié.
   Aucun choix de rôle : le serveur indique l'espace de destination après connexion. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function showError(form, msg) {
    const el = $('[data-error]', form);
    if (!el) return;
    el.textContent = msg || ''; el.hidden = !msg;
  }
  function fieldErrors(form, fields) {
    $$('[data-field-error]', form).forEach(function (el) {
      const msg = fields && fields[el.dataset.fieldError];
      el.textContent = msg || ''; el.hidden = !msg;
      const input = form.elements[el.dataset.fieldError];
      if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    });
  }

  function setMode(mode) {
    $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== mode; });
    $$('[data-tab]').forEach(function (t) {
      const on = t.dataset.tab === mode || (t.dataset.tab === 'login' && mode === 'forgot');
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    });
    const first = $('[data-panel="' + mode + '"] input');
    if (first && document.activeElement && document.activeElement.closest('[data-panel]')) first.focus();
  }

  function passwordHint(input, hint) {
    const v = input.value;
    hint.classList.remove('ok', 'err');
    if (!v) { hint.textContent = MA.t('pwdRule'); return; }
    const valid = v.length >= 8 && /\d/.test(v) && /[A-Za-zÀ-ÿ]/.test(v);
    if (!valid) { hint.textContent = v.length < 8 ? MA.t('pwdShort') : MA.t('pwdMix'); hint.classList.add('err'); return; }
    hint.textContent = v.length >= 12 ? MA.t('pwdStrong') : MA.t('pwdOk'); hint.classList.add('ok');
  }

  // Destination demandée avant la connexion (?suite=…), limitée aux pages internes.
  function nextUrl(serverRedirect) {
    const suite = new URLSearchParams(location.search).get('suite');
    // L'équipe ne repart que vers /admin… ; un client vers n'importe quelle page interne hors administration.
    const isAdminPath = suite && suite.indexOf('/admin') === 0;
    if (suite && (serverRedirect === '/admin' ? isAdminPath : !isAdminPath)) return MA.safeRedirect(suite, MA.safeRedirect(serverRedirect));
    return MA.safeRedirect(serverRedirect, MA.route('compte'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Messages selon le contexte
    const q = new URLSearchParams(location.search);
    const notice = $('[data-notice]');
    let msg = '';
    if (q.has('nouveau-mot-de-passe')) msg = MA.t('noticePwd');
    else if (q.get('erreur') === 'service') msg = MA.t('noticeService');
    else if (q.has('suite')) msg = MA.t('noticeSuite');
    else if (q.has('deconnecte')) msg = MA.t('noticeOut');
    if (msg && notice) { notice.textContent = msg; notice.hidden = false; }
    if (q.get('mode') === 'inscription') setMode('signup');

    // Onglets (clavier : flèches gauche/droite)
    $$('[data-tab]').forEach(function (t) {
      t.addEventListener('click', function () { setMode(t.dataset.tab); });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const other = $('[data-tab="' + (t.dataset.tab === 'login' ? 'signup' : 'login') + '"]');
        setMode(other.dataset.tab); other.focus();
      });
    });
    $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.go); const i = $('[data-panel="' + b.dataset.go + '"] input'); if (i) i.focus(); }); });

    const pwd = $('#su-password'), hint = $('[data-pwd-hint]', $('[data-form="signup"]'));
    if (pwd && hint) pwd.addEventListener('input', function () { passwordHint(pwd, hint); });

    // Connexion
    const login = $('[data-form="login"]');
    login.addEventListener('submit', async function (e) {
      e.preventDefault();
      showError(login, '');
      const email = login.elements.email.value.trim(), password = login.elements.password.value;
      if (!email || !password) { showError(login, MA.t('loginReq')); return; }
      const btn = $('button[type="submit"]', login);
      MA.busy(btn, true, MA.t('signingIn'));
      const r = await MA.api('/api/auth/login', { method: 'POST', body: { email: email, password: password } });
      if (r.ok) { location.assign(nextUrl(r.redirect)); return; }
      MA.busy(btn, false);
      login.elements.password.value = '';
      showError(login, r.error);
    });

    // Création de compte
    const signup = $('[data-form="signup"]');
    signup.addEventListener('submit', async function (e) {
      e.preventDefault();
      showError(signup, ''); fieldErrors(signup, null);
      const f = signup.elements;
      const body = {
        firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), email: f.email.value.trim(),
        password: f.password.value, newsletter: f.newsletter.checked, website: f.website.value,
      };
      const local = {};
      if (!body.firstName) local.firstName = MA.t('firstReq');
      if (!body.lastName) local.lastName = MA.t('lastReq');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) local.email = MA.t('emailInvalid');
      if (body.password.length < 8 || !/\d/.test(body.password)) local.password = MA.t('pwdRule');
      if (Object.keys(local).length) { fieldErrors(signup, local); return; }
      const btn = $('button[type="submit"]', signup);
      MA.busy(btn, true, MA.t('creating'));
      const r = await MA.api('/api/auth/register', { method: 'POST', body: body });
      if (r.ok) { location.assign(MA.safeRedirect(r.redirect, MA.route('compte')) + '?bienvenue=1'); return; }
      MA.busy(btn, false);
      if (r.fields) fieldErrors(signup, r.fields);
      showError(signup, r.error);
    });

    // Mot de passe oublié
    const forgot = $('[data-form="forgot"]');
    forgot.addEventListener('submit', async function (e) {
      e.preventDefault();
      showError(forgot, '');
      const email = forgot.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showError(forgot, MA.t('emailInvalid')); return; }
      const btn = $('button[type="submit"]', forgot);
      MA.busy(btn, true, MA.t('sending'));
      const r = await MA.api('/api/auth/forgot', { method: 'POST', body: { email: email } });
      MA.busy(btn, false);
      if (r.ok) { $('[data-sent]', forgot).hidden = false; return; }
      showError(forgot, r.error);
    });
  });
})();
