/* Back-office — newsletter : abonnés, export, campagnes. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const AUD = { all: 'Tous les abonnés actifs', customers: 'Clients ayant commandé', prospects: 'Abonnés sans commande' };
  let st = { q: '', status: '', page: 1 }, timer;

  function kpi(label, value, sub) { return h('div', { class: 'kpi' }, h('p', { class: 'eyebrow muted' }, label), h('p', { class: 'kpi-v serif' }, value), h('p', { class: 'kpi-d neutral' }, sub)); }

  async function load() {
    const qs = 'q=' + encodeURIComponent(st.q) + '&status=' + st.status;
    const r = await MA.api('/api/admin/subscribers?' + qs + '&page=' + st.page);
    if (!r.ok) return;
    A.$('[data-kpis]').replaceChildren(kpi('Abonnés actifs', String(r.stats.active), '+' + r.stats.new30 + ' en 30 jours'), kpi('En attente de confirmation', String(r.stats.pending), 'Double consentement'), kpi('Désinscriptions', String(r.stats.unsub30), 'Sur 30 jours'));
    A.$('[data-none]').hidden = r.subscribers.length > 0;
    A.$('[data-rows]').replaceChildren.apply(A.$('[data-rows]'), r.subscribers.map(function (s) {
      const cls = { confirme: 'livree', attente: 'attente', desinscrit: 'annulee' }[s.status];
      const act = s.status === 'desinscrit' ? '—' : h('button', { type: 'button', class: 'linkbtn', onclick: async function () {
        if (!confirm('Désinscrire ' + s.email + ' ?')) return;
        const x = await MA.api('/api/admin/subscribers', { method: 'POST', body: { email: s.email } }); if (x.ok) load();
      } }, 'Désinscrire');
      return h('tr', null, h('th', { scope: 'row' }, s.email), h('td', null, A.date(s.at)), h('td', null, s.source), h('td', null, h('span', { class: 'status ' + cls }, s.statusLabel)), h('td', null, act));
    }));
    A.$('[data-count]').textContent = r.total + ' adresse' + (r.total > 1 ? 's' : '');
    A.$('[data-pageinfo]').textContent = 'Page ' + r.page + ' sur ' + r.pages;
    A.$('[data-prev]').disabled = r.page <= 1; A.$('[data-next]').disabled = r.page >= r.pages;
    A.$('[data-export]').href = '/api/admin/subscribers?format=csv&' + qs;
  }

  async function loadCampaigns() {
    const r = await MA.api('/api/admin/campaign');
    if (!r.ok) return;
    A.$('[data-mail-off]').hidden = r.mailReady;
    A.$$('[data-audience] option').forEach(function (o) { o.textContent = AUD[o.value] + ' (' + r.audiences[o.value] + ')'; });
    A.$('[data-campaigns]').replaceChildren.apply(A.$('[data-campaigns]'), r.campaigns.length ? r.campaigns.map(function (c) { return h('li', null, A.time(c.at) + ' — « ' + c.subject + ' » · ' + c.sent + ' envoi' + (c.sent > 1 ? 's' : '') + ' · ' + (AUD[c.audience] || c.audience) + ' (' + c.by + ')'); }) : [h('li', null, 'Aucune campagne envoyée pour le moment.')]);
  }

  function preview() {
    const f = A.$('[data-campaign]').elements;
    A.$('[data-pv-title]').textContent = f.title.value.trim() || f.subject.value.trim() || 'Titre de la lettre';
    const body = f.body.value.trim(), box = A.$('[data-pv-body]');
    box.replaceChildren.apply(box, (body ? body.split(/\n{2,}/) : ['Le contenu de la lettre apparaîtra ici.']).map(function (p) {
      const el = h('p'); p.split('\n').forEach(function (l, i) { if (i) el.append(h('br')); el.append(l); }); return el;
    }));
  }

  async function send(mode) {
    const form = A.$('[data-campaign]'), f = form.elements;
    A.fieldErrors(form, null);
    const body = { subject: f.subject.value.trim(), title: f.title.value.trim(), body: f.body.value, audience: f.audience.value, mode: mode };
    if (mode === 'send') {
      const opt = f.audience.selectedOptions[0].textContent;
      if (!confirm('Envoyer « ' + body.subject + ' » à : ' + opt + ' ? L’envoi est immédiat et définitif.')) return;
    }
    const btn = A.$(mode === 'test' ? '[data-test]' : '[data-send]'); MA.busy(btn, true, 'Envoi…');
    const r = await MA.api('/api/admin/campaign', { method: 'POST', body: body });
    MA.busy(btn, false);
    if (!r.ok) { A.fieldErrors(form, r.fields); A.flash(A.$('[data-flash]'), r.error, false); return; }
    A.flash(A.$('[data-flash]'), mode === 'test' ? '✓ Test envoyé à votre adresse.' : '✓ Campagne envoyée à ' + r.sent + ' abonné' + (r.sent > 1 ? 's' : '') + '.');
    if (mode === 'send') { form.reset(); preview(); loadCampaigns(); }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('newsletter'))) return;
    A.$('[data-q]').addEventListener('input', function (e) { clearTimeout(timer); timer = setTimeout(function () { st.q = e.target.value.trim(); st.page = 1; load(); }, 250); });
    A.$('[data-status]').addEventListener('change', function (e) { st.status = e.target.value; st.page = 1; load(); });
    A.$('[data-prev]').addEventListener('click', function () { st.page--; load(); });
    A.$('[data-next]').addEventListener('click', function () { st.page++; load(); });
    A.$('[data-campaign]').addEventListener('input', preview);
    A.$('[data-campaign]').addEventListener('submit', function (e) { e.preventDefault(); send('send'); });
    A.$('[data-test]').addEventListener('click', function () { send('test'); });
    load(); loadCampaigns();
  });
})();
