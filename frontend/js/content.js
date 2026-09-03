// Dipakai di semua halaman publik (home, team, about) untuk mengisi teks
// yang bisa diedit admin. Elemen dengan id "c-<key>" diisi textContent-nya,
// elemen dengan id "href-<key>" diisi atribut href-nya.
(async () => {
  try {
    const res = await fetch(API_BASE + '/content');
    const content = await res.json();
    Object.entries(content).forEach(([key, value]) => {
      const textEl = document.getElementById('c-' + key);
      if (textEl) textEl.textContent = value;

      const hrefEl = document.getElementById('href-' + key);
      if (hrefEl) hrefEl.setAttribute('href', value);
    });
  } catch (err) {
    console.error('Gagal memuat teks halaman:', err);
  }
})();
