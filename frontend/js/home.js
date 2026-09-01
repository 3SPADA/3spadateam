// Home.html sekarang mengambil teks, event, dan hasil match dari backend,
// supaya admin bisa mengubahnya tanpa harus edit kode.

const MONTH_SHORT_UPPER = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function parseDateParts(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { day: String(d).padStart(2, '0'), month: m - 1, year: y };
}

(async () => {
  // ---------- TEKS LANDING PAGE ----------
  try {
    const res = await fetch(API_BASE + '/content');
    const content = await res.json();
    Object.entries(content).forEach(([key, value]) => {
      const el = document.getElementById('c-' + key);
      if (el) el.textContent = value;
    });
  } catch (err) {
    console.error('Gagal memuat teks landing page:', err);
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
})();
