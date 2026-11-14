// "Notify me" sign-up for news of the complete COSTAR system (Settings > About and the About page).
// Addresses go to Kevin's SwipeOne workspace through an incoming webhook, tagged costar_system_notify.
// Until SIGNUP_URL is filled in, the form stays hidden.
(function () {
  const SIGNUP_URL = 'https://integrations-api.swipeone.com/webhooks/apps/generic-webhooks/6af806d27fb4b1dc1a54d1b8';   // SwipeOne incoming-webhook URL (https://integrations-api.swipeone.com/...)
  const TAG = 'costar_system_notify';
  if (!SIGNUP_URL) return;
  const looksLikeEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  document.querySelectorAll('form.signup').forEach(form => {
    form.hidden = false;
    const input = form.querySelector('input[name=email]');
    const msg = form.querySelector('.signup-msg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.website.value) return;   // filled in only by robots
      const email = input.value.trim();
      if (!looksLikeEmail(email)) { msg.textContent = 'Please enter a full email address.'; input.focus(); return; }
      form.querySelector('button').disabled = true;
      msg.textContent = 'Sending…';
      try {
        // A plain form-style post: the webhook accepts it without the browser asking permission first.
        await fetch(SIGNUP_URL, { method: 'POST', mode: 'no-cors',
          body: new URLSearchParams({ email, tags: TAG, source: 'COSTAR Spiral-Tuned Guitar' }) });
        form.querySelector('.signup-row').hidden = true;
        msg.textContent = 'Thank you. You’ll hear when the complete COSTAR system is presented.';
        try { if (window.rybbit) window.rybbit.event('Signed up for COSTAR news'); } catch (err) {}
      } catch (err) {
        form.querySelector('button').disabled = false;
        msg.textContent = 'That didn’t go through. Please check your connection and try again.';
      }
    });
  });
})();
