// Halaman ini butuh js/auth.js dimuat lebih dulu (pakai getToken, clearToken, API_BASE, showMsg)

const adminRoot = document.getElementById('admin-root');
const adminGuardMsg = document.getElementById('admin-guard-msg');

let _adminAuthHeaders = null;
let _eventsCache = [];
let _matchesCache = [];

if (adminRoot) {
  (async () => {
    const token = getToken();
    if (!token) { window.location.href = '../login/'; return; }

    _adminAuthHeaders = { 'Authorization': 'Bearer ' + token };

    try {
      const meRes = await fetch(API_BASE + '/me', { headers: _adminAuthHeaders });
      if (meRes.status === 401) { clearToken(); window.location.href = '../login/'; return; }
      const me = await meRes.json();

      if (me.role !== 'admin') {
        adminGuardMsg.style.display = 'block';
        return;
      }

      adminRoot.style.display = 'block';

      setupTabs();
      document.getElementById('event-form').addEventListener('submit', handleEventSubmit);
      document.getElementById('event-cancel-btn').addEventListener('click', exitEventEditMode);
      document.getElementById('match-form').addEventListener('submit', handleMatchSubmit);
      document.getElementById('match-cancel-btn').addEventListener('click', exitMatchEditMode);
      document.getElementById('sponsor-form').addEventListener('submit', handleSponsorSubmit);
      document.getElementById('sponsor-cancel-btn').addEventListener('click', exitSponsorEditMode);
      document.getElementById('ach-form').addEventListener('submit', handleAchSubmit);
      document.getElementById('ach-cancel-btn').addEventListener('click', exitAchEditMode);
      document.getElementById('content-form').addEventListener('submit', handleContentSubmit);
      document.getElementById('att-form').addEventListener('submit', handleAttSubmit);
      document.getElementById('att-cancel-btn').addEventListener('click', exitAttEditMode);

      document.getElementById('event-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('match-date').value = new Date().toISOString().slice(0, 10);

      await loadEvents();
      await loadMatches();
      await loadSponsors();
      await loadAchievements();
      await loadContent();
      await loadAccounts(_adminAuthHeaders);
      await loadAttendanceAdmin();
    } catch (err) {
      console.error(err);
    }
  })();

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    window.location.href = '../login/';
  });
}

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab.dataset.panel));
    });
  });
}

// ================= EVENT =================
async function loadEvents() {
  const tbody = document.getElementById('event-body');
  try {
    const res = await fetch(API_BASE + '/events');
    const rows = await res.json();
    _eventsCache = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted)">Belum ada event.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.event_date)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.location || '-')}</td>
        <td>${escapeHtml(r.tag || '-')}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _eventsCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterEventEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleEventDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleEventSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('event-form-msg');
  const editId = document.getElementById('event-edit-id').value;
  const body = {
    event_date: document.getElementById('event-date').value,
    name: document.getElementById('event-name').value.trim(),
    location: document.getElementById('event-location').value.trim(),
    tag: document.getElementById('event-tag').value.trim()
  };
  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/events/${editId}` : `${API_BASE}/events`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan event');
    showMsg(msg, isEdit ? 'Event diperbarui.' : 'Event ditambahkan.', 'success');
    exitEventEditMode();
    await loadEvents();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterEventEditMode(row) {
  document.getElementById('event-edit-id').value = row.id;
  document.getElementById('event-date').value = row.event_date;
  document.getElementById('event-name').value = row.name;
  document.getElementById('event-location').value = row.location || '';
  document.getElementById('event-tag').value = row.tag || '';
  document.getElementById('event-form-title').textContent = 'Edit Event';
  document.getElementById('event-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('event-cancel-btn').style.display = 'block';
  document.getElementById('event-form-msg').textContent = '';
  document.getElementById('event-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEventEditMode() {
  document.getElementById('event-form').reset();
  document.getElementById('event-edit-id').value = '';
  document.getElementById('event-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('event-form-title').textContent = 'Tambah Event Baru';
  document.getElementById('event-submit-btn').textContent = 'Simpan Event';
  document.getElementById('event-cancel-btn').style.display = 'none';
}

async function handleEventDelete(id) {
  if (!confirm('Hapus event ini?')) return;
  const msg = document.getElementById('event-form-msg');
  try {
    const res = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE', headers: _adminAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus event');
    showMsg(msg, 'Event dihapus.', 'success');
    if (document.getElementById('event-edit-id').value == id) exitEventEditMode();
    await loadEvents();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= HASIL PERTANDINGAN =================
async function loadMatches() {
  const tbody = document.getElementById('match-body');
  try {
    const res = await fetch(API_BASE + '/matches');
    const rows = await res.json();
    _matchesCache = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted)">Belum ada hasil pertandingan.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.match_date)}</td>
        <td>${escapeHtml(r.opponent)}</td>
        <td>${escapeHtml(r.score)}</td>
        <td>${r.result === 'menang' ? 'Menang' : 'Kalah'}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _matchesCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterMatchEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleMatchDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleMatchSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('match-form-msg');
  const editId = document.getElementById('match-edit-id').value;
  const body = {
    match_date: document.getElementById('match-date').value,
    opponent: document.getElementById('match-opponent').value.trim(),
    score: document.getElementById('match-score').value.trim(),
    result: document.getElementById('match-result').value
  };
  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/matches/${editId}` : `${API_BASE}/matches`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pertandingan');
    showMsg(msg, isEdit ? 'Hasil pertandingan diperbarui.' : 'Hasil pertandingan ditambahkan.', 'success');
    exitMatchEditMode();
    await loadMatches();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterMatchEditMode(row) {
  document.getElementById('match-edit-id').value = row.id;
  document.getElementById('match-date').value = row.match_date;
  document.getElementById('match-opponent').value = row.opponent;
  document.getElementById('match-score').value = row.score;
  document.getElementById('match-result').value = row.result;
  document.getElementById('match-form-title').textContent = 'Edit Hasil Pertandingan';
  document.getElementById('match-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('match-cancel-btn').style.display = 'block';
  document.getElementById('match-form-msg').textContent = '';
  document.getElementById('match-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitMatchEditMode() {
  document.getElementById('match-form').reset();
  document.getElementById('match-edit-id').value = '';
  document.getElementById('match-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('match-form-title').textContent = 'Tambah Hasil Pertandingan';
  document.getElementById('match-submit-btn').textContent = 'Simpan Hasil';
  document.getElementById('match-cancel-btn').style.display = 'none';
}

async function handleMatchDelete(id) {
  if (!confirm('Hapus hasil pertandingan ini?')) return;
  const msg = document.getElementById('match-form-msg');
  try {
    const res = await fetch(`${API_BASE}/matches/${id}`, { method: 'DELETE', headers: _adminAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus data');
    showMsg(msg, 'Hasil pertandingan dihapus.', 'success');
    if (document.getElementById('match-edit-id').value == id) exitMatchEditMode();
    await loadMatches();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= SPONSOR =================
let _sponsorsCache = [];

async function loadSponsors() {
  const tbody = document.getElementById('sponsor-body');
  try {
    const res = await fetch(API_BASE + '/sponsors');
    const rows = await res.json();
    _sponsorsCache = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">Belum ada sponsor.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.kind || '-')}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _sponsorsCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterSponsorEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleSponsorDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleSponsorSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('sponsor-form-msg');
  const editId = document.getElementById('sponsor-edit-id').value;
  const body = {
    name: document.getElementById('sponsor-name').value.trim(),
    kind: document.getElementById('sponsor-kind').value.trim()
  };
  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/sponsors/${editId}` : `${API_BASE}/sponsors`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan sponsor');
    showMsg(msg, isEdit ? 'Sponsor diperbarui.' : 'Sponsor ditambahkan.', 'success');
    exitSponsorEditMode();
    await loadSponsors();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterSponsorEditMode(row) {
  document.getElementById('sponsor-edit-id').value = row.id;
  document.getElementById('sponsor-name').value = row.name;
  document.getElementById('sponsor-kind').value = row.kind || '';
  document.getElementById('sponsor-form-title').textContent = 'Edit Sponsor';
  document.getElementById('sponsor-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('sponsor-cancel-btn').style.display = 'block';
  document.getElementById('sponsor-form-msg').textContent = '';
  document.getElementById('sponsor-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitSponsorEditMode() {
  document.getElementById('sponsor-form').reset();
  document.getElementById('sponsor-edit-id').value = '';
  document.getElementById('sponsor-form-title').textContent = 'Tambah Sponsor Baru';
  document.getElementById('sponsor-submit-btn').textContent = 'Simpan Sponsor';
  document.getElementById('sponsor-cancel-btn').style.display = 'none';
}

async function handleSponsorDelete(id) {
  if (!confirm('Hapus sponsor ini?')) return;
  const msg = document.getElementById('sponsor-form-msg');
  try {
    const res = await fetch(`${API_BASE}/sponsors/${id}`, { method: 'DELETE', headers: _adminAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus sponsor');
    showMsg(msg, 'Sponsor dihapus.', 'success');
    if (document.getElementById('sponsor-edit-id').value == id) exitSponsorEditMode();
    await loadSponsors();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= TEKS HALAMAN =================
const CONTENT_KEYS = [
  'hero_eyebrow', 'hero_title_line1', 'hero_title_line2', 'hero_title_accent', 'hero_tagline',
  'stat_founded', 'stat_members', 'stat_tournaments', 'stat_record',
  'intro_title', 'intro_paragraph_1', 'intro_paragraph_2', 'philosophy_text',
  'team_title', 'team_subtitle',
  'community_title', 'community_subtitle',
  'about_eyebrow', 'about_paragraph_1', 'about_paragraph_2',
  'vision_text', 'mission_text', 'values_text',
  'timeline_2023_title', 'timeline_2023_desc',
  'timeline_2024_title', 'timeline_2024_desc',
  'timeline_2025_title', 'timeline_2025_desc',
  'timeline_2026_title', 'timeline_2026_desc',
  'contact_intro', 'contact_instagram_url', 'contact_tiktok_url', 'contact_discord_url', 'contact_email_url'
];

async function loadContent() {
  try {
    const res = await fetch(API_BASE + '/content');
    const content = await res.json();
    CONTENT_KEYS.forEach(key => {
      const el = document.getElementById('cf-' + key);
      if (el && content[key] !== undefined) el.value = content[key];
    });
  } catch (err) {
    console.error('Gagal memuat teks landing page:', err);
  }
}

async function handleContentSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('content-form-msg');
  const body = {};
  CONTENT_KEYS.forEach(key => {
    const el = document.getElementById('cf-' + key);
    if (el) body[key] = el.value;
  });

  try {
    const res = await fetch(API_BASE + '/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perubahan');
    showMsg(msg, 'Teks tersimpan. Cek halaman Home/Team/About Us untuk lihat hasilnya.', 'success');
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= KELOLA AKUN =================
async function loadAccounts(authHeaders) {
  const tbody = document.getElementById('accounts-body');
  try {
    const res = await fetch(API_BASE + '/admin/users', { headers: authHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat data akun');

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">Belum ada akun player/staff.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.username)}</td>
        <td>
          <select class="role-select" data-id="${r.id}" data-name="${escapeHtml(r.full_name)}" style="background:var(--ink); border:1px solid var(--line); color:var(--paper); padding:6px 10px; font-family:'IBM Plex Sans', sans-serif; font-size:13px;">
            <option value="community" ${r.role === 'community' ? 'selected' : ''}>Komunitas</option>
            <option value="player" ${r.role === 'player' ? 'selected' : ''}>Player</option>
            <option value="staff" ${r.role === 'staff' ? 'selected' : ''}>Staff</option>
          </select>
        </td>
        <td>${escapeHtml(r.game_role || '-')}</td>
        <td>${escapeHtml(r.rank || '-')}</td>
        <td>${r.age || '-'}</td>
        <td><button type="button" class="row-action delete" data-id="${r.id}" data-name="${escapeHtml(r.full_name)}">Hapus</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.role-select').forEach(select => {
      select.dataset.previousValue = select.value;
      select.addEventListener('change', () => handleRoleChange(select, authHeaders));
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleAccountDelete(btn.dataset.id, btn.dataset.name, authHeaders));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleRoleChange(select, authHeaders) {
  const { id, name } = select.dataset;
  const newRole = select.value;
  const roleLabel = { community: 'Komunitas', player: 'Player', staff: 'Staff' };
  const msg = document.getElementById('accounts-msg');

  if (!confirm(`Ubah status "${name}" jadi ${roleLabel[newRole]}?`)) {
    select.value = select.dataset.previousValue;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users/${id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengubah status akun');
    showMsg(msg, `Status "${name}" diubah jadi ${roleLabel[newRole]}.`, 'success');
    select.dataset.previousValue = newRole;
  } catch (err) {
    showMsg(msg, err.message, 'error');
    select.value = select.dataset.previousValue;
  }
}

async function handleAccountDelete(id, name, authHeaders) {
  if (!confirm(`Hapus akun "${name}"? Data absen dan statistik pertandingannya ikut terhapus. Tidak bisa dibatalkan.`)) return;
  const msg = document.getElementById('accounts-msg');
  try {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun');
    showMsg(msg, `Akun "${name}" dihapus.`, 'success');
    await loadAccounts(authHeaders);
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= KELOLA ABSENSI =================
let _attCache = [];
let _attMembersLoaded = false;

async function loadAttMembersDropdown() {
  if (_attMembersLoaded) return;
  try {
    const [rosterRes, communityRes] = await Promise.all([
      fetch(API_BASE + '/roster'),
      fetch(API_BASE + '/community-roster')
    ]);
    const roster = await rosterRes.json();
    const community = (await communityRes.json()).map(c => ({ ...c, role: 'community' }));
    const members = [...roster, ...community];
    const select = document.getElementById('att-user');
    select.innerHTML = members.map(m =>
      `<option value="${m.id}">${escapeHtml(m.full_name)}${m.role === 'community' ? ' (Komunitas)' : ''}</option>`
    ).join('');
    _attMembersLoaded = true;
  } catch (err) {
    console.error('Gagal memuat daftar anggota buat absensi:', err);
  }
}

async function loadAttendanceAdmin() {
  await loadAttMembersDropdown();
  document.getElementById('att-date').value = new Date().toISOString().slice(0, 10);

  const tbody = document.getElementById('att-body');
  try {
    const res = await fetch(API_BASE + '/attendance/all', { headers: _adminAuthHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat data absensi');

    _attCache = rows;
    const labelMap = { hadir: 'Hadir', izin: 'Izin', alpha: 'Alpha' };
    const roleLabelMap = { player: 'Player', staff: 'Staff', admin: 'Admin', community: 'Komunitas' };

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted)">Belum ada data absensi.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.session_date)}</td>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${labelMap[r.status] || escapeHtml(r.status)}</td>
        <td>${roleLabelMap[r.role] || escapeHtml(r.role)}</td>
        <td>${escapeHtml(r.note || '-')}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _attCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterAttEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleAttDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleAttSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('att-form-msg');
  const editId = document.getElementById('att-edit-id').value;
  const isEdit = !!editId;

  const body = isEdit
    ? {
        session_date: document.getElementById('att-date').value,
        status: document.getElementById('att-status').value,
        note: document.getElementById('att-note').value.trim()
      }
    : {
        user_id: Number(document.getElementById('att-user').value),
        session_date: document.getElementById('att-date').value,
        status: document.getElementById('att-status').value,
        note: document.getElementById('att-note').value.trim()
      };

  const url = isEdit ? `${API_BASE}/admin/attendance/${editId}` : `${API_BASE}/admin/attendance`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan absensi');
    showMsg(msg, isEdit ? 'Absensi diperbarui.' : 'Absensi tersimpan.', 'success');
    exitAttEditMode();
    await loadAttendanceAdmin();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterAttEditMode(row) {
  document.getElementById('att-edit-id').value = row.id;
  document.getElementById('att-user').value = row.user_id;
  document.getElementById('att-user').disabled = true;
  document.getElementById('att-date').value = row.session_date;
  document.getElementById('att-status').value = row.status;
  document.getElementById('att-note').value = row.note || '';
  document.getElementById('att-form-title').textContent = 'Edit Absen';
  document.getElementById('att-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('att-cancel-btn').style.display = 'block';
  document.getElementById('att-form-msg').textContent = '';
  document.getElementById('att-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitAttEditMode() {
  document.getElementById('att-form').reset();
  document.getElementById('att-edit-id').value = '';
  document.getElementById('att-user').disabled = false;
  document.getElementById('att-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('att-form-title').textContent = 'Tambah/Koreksi Absen';
  document.getElementById('att-submit-btn').textContent = 'Simpan Absen';
  document.getElementById('att-cancel-btn').style.display = 'none';
}

async function handleAttDelete(id) {
  if (!confirm('Hapus data absen ini?')) return;
  const msg = document.getElementById('att-form-msg');
  try {
    const res = await fetch(`${API_BASE}/admin/attendance/${id}`, { method: 'DELETE', headers: _adminAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus absensi');
    showMsg(msg, 'Absensi dihapus.', 'success');
    if (document.getElementById('att-edit-id').value == id) exitAttEditMode();
    await loadAttendanceAdmin();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

// ================= ACHIEVEMENT =================
let _achievementsCache = [];

async function loadAchievements() {
  const tbody = document.getElementById('ach-body');
  try {
    const res = await fetch(API_BASE + '/achievements');
    const rows = await res.json();
    _achievementsCache = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">Belum ada achievement.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.year || '-')}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.description || '-')}</td>
        <td>
          <button type="button" class="row-action edit" data-id="${r.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _achievementsCache.find(r => String(r.id) === btn.dataset.id);
        if (row) enterAchEditMode(row);
      });
    });
    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleAchDelete(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

async function handleAchSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('ach-form-msg');
  const editId = document.getElementById('ach-edit-id').value;
  const body = {
    title: document.getElementById('ach-title').value.trim(),
    year: document.getElementById('ach-year').value.trim(),
    description: document.getElementById('ach-desc').value.trim()
  };
  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/achievements/${editId}` : `${API_BASE}/achievements`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._adminAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan achievement');
    showMsg(msg, isEdit ? 'Achievement diperbarui.' : 'Achievement ditambahkan.', 'success');
    exitAchEditMode();
    await loadAchievements();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterAchEditMode(row) {
  document.getElementById('ach-edit-id').value = row.id;
  document.getElementById('ach-title').value = row.title;
  document.getElementById('ach-year').value = row.year || '';
  document.getElementById('ach-desc').value = row.description || '';
  document.getElementById('ach-form-title').textContent = 'Edit Achievement';
  document.getElementById('ach-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('ach-cancel-btn').style.display = 'block';
  document.getElementById('ach-form-msg').textContent = '';
  document.getElementById('ach-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitAchEditMode() {
  document.getElementById('ach-form').reset();
  document.getElementById('ach-edit-id').value = '';
  document.getElementById('ach-form-title').textContent = 'Tambah Achievement Baru';
  document.getElementById('ach-submit-btn').textContent = 'Simpan Achievement';
  document.getElementById('ach-cancel-btn').style.display = 'none';
}

async function handleAchDelete(id) {
  if (!confirm('Hapus achievement ini?')) return;
  const msg = document.getElementById('ach-form-msg');
  try {
    const res = await fetch(`${API_BASE}/achievements/${id}`, { method: 'DELETE', headers: _adminAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus achievement');
    showMsg(msg, 'Achievement dihapus.', 'success');
    if (document.getElementById('ach-edit-id').value == id) exitAchEditMode();
    await loadAchievements();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}
