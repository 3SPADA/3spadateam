// Dipakai di semua halaman publik (home, team, about) untuk mengisi teks
// yang bisa diedit admin. Elemen dengan id "c-<key>" diisi textContent-nya,
// elemen dengan id "href-<key>" diisi atribut href-nya.

// Cuma izinkan href http/https (atau mailto: untuk email) — jaga-jaga kalau
// ada data lama yang tersimpan sebelum validasi backend ditambahkan.
function isSafeHref(value, allowMailto) {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
    if (allowMailto && url.protocol === 'mailto:') return true;
    return false;
  } catch {
    return false;
  }
}

(async () => {
  try {
    const res = await fetch(API_BASE + '/content');
    const content = await res.json();
    Object.entries(content).forEach(([key, value]) => {
      const textEl = document.getElementById('c-' + key);
      if (textEl) textEl.textContent = value;

      const hrefEl = document.getElementById('href-' + key);
      if (hrefEl && isSafeHref(value, key === 'contact_email_url')) {
        hrefEl.setAttribute('href', value);
      }
    });
  } catch (err) {
    console.error('Gagal memuat teks halaman:', err);
  }
})();
