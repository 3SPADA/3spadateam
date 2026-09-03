// PENTING: ini cuma penghalang ringan buat pengunjung awam, BUKAN proteksi
// keamanan sungguhan. Source HTML/CSS/JS tetap terkirim ke browser siapa pun
// yang membuka halaman ini, dan bisa dilihat lewat cara lain (curl, matikan
// JavaScript di browser, ekstensi, dsb). Jangan taruh data rahasia
// (password, secret key, dsb) di kode frontend dengan asumsi script ini
// akan menyembunyikannya — itu tetap kelihatan.

(function () {
  // Matikan klik kanan (context menu)
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Matikan shortcut umum buat buka DevTools / lihat source
  document.addEventListener('keydown', function (e) {
    const key = e.key;
    const isF12 = key === 'F12';
    const isInspect = e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key);
    const isViewSource = e.ctrlKey && ['U', 'u'].includes(key);
    const isSave = e.ctrlKey && ['S', 's'].includes(key);

    if (isF12 || isInspect || isViewSource || isSave) {
      e.preventDefault();
    }
  });
})();
