// "Suggest" (Settings, beside About) opens Userback's feedback form, with no sign-in.
// Userback's floating "Feedback" tab is never shown: the stylesheet rule below hides it, and the
// widget's container is switched on only when Suggest is clicked (the form lives inside it).
// If Userback hasn't loaded, the link simply opens the ideas board (its href).
(function () {
  window.Userback = window.Userback || {};
  Userback.access_token = 'A-sOoDa4aTxIyUBIBqvmtmPMLlFZmaDBWazMTmDyCIaZaFuMobyd';
  Userback.on_load = function () { try { Userback.hideLauncher(); } catch (e) {} };

  const style = document.createElement('style');
  style.textContent = '#userback_button_container .userback-button { display: none !important; }';
  document.head.appendChild(style);

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://static.userback.io/widget/v1.js';
  (document.head || document.body).appendChild(s);

  const link = document.getElementById('suggest-link');
  if (link) link.addEventListener('click', e => {
    if (typeof Userback.open !== 'function' || typeof Userback.showLauncher !== 'function') return;
    e.preventDefault();
    try {
      Userback.showLauncher();                     // the form appears inside the launcher's container
      Userback.open('feature_request', 'form');
      if (window.rybbit) window.rybbit.event('Opened Suggest form');
    } catch (err) { window.open(link.href, '_blank'); }
  });
})();
