// Toggle menu mobile (dipakai di semua halaman)
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (burger && menu) {
    burger.addEventListener('click', () => menu.classList.toggle('open'));
  }

  // Tab Player / Staff (khusus halaman team.html)
  document.querySelectorAll('.team-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.dataset.group;
      document.querySelectorAll('.team-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.roster-group').forEach(g => g.classList.toggle('active', g.id === 'roster-' + group));
    });
  });
});
