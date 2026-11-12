// Click an image in Settings > About to see it enlarged over the whole page.
// Click the enlarged image again to see it at full size and scroll around it; click once more to fit it back.
// Close with the × button, a click outside the image, or the Esc key.
(function () {
  const box = document.createElement('div');
  box.id = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<img alt=""><button type="button" aria-label="Close" title="Close (Esc)">×</button>';
  document.body.appendChild(box);
  const big = box.querySelector('img');
  const closeBtn = box.querySelector('button');

  // Only offer full size when the picture has more detail than the fitted view shows.
  function updateZoomable() {
    const r = big.getBoundingClientRect();
    big.classList.toggle('can-zoom', !box.classList.contains('full') && big.naturalWidth > r.width * 1.15);
  }
  big.addEventListener('load', updateZoomable);
  window.addEventListener('resize', () => { if (box.classList.contains('open')) updateZoomable(); });

  function open(img) {
    box.classList.remove('full');
    big.src = img.src;
    big.alt = img.alt;
    box.classList.add('open');
    if (big.complete) updateZoomable();
    try { if (window.rybbit) window.rybbit.event('Image enlarged', { image: img.src.split('/').pop() }); } catch (e) {}
  }
  function close() { box.classList.remove('open', 'full'); }

  // Switch to full size, keeping the spot that was clicked under the pointer.
  function toFull(e) {
    const r = big.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    box.classList.add('full');
    big.classList.remove('can-zoom');
    box.scrollLeft = big.offsetLeft + fx * big.offsetWidth - e.clientX;
    box.scrollTop = big.offsetTop + fy * big.offsetHeight - e.clientY;
    try { if (window.rybbit) window.rybbit.event('Image full size', { image: big.src.split('/').pop() }); } catch (err) {}
  }

  document.querySelectorAll('img.zoomable').forEach(img => img.addEventListener('click', () => open(img)));
  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
  box.addEventListener('click', e => {
    if (e.target !== big) return close();
    if (box.classList.contains('full')) { box.classList.remove('full'); box.scrollTop = box.scrollLeft = 0; updateZoomable(); }
    else if (big.classList.contains('can-zoom')) toFull(e);
    else close();
  });
  // While an image is open, Esc closes it and the other keyboard shortcuts wait.
  window.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.key === 'Escape') close();
  }, true);
})();
