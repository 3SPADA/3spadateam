// Halaman Home sekarang mengambil event dan hasil match dari backend (teks umum
// ditangani oleh js/content.js yang dimuat bersama di halaman ini).

const MONTH_SHORT_UPPER = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const FIXTURE_AVATAR_COLORS = ['#ff2e4d', '#4a5568', '#33c17a', '#c9a227', '#6c7686', '#8a5cf6', '#2b9fd6'];

function parseDateParts(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { day: String(d).padStart(2, '0'), month: m - 1, year: y };
}

function fixtureInitials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function fixtureAvatarColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return FIXTURE_AVATAR_COLORS[Math.abs(hash) % FIXTURE_AVATAR_COLORS.length];
}

function buildEventFixtureCard(ev) {
  const { day, month, year } = parseDateParts(ev.event_date);
  return `
    <div class="fixture-card">
      <div class="fixture-top">
        <span class="fixture-pill date">${day} ${MONTH_SHORT_UPPER[month]} ${year}</span>
        ${ev.tag ? `<span class="fixture-pill tag">${escapeHtml(ev.tag)}</span>` : ''}
      </div>
      <div class="event-fixture-name">${escapeHtml(ev.name)}</div>
      <div class="event-fixture-loc">${escapeHtml(ev.location || '')}</div>
    </div>`;
}

function buildMatchFixtureCard(m) {
  const { day, month, year } = parseDateParts(m.match_date);
  const isWin = m.result === 'menang';
  return `
    <div class="fixture-card">
      <div class="fixture-top">
        <span class="fixture-pill date">${day} ${MONTH_SHORT[month]} ${year}</span>
        <span class="fixture-pill ${isWin ? 'win' : 'loss'}">${isWin ? 'MENANG' : 'KALAH'}</span>
      </div>
      <div class="fixture-teams">
        <div class="fixture-team">
          <div class="team-avatar" style="background:var(--blade);">3S</div>
          <span>3SPADA</span>
        </div>
        <div class="fixture-score">${escapeHtml(m.score)}</div>
        <div class="fixture-team">
          <div class="team-avatar" style="background:${fixtureAvatarColor(m.opponent)};">${escapeHtml(fixtureInitials(m.opponent))}</div>
          <span>${escapeHtml(m.opponent)}</span>
        </div>
      </div>
    </div>`;
}

(async () => {
  let eventsCache = [];
  let matchesCache = [];

  // ---------- SPONSOR ----------
  try {
    const res = await fetch(API_BASE + '/sponsors');
    const sponsors = await res.json();
    const strip = document.getElementById('sponsor-strip');
    if (sponsors.length === 0) {
      strip.innerHTML = '<div class="sponsor-tile"><div style="color:var(--muted)">Belum ada sponsor.</div></div>';
    } else {
      strip.innerHTML = sponsors.map(s => `
        <div class="sponsor-tile">
          <div class="mark">${escapeHtml(s.name)}</div>
          <div class="kind">${escapeHtml(s.kind || '')}</div>
        </div>`).join('');
    }
  } catch (err) {
    console.error('Gagal memuat sponsor:', err);
  }

  // ---------- EVENT (gaya fixture card, scroll horizontal) ----------
  try {
    const res = await fetch(API_BASE + '/events');
    eventsCache = await res.json();
    const list = document.getElementById('event-list');
    list.innerHTML = eventsCache.length
      ? eventsCache.map(buildEventFixtureCard).join('')
      : '<div class="fixture-card"><div style="color:var(--muted)">Belum ada agenda.</div></div>';
  } catch (err) {
    console.error('Gagal memuat event:', err);
  }

  // ---------- HASIL MATCH (gaya fixture card: 3SPADA vs lawan) ----------
  try {
    const res = await fetch(API_BASE + '/matches');
    matchesCache = await res.json();
    const grid = document.getElementById('match-grid');
    grid.innerHTML = matchesCache.length
      ? matchesCache.map(buildMatchFixtureCard).join('')
      : '<div class="fixture-card"><div style="color:var(--muted)">Belum ada hasil pertandingan.</div></div>';
  } catch (err) {
    console.error('Gagal memuat hasil match:', err);
  }

  // ---------- MARQUEE DI HERO (gabungan event + match, auto-scroll) ----------
  // Terinspirasi dari fixtured.com: strip kartu jadwal yang jalan otomatis di hero.
  const marquee = document.getElementById('hero-marquee');
  if (marquee) {
    const combined = [...matchesCache.map(buildMatchFixtureCard), ...eventsCache.map(buildEventFixtureCard)];
    if (combined.length === 0) {
      marquee.style.display = 'none';
    } else {
      // Digandakan dua kali biar animasi scroll-nya keliatan nyambung terus (looping mulus)
      marquee.innerHTML = combined.join('') + combined.join('');
    }
  }

  // ---------- TOP ARRANCAR (leaderboard publik) ----------
  try {
    const res = await fetch(API_BASE + '/reports/top10');
    const top10 = await res.json();
    const list = document.getElementById('arrancar-list');

    if (!res.ok || top10.length === 0) {
      list.innerHTML = '<li style="color:var(--muted); font-size:13px;">Belum ada data performa player.</li>';
    } else {
      list.innerHTML = top10.map(p => {
        const isTop = p.rank <= 3 ? ' top' : '';
        const scoreText = p.overall_score !== null ? p.overall_score : '-';
        const subText = [p.ign ? '@' + escapeHtml(p.ign) : null, p.game_role ? escapeHtml(p.game_role) : null].filter(Boolean).join(' · ');
        return `
          <li class="arrancar-item${isTop}">
            <div class="arrancar-rank">${String(p.rank).padStart(2, '0')}</div>
            <div class="arrancar-info">
              <div class="arrancar-name">${escapeHtml(p.full_name)}</div>
              <div class="arrancar-sub">${subText || '-'}</div>
            </div>
            <div class="arrancar-score">${scoreText}</div>
          </li>`;
      }).join('');
    }
  } catch (err) {
    const list = document.getElementById('arrancar-list');
    if (list) list.innerHTML = '<li style="color:var(--loss); font-size:13px;">Gagal memuat peringkat.</li>';
  }
})();
