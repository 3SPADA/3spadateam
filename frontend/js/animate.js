// Animasi ringan buat halaman Home: scroll-reveal per section, dan angka
// statistik di hero yang "hitung naik" pas pertama kali kelihatan.
// Otomatis nonaktif kalau user set prefers-reduced-motion di OS/browser-nya.

(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- SCROLL REVEAL ----------
  const revealEls = document.querySelectorAll('.reveal');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // sedikit delay bertahap biar kelihatan "muncul satu-satu", bukan bareng semua
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el => observer.observe(el));
  }

  // ---------- COUNT-UP ANGKA STATISTIK HERO ----------
  if (prefersReducedMotion) return;

  function setupStatCountUp() {
    const statNums = document.querySelectorAll('.stat-row .num');
    statNums.forEach(el => {
      const raw = el.textContent.trim();
      const match = raw.match(/^(\d+)/); // ambil angka di depan, contoh "2023" atau "14"
      if (!match) return; // biarkan apa adanya kalau bukan angka (misal "9-5")

      const target = parseInt(match[1], 10);
      const suffix = raw.slice(match[1].length); // sisa teks setelah angka, kalau ada
      const duration = 900;
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(target * eased);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }

      el.textContent = '0' + suffix;
      const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            requestAnimationFrame(step);
            statObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      statObserver.observe(el);
    });
  }

  // Tunggu content.js selesai isi teks asli dari API dulu (kalau halamannya
  // memang memuat content.js), baru setup count-up — supaya animasinya jalan
  // ke angka yang benar, bukan ke placeholder yang ada di HTML.
  // Kalau halaman ini tidak memuat content.js sama sekali, event ini tidak
  // akan pernah terjadi, jadi pasang fallback timeout kecil.
  let statSetupDone = false;
  document.addEventListener('content-loaded', () => {
    if (statSetupDone) return;
    statSetupDone = true;
    setupStatCountUp();
  });
  setTimeout(() => {
    if (statSetupDone) return;
    statSetupDone = true;
    setupStatCountUp();
  }, 1500);
})();
