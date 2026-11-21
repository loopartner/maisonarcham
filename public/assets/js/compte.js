/* Espace client : tableau de bord, commandes, informations personnelles, carnet d'adresses. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TABS = ['tableau-de-bord', 'commandes', 'informations', 'adresses'];
  const STEPS = [['confirmee', 'Confirmée'], ['preparation', 'En préparation'], ['expediee', 'Expédiée'], ['livree', 'Livrée']];
  const STEP_OF = { payee: 0, confirmee: 0, preparation: 1, expediee: 2, livree: 3 };
  const fmtDate = (d, opts) => new Date(d).toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  const loaded = {};
  let state = { user: null, stats: null };

  window.MAAccount = { STEPS: STEPS, STEP_OF: STEP_OF, fmtDate: fmtDate, track: track, statusClass: statusClass };
  function statusClass(s) { return { confirmee: 'confirmee', payee: 'payee', preparation: 'preparation', expediee: 'expediee', livree: 'livree', annulee: 'annulee', remboursee: 'remboursee' }[s] || 'attente'; }
  function track(ol, order) {
    const cur = STEP_OF[order.status] ?? -1;
    const dates = {}; (order.history || []).forEach(function (h) { if (!dates[h.status]) dates[h.status] = h.at; });
    ol.replaceChildren.apply(ol, STEPS.map(function (s, i) {
      const li = document.createElement('li'); li.className = 'track-step' + (i <= cur ? ' done' : '');
      if (i === cur) li.setAttribute('aria-current', 'step');
      const bar = document.createElement('span'); bar.className = 'track-bar'; bar.setAttribute('aria-hidden', 'true');
      const l = document.createElement('p'); l.className = 'track-l'; l.textContent = s[1];
      li.append(bar, l);
      const d = dates[s[0]] || (i === 0 ? order.createdAt : null);
      if (d && i <= cur) { const p = document.createElement('p'); p.className = 'track-d'; p.textContent = fmtDate(d, { day: 'numeric', month: 'short' }); li.append(p); }
      return li;
    }));
  }

  function fieldErrors(form, fields) {
    $$('[data-fe]', form).forEach(function (el) {
      const m = fields && fields[el.dataset.fe]; el.textContent = m || ''; el.hidden = !m;
      const i = form.elements[el.dataset.fe]; if (i) { if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); }
    });
  }
  function ok(form, on) { const o = $('[data-ok]', form); if (o) { o.hidden = !on; if (on) setTimeout(function () { o.hidden = true; }, 6000); } }

  // ---------- Onglets (adresse #…) ----------
  function current() { const h = location.hash.slice(1); return TABS.includes(h) ? h : 'tableau-de-bord'; }
  function show() {
    const t = current();
    $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== t; });
    $$('[data-tab]').forEach(function (a) { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (!loaded[t]) { loaded[t] = true; ({ commandes: loadOrders, adresses: loadAddresses, informations: fillProfile })[t] && ({ commandes: loadOrders, adresses: loadAddresses, informations: fillProfile })[t](); }
  }

  // ---------- Tableau de bord ----------
  function renderDash(r) {
    const u = r.user, s = r.stats;
    $('[data-greeting]').textContent = 'Bonjour, ' + u.firstName;
    $('[data-stat-orders]').textContent = String(s.orders);
    const since = fmtDate(s.memberSince, { month: 'long', year: 'numeric' });
    $('[data-stat-since]').textContent = since.charAt(0).toUpperCase() + since.slice(1);
    renderNl(s.newsletter);
    const c = r.current;
    $('[data-current]').hidden = !c; $('[data-no-current]').hidden = !!c;
    if (c) {
      $('[data-cur-title]').textContent = 'Commande en cours · ' + c.number;
      $('[data-cur-date]').textContent = 'Passée le ' + fmtDate(c.createdAt);
      $('[data-cur-name]').textContent = c.items.map(function (i) { return i.name + (i.quantity > 1 ? ' × ' + i.quantity : ''); }).join(', ');
      $('[data-cur-status]').textContent = c.statusLabel;
      track($('[data-cur-track]'), c);
      $('[data-cur-link]').href = '/compte/commande?n=' + encodeURIComponent(c.number);
    }
    $('[data-verify]').hidden = u.emailVerified;
  }
  function renderNl(on) {
    state.stats.newsletter = on;
    $('[data-stat-nl]').textContent = on ? 'Abonnée' : 'Non abonnée';
    $('[data-nl-toggle]').textContent = on ? 'Se désabonner' : 'S’abonner';
  }

  // ---------- Commandes ----------
  async function loadOrders() {
    const r = await MA.api('/api/account/orders');
    const tb = $('[data-orders]');
    if (!r.ok) { tb.replaceChildren(); $('[data-orders-empty]').textContent = r.error; $('[data-orders-empty]').hidden = false; return; }
    $('[data-orders-empty]').hidden = r.orders.length > 0;
    $('.acct-table-wrap').hidden = r.orders.length === 0;
    tb.replaceChildren.apply(tb, r.orders.map(function (o) {
      const tr = document.createElement('tr');
      const cells = [o.number, fmtDate(o.createdAt), null, MACart.euros(o.total), null];
      cells.forEach(function (v, i) {
        const td = document.createElement(i === 0 ? 'th' : 'td'); if (i === 0) td.scope = 'row';
        if (i === 2) { const b = document.createElement('span'); b.className = 'status ' + statusClass(o.status); b.textContent = o.statusLabel; td.append(b); }
        else if (i === 4) { const a = document.createElement('a'); a.href = '/compte/commande?n=' + encodeURIComponent(o.number); a.textContent = 'Détails'; a.setAttribute('aria-label', 'Détails de la commande ' + o.number); td.append(a); }
        else td.textContent = v;
        tr.append(td);
      });
      return tr;
    }));
  }

  // ---------- Informations ----------
  function fillProfile() {
    const f = $('[data-profile]').elements, u = state.user;
    f.firstName.value = u.firstName; f.lastName.value = u.lastName; f.phone.value = u.phone || ''; f.birthDate.value = u.birthDate || '';
    $('[data-email]').elements.email.placeholder = u.email;
  }
  function bindForm(sel, url, body, after) {
    const form = $(sel);
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); fieldErrors(form, null); ok(form, false);
      const btn = $('button[type="submit"]', form); MA.busy(btn, true, 'Enregistrement…');
      const r = await MA.api(url, { method: 'POST', body: body(form.elements) });
      MA.busy(btn, false);
      if (!r.ok) { fieldErrors(form, r.fields || { [Object.keys(body(form.elements))[0]]: r.error }); return; }
      after(r, form); ok(form, true);
    });
  }

  // ---------- Adresses ----------
  let addresses = [];
  async function loadAddresses() { const r = await MA.api('/api/account/addresses'); if (r.ok) renderAddresses(r.addresses); }
  function renderAddresses(list) {
    addresses = list;
    const box = $('[data-addrs]'); $('[data-addrs-empty]').hidden = list.length > 0;
    box.replaceChildren.apply(box, list.map(function (a) {
      const card = document.createElement('div'); card.className = 'card acct-addr' + (a.isDefault ? ' is-default' : '');
      const t = document.createElement('p'); t.className = 'eyebrow muted'; t.textContent = a.label + (a.isDefault ? ' · par défaut' : '');
      const p = document.createElement('p'); p.className = 'acct-addr-text';
      [a.firstName + ' ' + a.lastName, a.line1, a.line2, a.postalCode + ' ' + a.city].filter(Boolean).forEach(function (l, i) { if (i) p.append(document.createElement('br')); p.append(document.createTextNode(l)); });
      const acts = document.createElement('div'); acts.className = 'acct-addr-acts';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'txt-btn'; edit.textContent = 'Modifier'; edit.addEventListener('click', function () { openAddr(a); });
      acts.append(edit);
      if (!a.isDefault) {
        const def = document.createElement('button'); def.type = 'button'; def.className = 'txt-btn'; def.textContent = 'Définir par défaut';
        def.addEventListener('click', async function () { const r = await MA.api('/api/account/addresses', { method: 'PUT', body: { id: a.id, onlyDefault: true } }); if (r.ok) renderAddresses(r.addresses); });
        acts.append(def);
      }
      const del = document.createElement('button'); del.type = 'button'; del.className = 'txt-btn'; del.textContent = 'Supprimer';
      del.addEventListener('click', async function () {
        if (!confirm('Supprimer l’adresse « ' + a.label + ' » ?')) return;
        const r = await MA.api('/api/account/addresses', { method: 'DELETE', body: { id: a.id } }); if (r.ok) renderAddresses(r.addresses);
      });
      acts.append(del);
      card.append(t, p, acts); return card;
    }));
  }
  function openAddr(a) {
    const form = $('[data-addr-form]'), f = form.elements;
    form.reset(); fieldErrors(form, null); $('[data-error]', form).hidden = true;
    $('[data-addr-title]', form).textContent = a ? 'Modifier l’adresse' : 'Nouvelle adresse';
    f.id.value = a ? a.id : '';
    if (a) ['label', 'phone', 'firstName', 'lastName', 'line1', 'line2', 'postalCode', 'city', 'country'].forEach(function (k) { f[k].value = a[k] || ''; });
    else { f.firstName.value = state.user.firstName; f.lastName.value = state.user.lastName; }
    f.isDefault.checked = a ? a.isDefault : addresses.length === 0;
    form.hidden = false; f.label.focus();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    const r = await MA.api('/api/account/overview');
    if (!r.ok) { if (r.status === 401) location.assign('/connexion?suite=' + encodeURIComponent(location.pathname)); else $('[data-loading]').textContent = r.error; return; }
    state = { user: r.user, stats: r.stats };
    $('[data-loading]').hidden = true;
    renderDash(r);
    if (new URLSearchParams(location.search).has('bienvenue')) { $('[data-welcome]').hidden = false; history.replaceState(null, '', location.pathname + location.hash); }
    window.addEventListener('hashchange', show); show();

    $('[data-resend]').addEventListener('click', async function (e) {
      MA.busy(e.target, true, 'Envoi…');
      const s = await MA.api('/api/auth/resend-verification', { method: 'POST', body: {} });
      MA.busy(e.target, false); e.target.textContent = s.ok ? 'E-mail envoyé' : s.error; e.target.disabled = s.ok;
    });
    $('[data-nl-toggle]').addEventListener('click', async function (e) {
      MA.busy(e.target, true, '…');
      const s = await MA.api('/api/account/newsletter', { method: 'POST', body: { subscribed: !state.stats.newsletter } });
      MA.busy(e.target, false);
      if (!s.ok) return;
      if (s.status === 'pending') { $('[data-stat-nl]').textContent = 'À confirmer'; e.target.textContent = 'Lien envoyé par e-mail'; e.target.disabled = true; return; }
      renderNl(s.status === 'subscribed');
    });

    bindForm('[data-profile]', '/api/account/profile', function (f) { return { firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), phone: f.phone.value.trim(), birthDate: f.birthDate.value }; },
      function (res) { Object.assign(state.user, res.user); $('[data-greeting]').textContent = 'Bonjour, ' + res.user.firstName; });
    bindForm('[data-email]', '/api/account/email', function (f) { return { email: f.email.value.trim(), password: f.password.value }; },
      function (res, form) { state.user = Object.assign(state.user, res.user); form.reset(); form.elements.email.placeholder = res.user.email; $('[data-verify]').hidden = res.user.emailVerified; });
    bindForm('[data-password]', '/api/account/password', function (f) { return { current: f.current.value, password: f.password.value }; }, function (res, form) { form.reset(); });

    const del = $('[data-delete]');
    del.addEventListener('submit', async function (e) {
      e.preventDefault(); fieldErrors(del, null);
      if (!confirm('Supprimer définitivement votre compte ? Cette action est irréversible.')) return;
      const r2 = await MA.api('/api/account/delete', { method: 'POST', body: { password: del.elements.password.value } });
      if (!r2.ok) { fieldErrors(del, r2.fields || { password: r2.error }); return; }
      try { localStorage.removeItem('archam-cart'); } catch (x) { /* ignoré */ }
      location.assign('/');
    });

    $('[data-addr-new]').addEventListener('click', function () { openAddr(null); });
    $('[data-addr-cancel]').addEventListener('click', function () { $('[data-addr-form]').hidden = true; });
    const af = $('[data-addr-form]');
    af.addEventListener('submit', async function (e) {
      e.preventDefault(); fieldErrors(af, null);
      const f = af.elements, body = { isDefault: f.isDefault.checked };
      ['label', 'phone', 'firstName', 'lastName', 'line1', 'line2', 'postalCode', 'city', 'country'].forEach(function (k) { body[k] = f[k].value.trim(); });
      if (f.id.value) body.id = f.id.value;
      const btn = $('button[type="submit"]', af); MA.busy(btn, true, 'Enregistrement…');
      const res = await MA.api('/api/account/addresses', { method: f.id.value ? 'PUT' : 'POST', body: body });
      MA.busy(btn, false);
      if (!res.ok) { fieldErrors(af, res.fields); const er = $('[data-error]', af); er.textContent = res.error; er.hidden = false; return; }
      af.hidden = true; renderAddresses(res.addresses);
    });
  });
})();
