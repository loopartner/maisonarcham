/* Back-office — fiches produits. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const ST = { published: ['livree', 'Publié'], draft: ['attente', 'Brouillon'], archived: ['annulee', 'Archivé'] };
  let products = [], media = [], editing = null, selected = [];
  const form = () => A.$('[data-editor]');
  const toEur = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

  function renderList() {
    const stock = products.reduce((n, p) => n + (p.stock || 0), 0), unlimited = products.some((p) => p.stock === null);
    const kpi = (l, v) => h('div', { class: 'kpi' }, h('p', { class: 'eyebrow muted' }, l), h('p', { class: 'kpi-v serif' }, v));
    A.$('[data-kpis]').replaceChildren(kpi('Fiches', String(products.length)), kpi('En ligne', String(products.filter((p) => p.status === 'published').length)), kpi('Brouillons', String(products.filter((p) => p.status === 'draft').length)), kpi('Stock total', unlimited ? 'Illimité' : String(stock)));
    A.$('[data-rows]').replaceChildren.apply(A.$('[data-rows]'), products.map(function (p) {
      const low = p.stock !== null && p.stock <= p.stockAlert;
      const tr = h('tr', { class: 'clickable' },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkbtn', onclick: function () { edit(p); } }, p.name + ' · ' + p.volume)),
        h('td', null, p.id), h('td', null, A.euros(p.price)), h('td', { class: low ? 'kpi-d down' : '' }, p.stock === null ? 'Illimité' : String(p.stock) + (low ? ' · stock bas' : '')),
        h('td', null, h('span', { class: 'status ' + ST[p.status][0] }, ST[p.status][1])), h('td', null, A.date(p.updatedAt)));
      tr.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') edit(p); });
      return tr;
    }));
  }

  function renderMedia() {
    A.$('[data-media]').replaceChildren.apply(A.$('[data-media]'), media.map(function (src) {
      const i = selected.indexOf(src);
      const b = h('button', { type: 'button', class: 'media-item' + (i >= 0 ? ' on' : ''), 'aria-pressed': String(i >= 0), 'aria-label': (i >= 0 ? 'Retirer ' : 'Ajouter ') + src.split('/').pop() }, h('img', { src: src, alt: '', width: '120', height: '150' }), i >= 0 ? h('span', { class: 'media-n' }, String(i + 1)) : null);
      b.addEventListener('click', function () { if (i >= 0) selected.splice(i, 1); else selected.push(src); renderMedia(); });
      return b;
    }));
  }

  function edit(p) {
    editing = p; const f = form().elements;
    A.fieldErrors(form(), null); A.$('[data-error]').hidden = true; A.$('[data-flash]').hidden = true;
    const v = p || { name: '', tagline: '', description: '', family: '', sillage: '', notes: { top: [], heart: [], base: [] }, price: null, comparePrice: null, kind: 'Extrait de parfum', volume: '', id: '', status: 'draft', stock: null, stockAlert: 5, images: [] };
    ['name', 'tagline', 'description', 'family', 'sillage', 'kind', 'volume', 'id', 'status'].forEach(function (k) { f[k].value = v[k] || ''; });
    f.top.value = v.notes.top.join(', '); f.heart.value = v.notes.heart.join(', '); f.base.value = v.notes.base.join(', ');
    f.price.value = toEur(v.price); f.comparePrice.value = toEur(v.comparePrice);
    f.stock.value = v.stock === null ? '' : v.stock; f.stockAlert.value = v.stockAlert;
    f.id.readOnly = Boolean(p); f.id.title = p ? 'La référence ne peut plus être modifiée.' : '';
    selected = (v.images || []).slice(); renderMedia();
    A.$('[data-delete]').hidden = !p || p.status === 'published';
    A.$('[data-list-view]').hidden = true; form().hidden = false; A.$('[data-new]').hidden = true; f.name.focus();
  }
  function back() { form().hidden = true; A.$('[data-list-view]').hidden = false; A.$('[data-new]').hidden = false; }

  async function load() { const r = await MA.api('/api/admin/products'); if (r.ok) { products = r.products; media = r.media; renderList(); } }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('products'))) return;
    A.publishBar();
    A.$('[data-new]').addEventListener('click', function () { edit(null); });
    A.$('[data-back]').addEventListener('click', back);
    form().addEventListener('submit', async function (e) {
      e.preventDefault(); const f = form().elements;
      A.fieldErrors(form(), null); A.$('[data-error]').hidden = true;
      const body = { name: f.name.value, tagline: f.tagline.value, description: f.description.value, family: f.family.value, sillage: f.sillage.value, kind: f.kind.value, volume: f.volume.value, id: f.id.value, status: f.status.value, price: f.price.value, comparePrice: f.comparePrice.value, stock: f.stock.value, stockAlert: f.stockAlert.value, notes: { top: f.top.value, heart: f.heart.value, base: f.base.value }, images: selected };
      const btn = form().querySelector('button[type="submit"]'); MA.busy(btn, true, 'Enregistrement…');
      const r = await MA.api('/api/admin/products', { method: editing ? 'PUT' : 'POST', body: body });
      MA.busy(btn, false);
      if (!r.ok) { A.fieldErrors(form(), r.fields); const er = A.$('[data-error]'); er.textContent = r.error; er.hidden = false; er.focus && er.setAttribute('tabindex', '-1'); return; }
      products = r.products; renderList(); editing = r.product; f.id.readOnly = true;
      A.flash(A.$('[data-flash]'), '✓ Fiche enregistrée. Le prix et le stock s’appliquent immédiatement ; publiez le site pour mettre à jour les textes et photos.');
      A.publishBar();
    });
    A.$('[data-delete]').addEventListener('click', async function () {
      if (!editing || !confirm('Supprimer définitivement la fiche « ' + editing.name + ' » ?')) return;
      const r = await MA.api('/api/admin/products', { method: 'DELETE', body: { id: editing.id } });
      if (!r.ok) { A.flash(A.$('[data-flash]'), r.error, false); return; }
      products = r.products; renderList(); back(); A.publishBar();
    });
    load();
  });
})();
