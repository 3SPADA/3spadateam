// Halaman ini butuh js/auth.js dimuat lebih dulu (pakai getToken, clearToken, API_BASE, showMsg)

const staffRoot = document.getElementById('staff-input-root');
const guardMsg = document.getElementById('staff-guard-msg');

let _authHeaders = null;
let _statsCache = [];

if (staffRoot) {
  (async () => {
    const token = getToken();
    if (!token) { window.location.href = '../login/'; return; }

    _authHeaders = { 'Authorization': 'Bearer ' + token };

    try {
      const meRes = await fetch(API_BASE + '/me', { headers: _authHeaders });
      if (meRes.status === 401) { clearToken(); window.location.href = '../login/'; return; }
      const me = await meRes.json();

      if (me.role !== 'staff' && me.role !== 'admin') {
        guardMsg.style.display = 'block';
        return;
      }

      staffRoot.style.display = 'block';

      const rosterRes = await fetch(API_BASE + '/roster');
      const roster = await rosterRes.json();
      const players = roster.filter(r => r.role === 'player');
      const select = document.getElementById('stat-player');
      select.innerHTML = players.map(p =>
        `<option value="${p.id}">${escapeHtml(p.full_name)}${p.ign ? ' — ' + escapeHtml(p.ign) : ''}</option>`
      ).join('');

      document.getElementById('stat-date').value = new Date().toISOString().slice(0, 10);

      await loadAllStats();

      document.getElementById('stats-form').addEventListener('submit', handleFormSubmit);
      document.getElementById('stats-cancel-btn').addEventListener('click', exitEditMode);
    } catch (err) {
      console.error(err);
    }
  })();

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    window.location.href = '../login/';
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('stats-form-msg');
  const editId = document.getElementById('stat-edit-id').value;
  const select = document.getElementById('stat-player');

  const body = {
    user_id: Number(select.value),
    match_date: document.getElementById('stat-date').value,
    opponent: document.getElementById('stat-opponent').value.trim(),
    result: document.getElementById('stat-result').value,
    goals: Number(document.getElementById('stat-goals').value) || 0,
    assists: Number(document.getElementById('stat-assists').value) || 0,
    passes: Number(document.getElementById('stat-passes').value) || 0
  };

  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/stats/${editId}` : `${API_BASE}/stats`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._authHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan statistik');

    const ratingMsg = data.rating !== undefined ? ` (rating: ${data.rating})` : '';
    showMsg(msg, (isEdit ? 'Statistik diperbarui.' : 'Statistik tersimpan.') + ratingMsg, 'success');
    exitEditMode();
    await loadAllStats();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterEditMode(row) {
  document.getElementById('stat-edit-id').value = row.id;
  document.getElementById('stat-player').value = row.user_id;
  document.getElementById('stat-date').value = row.match_date;
  document.getElementById('stat-opponent').value = row.opponent;
  document.getElementById('stat-result').value = row.result;
  document.getElementById('stat-goals').value = row.goals;
  document.getElementById('stat-assists').value = row.assists;
  document.getElementById('stat-passes').value = row.passes;

  document.getElementById('form-mode-title').textContent = 'Edit Statistik';
  document.getElementById('stats-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('stats-cancel-btn').style.display = 'block';
  document.getElementById('stats-form-msg').textContent = '';
  document.getElementById('stats-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  document.getElementById('stats-form').reset();
  document.getElementById('stat-edit-id').value = '';
  document.getElementById('stat-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('form-mode-title').textContent = 'Tambah Statistik Baru';
  document.getElementById('stats-submit-btn').textContent = 'Simpan Statistik';
  document.getElementById('stats-cancel-btn').style.display = 'none';
}

async function handleDelete(id) {
  if (!confirm('Hapus data statistik ini? Tidak bisa dibatalkan.')) return;
  const msg = document.getElementById('stats-form-msg');
  try {
    const res = await fetch(`${API_BASE}/stats/${id}`, {
      method: 'DELETE',
      headers: _authHeaders
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus statistik');
    showMsg(msg, 'Statistik dihapus.', 'success');
    if (document.getElementById('stat-edit-id').value == id) exitEditMode();
    await loadAllStats();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

async function loadAllStats() {
  const tbody = document.getElementById('stats-all-body');
  try {
    const res = await fetch(API_BASE + '/stats/all', { headers: _authHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat data');

    _statsCache = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="color:var(--muted)">Belum ada data.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.match_date)}</td>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.opponent)}</td>
        <td>${r.result === 'menang' ? 'Menang' : 'Kalah'}</td>
        <td>${r.goals}</td>
        <td>${r.assists}</td>
        <td>${r.passes}</td>
        <td>${Number(r.rating).toFixed(1)}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _statsCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}
