/* Maison Archam — petites interactions communes */
(function () {
  // Formulaires pas encore reliés à un service : on affiche un message de confirmation
  document.querySelectorAll('form[data-fake-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-msg');
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'form-msg';
        msg.setAttribute('role', 'status');
        form.appendChild(msg);
      }
      msg.textContent = form.getAttribute('data-fake-form');
      form.reset();
    });
  });

  // Filtres du Journal
  var filters = document.querySelectorAll('[data-filter]');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      document.querySelectorAll('.post[data-cat]').forEach(function (post) {
        post.hidden = cat !== 'all' && post.getAttribute('data-cat') !== cat;
      });
    });
  });
})();
