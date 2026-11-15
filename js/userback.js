// "Suggest" (Settings, beside About) opens Userback's feedback form, with no sign-in.
// Userback's own floating button is kept hidden. If the form can't open, the link falls back to
// the ideas board (its href).
(function () {
  window.Userback = window.Userback || {};
  Userback.access_token = 'A-sOoDa4aTxIyUBIBqvmtmPMLlFZmaDBWazMTmDyCIaZaFuMobyd';
  Userback.on_load = function () {
    try { if (Userback.hideLauncher) Userback.hideLauncher(); else if (Userback.hide) Userback.hide(); } catch (e) {}
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://static.userback.io/widget/v1.js';
  (document.head || document.body).appendChild(s);

  const link = document.getElementById('suggest-link');
  if (link) link.addEventListener('click', e => {
    if (typeof Userback.open !== 'function') return;   // not loaded: follow the link to the board
    e.preventDefault();
    try {
      Userback.open('feature_request', 'form');
      if (window.rybbit) window.rybbit.event('Opened Suggest form');
    } catch (err) { window.open(link.href, '_blank'); }
  });
})();
