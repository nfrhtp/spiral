// The contact address is put together here, so it isn't sitting in the page for
// address-harvesting robots to copy. Without JavaScript it reads "nfrhtp [at] tlg.earth".
document.querySelectorAll('a.contact').forEach(a => {
  const addr = a.dataset.u + '@' + a.dataset.d;
  a.href = 'mailto:' + addr;
  a.textContent = addr;
});
