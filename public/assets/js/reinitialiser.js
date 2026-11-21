/* Choix d'un nouveau mot de passe. Le jeton est lu dans l'ancre (#jeton=…) puis retiré de la barre d'adresse. */
(function () {
  'use strict';
  const m = location.hash.match(/jeton=([A-Za-z0-9_-]{30,100})/);
  const token = m ? m[1] : '';
  if (m) history.replaceState(null, '', location.pathname);

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('[data-form="reset"]');
    const err = form.querySelector('[data-error]');
    const show = function (msg) { err.textContent = msg || ''; err.hidden = !msg; };
    if (!token) {
      show(MA.t('resetIncomplete'));
      form.querySelector('button[type="submit"]').disabled = true;
      return;
    }
    const pwd = form.elements.password, hint = form.querySelector('[data-pwd-hint]');
    pwd.addEventListener('input', function () {
      const v = pwd.value; hint.classList.remove('ok', 'err');
      if (!v) hint.textContent = MA.t('pwdRule');
      else if (v.length < 8 || !/\d/.test(v)) { hint.textContent = MA.t('pwdShortOrDigit'); hint.classList.add('err'); }
      else { hint.textContent = v.length >= 12 ? MA.t('pwdStrong') : MA.t('pwdOk'); hint.classList.add('ok'); }
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); show('');
      if (pwd.value !== form.elements.confirm.value) { show(MA.t('pwdMismatch')); return; }
      const btn = form.querySelector('button[type="submit"]');
      MA.busy(btn, true, MA.t('saving'));
      const r = await MA.api('/api/auth/reset', { method: 'POST', body: { token: token, password: pwd.value } });
      if (r.ok) { location.assign(MA.safeRedirect(r.redirect, MA.route('connexion'))); return; }
      MA.busy(btn, false); show(r.error);
    });
  });
})();
