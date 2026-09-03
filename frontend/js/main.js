// Escape teks user sebelum dimasukkan ke innerHTML, mencegah XSS
// (misal ada yang isi nama/event/sponsor dengan kode HTML/script).
// Dipakai di semua file JS lain yang render data dari API ke innerHTML.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toggle menu mobile (dipakai di semua halaman)
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (burger && menu) {
    burger.addEventListener('click', () => menu.classList.toggle('open'));
  }

  // Tab Player / Staff (khusus halaman Team)
  document.querySelectorAll('.team-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.dataset.group;
      document.querySelectorAll('.team-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.roster-group').forEach(g => g.classList.toggle('active', g.id === 'roster-' + group));
    });
  });
});
