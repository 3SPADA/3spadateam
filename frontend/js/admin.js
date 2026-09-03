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
      document.getElementById('content-form').addEventListener('submit', handleContentSubmit);

      document.getElementById('event-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('match-date').value = new Date().toISOString().slice(0, 10);

      await loadEvents();
      await loadMatches();
      await loadSponsors();
      await loadContent();
      await loadAccounts(_adminAuthHeaders);
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
        <td>${r.role === 'staff' ? 'Staff' : 'Player'}</td>
        <td>${escapeHtml(r.game_role || '-')}</td>
        <td>${escapeHtml(r.rank || '-')}</td>
        <td>${r.age || '-'}</td>
        <td><button type="button" class="row-action delete" data-id="${r.id}" data-name="${escapeHtml(r.full_name)}">Hapus</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleAccountDelete(btn.dataset.id, btn.dataset.name, authHeaders));
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--loss)">Gagal memuat data.</td></tr>';
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
