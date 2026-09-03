// Halaman ini butuh js/auth.js dimuat lebih dulu (pakai getToken, clearToken, API_BASE)

const reportsRoot = document.getElementById('reports-root');
const reportsGuardMsg = document.getElementById('reports-guard-msg');

let _reportRows = [];
let _sortKey = 'overall_score';
let _sortDir = 'desc'; // 'asc' | 'desc'

if (reportsRoot) {
  (async () => {
    const token = getToken();
    if (!token) { window.location.href = '../login/'; return; }

    const authHeaders = { 'Authorization': 'Bearer ' + token };

    try {
      const meRes = await fetch(API_BASE + '/me', { headers: authHeaders });
      if (meRes.status === 401) { clearToken(); window.location.href = '../login/'; return; }
      const me = await meRes.json();

      if (me.role !== 'staff' && me.role !== 'admin') {
        reportsGuardMsg.style.display = 'block';
        return;
      }

      reportsRoot.style.display = 'block';

      const res = await fetch(API_BASE + '/reports/all', { headers: authHeaders });
      _reportRows = await res.json();

      setupSortableHeaders();
      renderReportRows();
    } catch (err) {
      console.error(err);
    }
  })();

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    window.location.href = '../login/';
  });
}

function setupSortableHeaders() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (_sortKey === key) {
        _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        _sortKey = key;
        _sortDir = 'desc';
      }
      renderReportRows();
    });
  });
}

function updateSortArrows() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.querySelector('.arrow')?.remove();
    if (th.dataset.sort === _sortKey) {
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = _sortDir === 'desc' ? '▼' : '▲';
      th.appendChild(arrow);
    }
  });
}

function renderReportRows() {
  const tbody = document.getElementById('reports-body');
  updateSortArrows();

  if (_reportRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="color:var(--muted)">Belum ada player terdaftar.</td></tr>';
    return;
  }

  const sorted = [..._reportRows].sort((a, b) => {
    let va = a[_sortKey];
    let vb = b[_sortKey];

    // nilai kosong (null) selalu ditaruh paling bawah, apapun arah sortnya
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;

    if (typeof va === 'string') {
      return _sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return _sortDir === 'asc' ? va - vb : vb - va;
  });

  tbody.innerHTML = sorted.map((r, i) => {
    const rank = i + 1;
    const badgeClass = rank <= 3 && _sortKey === 'overall_score' && _sortDir === 'desc' ? 'rank-badge top' : 'rank-badge';
    return `
      <tr>
        <td><span class="${badgeClass}">${rank}</span></td>
        <td>${escapeHtml(r.full_name)}${r.ign ? ' <span style="color:var(--muted)">(' + escapeHtml(r.ign) + ')</span>' : ''}</td>
        <td>${r.overall_score !== null ? r.overall_score : '-'}</td>
        <td>${r.total_matches > 0 ? r.avg_rating : '-'}</td>
        <td>${r.total_matches}</td>
        <td>${r.wins}-${r.losses}</td>
        <td>${r.total_goals}</td>
        <td>${r.total_assists}</td>
        <td>${r.total_passes}</td>
        <td>${r.attendance_rate !== null ? r.attendance_rate + '%' : '-'}</td>
      </tr>`;
  }).join('');
}
