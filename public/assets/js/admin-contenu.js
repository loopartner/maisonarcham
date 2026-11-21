/* Back-office — contenu : articles du Journal, sections de la Maison, bloc newsletter. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const ST = { published: ['livree', 'Publié'], scheduled: ['preparation', 'Programmé'], draft: ['attente', 'Brouillon'] };
  let articles = [], media = [], editing = null, mainImg = '', gallery = [];
  const ed = () => A.$('[data-editor]');
  const plain = (t) => String(t).replace(/<\/?em>/g, '');

  function picker(box, isOn, toggle) {
    A.$(box).replaceChildren.apply(A.$(box), media.map(function (src) {
      const on = isOn(src);
      const b = h('button', { type: 'button', class: 'media-item' + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': src.split('/').pop() }, h('img', { src: src, alt: '', width: '120', height: '150' }));
      b.addEventListener('click', function () { toggle(src); });
      return b;
    }));
  }
  function renderPickers() {
    picker('[data-media-main]', function (s) { return s === mainImg; }, function (s) { mainImg = s; renderPickers(); });
    picker('[data-media-gallery]', function (s) { return gallery.includes(s); }, function (s) { gallery = gallery.includes(s) ? gallery.filter((x) => x !== s) : gallery.concat(s).slice(0, 4); renderPickers(); });
  }

  function renderList() {
    A.$('[data-rows]').replaceChildren.apply(A.$('[data-rows]'), articles.map(function (a) {
      const tr = h('tr', { class: 'clickable' }, h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkbtn', onclick: function () { edit(a); } }, plain(a.title) + (a.featured ? ' · à la une' : ''))),
        h('td', null, a.category), h('td', null, A.date(a.date)), h('td', null, h('span', { class: 'status ' + ST[a.status][0] }, ST[a.status][1])));
      tr.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') edit(a); });
      return tr;
    }));
  }

  function edit(a) {
    editing = a; const f = ed().elements;
    A.fieldErrors(ed(), null); A.$('[data-error]', ed()).hidden = true; A.$('[data-flash]', ed()).hidden = true;
    f.title.value = a ? a.title : ''; f.category.value = a ? a.category : 'Parfumerie'; f.date.value = a ? a.date : new Date().toISOString().slice(0, 10);
    f.status.value = a ? a.status : 'draft'; f.featured.checked = a ? a.featured === true : false;
    f.excerpt.value = a ? a.excerpt : ''; f.body.value = a ? a.bodyText : ''; f.imageAlt.value = a ? a.imageAlt || '' : ''; f.caption.value = a ? a.caption || '' : '';
    mainImg = a ? a.image : ''; gallery = a ? (a.gallery || []).map((g) => g.src) : []; renderPickers();
    const pv = A.$('[data-preview]'); pv.hidden = !(a && a.status === 'published'); if (a) pv.href = '/journal/' + a.slug;
    A.$('[data-delete]').hidden = !a;
    A.$('[data-list-view]').hidden = true; ed().hidden = false; A.$('[data-new]').hidden = true; f.title.focus();
  }
  function back() { ed().hidden = true; A.$('[data-list-view]').hidden = false; A.$('[data-new]').hidden = false; }

  async function load() {
    const r = await MA.api('/api/admin/articles'); if (!r.ok) return;
    articles = r.articles; media = r.media;
    A.$('[data-cats]').replaceChildren.apply(A.$('[data-cats]'), r.categories.map(function (c) { return h('option', { value: c }, c); }));
    renderList();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('content'))) return;
    A.publishBar();
    A.$('[data-new]').addEventListener('click', function () { edit(null); });
    A.$('[data-back]').addEventListener('click', back);
    ed().addEventListener('submit', async function (e) {
      e.preventDefault(); const f = ed().elements; A.fieldErrors(ed(), null); A.$('[data-error]', ed()).hidden = true;
      const body = { slug: editing ? editing.slug : undefined, title: f.title.value, category: f.category.value, date: f.date.value, status: f.status.value, featured: f.featured.checked, excerpt: f.excerpt.value, body: f.body.value, image: mainImg, imageAlt: f.imageAlt.value, caption: f.caption.value, gallery: gallery };
      const btn = ed().querySelector('button[type="submit"]'); MA.busy(btn, true, 'Enregistrement…');
      const r = await MA.api('/api/admin/articles', { method: editing ? 'PUT' : 'POST', body: body });
      MA.busy(btn, false);
      if (!r.ok) { A.fieldErrors(ed(), r.fields); const er = A.$('[data-error]', ed()); er.textContent = r.error; er.hidden = false; return; }
      editing = r.article; await load();
      A.flash(A.$('[data-flash]', ed()), '✓ Article enregistré. Publiez le site pour le mettre en ligne.'); A.publishBar();
    });
    A.$('[data-delete]').addEventListener('click', async function () {
      if (!editing || !confirm('Supprimer l’article « ' + plain(editing.title) + ' » ?')) return;
      const r = await MA.api('/api/admin/articles', { method: 'DELETE', body: { slug: editing.slug } });
      if (r.ok) { await load(); back(); A.publishBar(); }
    });

    const pr = await MA.api('/api/admin/pages');
    if (pr.ok) {
      const m = A.$('[data-maison]'), n = A.$('[data-nl]');
      Object.entries(pr.pages.maison.sections).forEach(function (kv) { if (m.elements[kv[0]]) m.elements[kv[0]].checked = kv[1]; });
      ['eyebrow', 'title', 'text', 'confirm'].forEach(function (k) { n.elements[k].value = pr.pages.newsletter[k]; });
      const save = async function (form) {
        const body = { maison: { sections: {} }, newsletter: {} };
        ['histoire', 'philosophie', 'savoirfaire', 'inspirations', 'engagements'].forEach(function (k) { body.maison.sections[k] = m.elements[k].checked; });
        ['eyebrow', 'title', 'text', 'confirm'].forEach(function (k) { body.newsletter[k] = n.elements[k].value; });
        const r = await MA.api('/api/admin/pages', { method: 'POST', body: body });
        A.flash(A.$('[data-flash]', form), r.ok ? '✓ Enregistré. Publiez le site pour appliquer.' : r.error, r.ok); A.publishBar();
      };
      [m, n].forEach(function (form) { form.addEventListener('submit', function (e) { e.preventDefault(); save(form); }); });
    }
    load();
  });
})();
