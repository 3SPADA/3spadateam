// Home.html sekarang mengambil event dan hasil match dari backend (teks umum
// ditangani oleh js/content.js yang dimuat bersama di halaman ini).

const MONTH_SHORT_UPPER = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function parseDateParts(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { day: String(d).padStart(2, '0'), month: m - 1, year: y };
}

(async () => {
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
          <div class="mark">${s.name}</div>
          <div class="kind">${s.kind || ''}</div>
        </div>`).join('');
    }
  } catch (err) {
    console.error('Gagal memuat sponsor:', err);
  }

  // ---------- EVENT ----------
  try {
    const res = await fetch(API_BASE + '/events');
    const events = await res.json();
    const list = document.getElementById('event-list');
    if (events.length === 0) {
      list.innerHTML = '<div class="event-row"><div style="color:var(--muted)">Belum ada agenda.</div></div>';
    } else {
      list.innerHTML = events.map(ev => {
        const { day, month, year } = parseDateParts(ev.event_date);
        return `
          <div class="event-row">
            <div class="event-date">${day} ${MONTH_SHORT_UPPER[month]}<br>${year}</div>
            <div><div class="event-name">${ev.name}</div><div class="event-loc">${ev.location || ''}</div></div>
            <div class="event-tag">${ev.tag || ''}</div>
          </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Gagal memuat event:', err);
  }

  // ---------- HASIL MATCH ----------
  try {
    const res = await fetch(API_BASE + '/matches');
    const matches = await res.json();
    const grid = document.getElementById('match-grid');
    if (matches.length === 0) {
      grid.innerHTML = '<div class="match-card"><div style="color:var(--muted)">Belum ada hasil pertandingan.</div></div>';
    } else {
      grid.innerHTML = matches.map(m => {
        const { day, month, year } = parseDateParts(m.match_date);
        const badgeClass = m.result === 'menang' ? 'win' : 'loss';
        const badgeText = m.result === 'menang' ? 'MENANG' : 'KALAH';
        return `
          <div class="match-card">
            <div><div class="match-opp">vs ${m.opponent}</div><div class="match-date">${day} ${MONTH_SHORT[month]} ${year}</div></div>
            <div style="display:flex;align-items:center;gap:16px;"><span class="match-score">${m.score}</span><span class="badge ${badgeClass}">${badgeText}</span></div>
          </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Gagal memuat hasil match:', err);
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
        const subText = [p.ign ? '@' + p.ign : null, p.game_role].filter(Boolean).join(' · ');
        return `
          <li class="arrancar-item${isTop}">
            <div class="arrancar-rank">${String(p.rank).padStart(2, '0')}</div>
            <div class="arrancar-info">
              <div class="arrancar-name">${p.full_name}</div>
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
