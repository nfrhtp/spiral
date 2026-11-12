// Click an image in Settings > About to see it enlarged over the whole page.
// Close with the × button, a click anywhere, or the Esc key.
(function () {
  const box = document.createElement('div');
  box.id = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<img alt=""><button type="button" aria-label="Close" title="Close (Esc)">×</button>';
  document.body.appendChild(box);
  const big = box.querySelector('img');

  function open(img) {
    big.src = img.src;
    big.alt = img.alt;
    box.classList.add('open');
    try { if (window.rybbit) window.rybbit.event('Image enlarged', { image: img.src.split('/').pop() }); } catch (e) {}
  }
  function close() { box.classList.remove('open'); }

  document.querySelectorAll('img.zoomable').forEach(img => img.addEventListener('click', () => open(img)));
  box.addEventListener('click', close);
  // While an image is open, Esc closes it and the other keyboard shortcuts wait.
  window.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.key === 'Escape') close();
  }, true);
})();
