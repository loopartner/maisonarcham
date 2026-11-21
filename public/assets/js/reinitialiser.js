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
      show('Ce lien est incomplet. Utilisez le lien reçu par e-mail, ou faites une nouvelle demande depuis la page de connexion.');
      form.querySelector('button[type="submit"]').disabled = true;
      return;
    }
    const pwd = form.elements.password, hint = form.querySelector('[data-pwd-hint]');
    pwd.addEventListener('input', function () {
      const v = pwd.value; hint.classList.remove('ok', 'err');
      if (!v) hint.textContent = '8 caractères minimum, dont un chiffre.';
      else if (v.length < 8 || !/\d/.test(v)) { hint.textContent = 'Trop court ou sans chiffre.'; hint.classList.add('err'); }
      else { hint.textContent = v.length >= 12 ? 'Mot de passe robuste.' : 'Mot de passe correct.'; hint.classList.add('ok'); }
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); show('');
      if (pwd.value !== form.elements.confirm.value) { show('Les deux mots de passe ne correspondent pas.'); return; }
      const btn = form.querySelector('button[type="submit"]');
      MA.busy(btn, true, 'Enregistrement…');
      const r = await MA.api('/api/auth/reset', { method: 'POST', body: { token: token, password: pwd.value } });
      if (r.ok) { location.assign(MA.safeRedirect(r.redirect, '/connexion')); return; }
      MA.busy(btn, false); show(r.error);
    });
  });
})();
