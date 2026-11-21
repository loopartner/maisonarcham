/* Back-office — socle commun : session, permissions, menu, utilitaires d'affichage. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const euros = (c) => ((c || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: (c || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 }) + '\u00a0€';
  const date = (d, o) => (d ? new Date(d).toLocaleDateString('fr-FR', o || { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const time = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const pct = (v) => (v === null || v === undefined ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %');
  const STATUS_CLASS = { attente: 'attente', payee: 'payee', confirmee: 'payee', preparation: 'preparation', expediee: 'expediee', livree: 'livree', annulee: 'annulee', remboursee: 'remboursee' };

  // Création d'éléments sans jamais injecter de HTML : h('span', { class: 'x' }, 'texte', autreNoeud)
  function h(tag, attrs) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (kv) {
      const k = kv[0], v = kv[1];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    Array.prototype.slice.call(arguments, 2).flat().forEach(function (c) { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }
  const badge = (status, label) => h('span', { class: 'status ' + (STATUS_CLASS[status] || 'attente') }, label || status);

  function fieldErrors(form, fields) {
    $$('[data-fe]', form).forEach(function (el) {
      const m = fields && fields[el.dataset.fe]; el.textContent = m || ''; el.hidden = !m;
      const i = form.elements && form.elements[el.dataset.fe]; if (i) { if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); }
    });
  }
  function flash(el, text, ok) { if (!el) return; el.textContent = text; el.className = 'adm-flash ' + (ok === false ? 'err' : 'ok'); el.hidden = false; clearTimeout(el._t); el._t = setTimeout(function () { el.hidden = true; }, 6000); }

  // Panneau latéral (détail) : focus piégé, Échap pour fermer, retour du focus.
  function drawer(panel, opener) {
    const wrap = panel.closest('[data-drawer]');
    let last = null;
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = $$('a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea', panel).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    function open() { last = document.activeElement; wrap.hidden = false; document.body.classList.add('menu-open'); wrap.addEventListener('keydown', onKey); const t = $('[data-drawer-title]', panel) || panel; t.setAttribute('tabindex', '-1'); t.focus(); }
    function close() { wrap.hidden = true; document.body.classList.remove('menu-open'); wrap.removeEventListener('keydown', onKey); if (last && last.focus) last.focus(); }
    $$('[data-drawer-close]', wrap).forEach(function (b) { b.addEventListener('click', close); });
    return { open: open, close: close };
  }

  let sessionPromise = null;
  function session() {
    if (!sessionPromise) sessionPromise = MA.api('/api/admin/session');
    return sessionPromise;
  }

  // Une page de section déclare sa permission : <main data-perm-page="orders">
  async function guard(perm) {
    const s = await session();
    if (!s.ok) { location.assign('/connexion?suite=' + encodeURIComponent(location.pathname)); return null; }
    if (perm && s.permissions.indexOf(perm) < 0) {
      const main = $('#contenu');
      main.replaceChildren(h('div', { class: 'admin-head' }, h('div', null, h('p', { class: 'eyebrow muted' }, 'Accès restreint'), h('h1', null, 'Section non disponible'))),
        h('div', { class: 'panel' }, h('p', { class: 'lead' }, 'Votre rôle (' + s.roleLabel + ') ne donne pas accès à cette section. Demandez à un administrateur si nécessaire.')));
      return null;
    }
    return s;
  }

  window.MAAdmin = { $: $, $$: $$, h: h, euros: euros, date: date, time: time, pct: pct, badge: badge, fieldErrors: fieldErrors, flash: flash, drawer: drawer, session: session, guard: guard };

  document.addEventListener('DOMContentLoaded', async function () {
    const toggle = $('[data-an-toggle]'), body = document.getElementById('an-nav');
    if (toggle && body) toggle.addEventListener('click', function () { const o = body.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); });
    const s = await session();
    if (!s.ok) { if (s.status === 401 || s.status === 404) location.assign('/connexion'); return; }
    $$('[data-perm]').forEach(function (a) { a.hidden = s.permissions.indexOf(a.dataset.perm) < 0; });
    $$('[data-admin-name]').forEach(function (el) { el.textContent = s.user.firstName + ' ' + s.user.lastName; });
    $$('[data-admin-initials]').forEach(function (el) { el.textContent = ((s.user.firstName[0] || '') + (s.user.lastName[0] || '')).toUpperCase(); });
    $$('[data-admin-role]').forEach(function (el) { el.textContent = s.roleLabel; });
    Object.entries(s.badges || {}).forEach(function (kv) { const b = $('[data-badge="' + kv[0] + '"]'); if (b && kv[1]) b.textContent = String(kv[1]); });
  });
})();
