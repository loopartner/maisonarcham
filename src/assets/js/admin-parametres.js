/* Back-office — paramètres. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const toEur = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const ACT = { 'commande.modifiee': 'a modifié une commande', 'commandes.export': 'a exporté les commandes', 'produit.cree': 'a créé une fiche produit', 'produit.modifie': 'a modifié une fiche produit', 'produit.supprime': 'a supprimé une fiche produit', 'article.cree': 'a créé un article', 'article.modifie': 'a modifié un article', 'article.supprime': 'a supprimé un article', 'pages.modifiees': 'a modifié les pages', 'site.publie': 'a publié le site', 'parametres.modifies': 'a modifié les paramètres', 'promo.cree': 'a créé un code promo', 'promo.modifie': 'a modifié un code promo', 'promo.supprime': 'a supprimé un code promo', 'equipe.role': 'a donné un rôle', 'equipe.retrait': 'a retiré un accès', 'newsletter.export': 'a exporté les abonnés', 'newsletter.desinscription': 'a désinscrit une adresse', 'newsletter.campagne': 'a envoyé une campagne' };

  async function postForm(form, body, done) {
    A.fieldErrors(form, null);
    const btn = form.querySelector('button[type="submit"]'); MA.busy(btn, true, 'Enregistrement…');
    const r = await MA.api(body.__url || '/api/admin/settings', { method: body.__method || 'POST', body: body });
    MA.busy(btn, false);
    if (!r.ok) { A.fieldErrors(form, r.fields); A.flash(A.$('[data-flash]', form), r.error, false); return null; }
    A.flash(A.$('[data-flash]', form), '✓ Enregistré.'); if (done) done(r); return r;
  }

  function renderShipping(ship) {
    A.$('[data-ship-rows]').replaceChildren.apply(A.$('[data-ship-rows]'), Object.entries(ship).map(function (kv) {
      const id = kv[0], s = kv[1];
      return h('fieldset', { class: 'ship-set', 'data-ship': id },
        h('legend', null, s.title),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', name: id + '.enabled', checked: s.enabled }), h('span', null, 'Proposé aux clients')),
        h('div', { class: 'acct-grid' },
          h('label', { class: 'field' }, 'Intitulé', h('input', { class: 'in', name: id + '.title', value: s.title, maxlength: '60' })),
          h('label', { class: 'field' }, 'Tarif (€)', h('input', { class: 'in', name: id + '.price', value: toEur(s.price), inputmode: 'decimal' }), h('span', { class: 'field-err', 'data-fe': id + '.price', hidden: true }))),
        h('label', { class: 'field' }, 'Détail (transporteur, délai)', h('input', { class: 'in', name: id + '.detail', value: s.detail, maxlength: '120' })));
    }));
  }

  function renderPromos(list) {
    A.$('[data-promos]').replaceChildren.apply(A.$('[data-promos]'), list.length ? list.map(function (p) {
      const cond = [p.minSubtotal ? 'dès ' + A.euros(p.minSubtotal) : null, p.expiresAt ? 'jusqu’au ' + A.date(p.expiresAt) : null].filter(Boolean).join(', ') || '—';
      return h('tr', null, h('th', { scope: 'row' }, p.code), h('td', null, p.type === 'amount' ? '− ' + A.euros(p.value) : '− ' + p.value + ' %'), h('td', null, cond),
        h('td', null, (p.uses || 0) + (p.maxUses ? ' / ' + p.maxUses : '')), h('td', null, h('span', { class: 'status ' + (p.active ? 'livree' : 'attente') }, p.active ? 'Actif' : 'Inactif')),
        h('td', null, h('button', { type: 'button', class: 'linkbtn', onclick: function () { editPromo(p); } }, 'Modifier'), ' ', h('button', { type: 'button', class: 'linkbtn', onclick: async function () {
          if (!confirm('Supprimer le code ' + p.code + ' ?')) return;
          const r = await MA.api('/api/admin/promos', { method: 'DELETE', body: { code: p.code } }); if (r.ok) renderPromos(r.promos);
        } }, 'Supprimer')));
    }) : [h('tr', null, h('td', { colspan: '6', class: 'adm-muted' }, 'Aucun code pour le moment.'))]);
  }
  let editingPromo = null;
  function editPromo(p) {
    const f = A.$('[data-promo-form]'); editingPromo = p;
    f.elements.code.value = p ? p.code : ''; f.elements.code.readOnly = Boolean(p);
    f.elements.type.value = p ? p.type : 'percent'; f.elements.value.value = p ? (p.type === 'amount' ? toEur(p.value) : p.value) : '';
    f.elements.minSubtotal.value = p && p.minSubtotal ? toEur(p.minSubtotal) : ''; f.elements.expiresAt.value = p && p.expiresAt ? p.expiresAt.slice(0, 10) : '';
    f.elements.maxUses.value = p && p.maxUses ? p.maxUses : ''; f.elements.active.checked = p ? p.active : true;
    A.$('[data-promo-title]').textContent = p ? 'Modifier ' + p.code : 'Nouveau code'; A.$('[data-promo-reset]').hidden = !p;
    if (p) f.elements.value.focus();
  }

  function renderTeam(r) {
    A.$('[data-roles]').replaceChildren.apply(A.$('[data-roles]'), r.roles.map(function (x) { return h('option', { value: x.id }, x.label); }));
    A.$('[data-team]').replaceChildren.apply(A.$('[data-team]'), r.members.map(function (m) {
      const canEdit = m.id && m.id !== r.me && m.role !== 'owner';
      return h('tr', null, h('th', { scope: 'row' }, m.name), h('td', null, m.email), h('td', null, m.roleLabel + (m.pending ? ' (compte à créer)' : '')),
        h('td', null, canEdit ? h('button', { type: 'button', class: 'linkbtn', onclick: async function () {
          if (!confirm('Retirer l’accès au back-office de ' + m.email + ' ?')) return;
          const x = await MA.api('/api/admin/team', { method: 'DELETE', body: { id: m.id } }); if (x.ok) renderTeam(Object.assign(r, { members: x.members })); else alert(x.error);
        } }, 'Retirer') : (m.id === r.me ? 'Vous' : '')));
    }));
  }

  document.addEventListener('DOMContentLoaded', async function () {
    const s = await A.guard('settings'); if (!s) return;
    A.publishBar();
    const r = await MA.api('/api/admin/settings'); if (!r.ok) return;
    const c = A.$('[data-company]'); ['name', 'siret', 'vat', 'email', 'phone', 'address'].forEach(function (k) { c.elements[k].value = r.site.company[k] || ''; });
    c.addEventListener('submit', function (e) { e.preventDefault(); const b = { section: 'company' }; ['name', 'siret', 'vat', 'email', 'phone', 'address'].forEach(function (k) { b[k] = c.elements[k].value; }); postForm(c, b, function () { A.publishBar(); }); });
    const st = A.$('[data-site]'); st.elements.seoTitle.value = r.site.seoTitle || ''; st.elements.seoDescription.value = r.site.seoDescription || '';
    st.addEventListener('submit', function (e) { e.preventDefault(); postForm(st, { section: 'site', seoTitle: st.elements.seoTitle.value, seoDescription: st.elements.seoDescription.value }, function () { A.publishBar(); }); });
    const sv = r.services;
    A.$('[data-services]').replaceChildren.apply(A.$('[data-services]'), [['Prestataire de paiement', 'Stripe — ' + sv.stripe], ['Webhook Stripe', sv.stripeWebhook ? 'Configuré' : 'Non configuré'], ['Expéditeur des e-mails', sv.mail], ['Alertes de commande', sv.ordersNotify], ['Publication automatique', sv.publish ? 'Configurée' : 'Non configurée']].map(function (x) { return h('div', null, h('dt', null, x[0]), h('dd', null, x[1])); }));
    renderShipping(r.shipping);
    const sh = A.$('[data-shipping]');
    sh.addEventListener('submit', function (e) {
      e.preventDefault(); const methods = {};
      A.$$('[data-ship]', sh).forEach(function (fs) { const id = fs.dataset.ship; methods[id] = { enabled: sh.elements[id + '.enabled'].checked, title: sh.elements[id + '.title'].value, price: sh.elements[id + '.price'].value, detail: sh.elements[id + '.detail'].value }; });
      postForm(sh, { section: 'shipping', methods: methods }, function (x) { renderShipping(x.shipping); });
    });
    const nt = A.$('[data-notif]'); nt.elements.newOrder.checked = r.site.notifications.newOrder; nt.elements.lowStock.checked = r.site.notifications.lowStock;
    nt.addEventListener('submit', function (e) { e.preventDefault(); postForm(nt, { section: 'notifications', newOrder: nt.elements.newOrder.checked, lowStock: nt.elements.lowStock.checked }); });

    const pr = await MA.api('/api/admin/promos'); if (pr.ok) renderPromos(pr.promos);
    const pf = A.$('[data-promo-form]');
    pf.addEventListener('submit', function (e) {
      e.preventDefault(); const f = pf.elements;
      postForm(pf, { __url: '/api/admin/promos', __method: editingPromo ? 'PUT' : 'POST', code: f.code.value, type: f.type.value, value: f.value.value, minSubtotal: f.minSubtotal.value, expiresAt: f.expiresAt.value, maxUses: f.maxUses.value, active: f.active.checked }, function (x) { renderPromos(x.promos); editPromo(null); pf.reset(); });
    });
    A.$('[data-promo-reset]').addEventListener('click', function () { editPromo(null); pf.reset(); });

    if (s.permissions.indexOf('team') >= 0) {
      const tr = await MA.api('/api/admin/team');
      if (tr.ok) {
        renderTeam(tr);
        const inv = A.$('[data-invite]');
        inv.addEventListener('submit', function (e) { e.preventDefault(); postForm(inv, { __url: '/api/admin/team', email: inv.elements.email.value, role: inv.elements.role.value }, function (x) { renderTeam(Object.assign(tr, { members: x.members })); inv.reset(); }); });
      }
      const au = await MA.api('/api/admin/audit');
      if (au.ok) A.$('[data-audit]').replaceChildren.apply(A.$('[data-audit]'), au.entries.length ? au.entries.slice(0, 40).map(function (x) {
        const d = x.details || {}; const ref = d.number || d.id || d.slug || d.code || d.email || d.subject || d.section || '';
        return h('li', null, A.time(x.at) + ' — ' + x.name + ' ' + (ACT[x.action] || x.action) + (ref ? ' (' + ref + ')' : ''));
      }) : [h('li', null, 'Aucune action enregistrée.')]);
    } else A.$('[data-team-wrap]').hidden = true;
  });
})();
