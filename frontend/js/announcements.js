// Halaman ini butuh js/auth.js dimuat lebih dulu (pakai getToken, clearToken, API_BASE, escapeHtml, showMsg)

const announcementsRoot = document.getElementById('announcements-root');
const announcementsGuardMsg = document.getElementById('announcements-guard-msg');

let _ancAuthHeaders = null;
let _ancCache = [];

if (announcementsRoot) {
  (async () => {
    const token = getToken();
    if (!token) { window.location.href = '../login/'; return; }

    _ancAuthHeaders = { 'Authorization': 'Bearer ' + token };

    try {
      const meRes = await fetch(API_BASE + '/me', { headers: _ancAuthHeaders });
      if (meRes.status === 401) { clearToken(); window.location.href = '../login/'; return; }
      const me = await meRes.json();

      if (me.role !== 'staff' && me.role !== 'admin') {
        announcementsGuardMsg.style.display = 'block';
        return;
      }

      announcementsRoot.style.display = 'block';

      document.getElementById('anc-form').addEventListener('submit', handleAncSubmit);
      document.getElementById('anc-cancel-btn').addEventListener('click', exitAncEditMode);

      await loadAncList();
    } catch (err) {
      console.error(err);
    }
  })();

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    window.location.href = '../login/';
  });
}

async function loadAncList() {
  const list = document.getElementById('anc-list');
  try {
    const res = await fetch(API_BASE + '/announcements', { headers: _ancAuthHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat pengumuman');

    _ancCache = rows;

    if (rows.length === 0) {
      list.innerHTML = '<p style="color:var(--muted); font-size:14px;">Belum ada pengumuman.</p>';
      return;
    }

    list.innerHTML = rows.map(a => `
      <div class="announcement-item${a.pinned ? ' pinned' : ''}">
        <div class="announcement-head">
          <div class="announcement-title">${escapeHtml(a.title)}</div>
          ${a.pinned ? '<span class="pin-badge">Disematkan</span>' : ''}
        </div>
        <p class="announcement-msg">${escapeHtml(a.message)}</p>
        <div class="announcement-meta">${escapeHtml(a.created_by_name || 'Staff')} &middot; ${escapeHtml(a.created_at)}</div>
        <div style="margin-top:8px;">
          <button type="button" class="row-action edit" data-id="${a.id}">Edit</button>
          <button type="button" class="row-action delete" data-id="${a.id}">Hapus</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.row-action.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = _ancCache.find(a => String(a.id) === btn.dataset.id);
        if (row) enterAncEditMode(row);
      });
    });
    list.querySelectorAll('.row-action.delete').forEach(btn => {
      btn.addEventListener('click', () => handleAncDelete(btn.dataset.id));
    });
  } catch (err) {
    list.innerHTML = '<p style="color:var(--loss); font-size:14px;">Gagal memuat pengumuman.</p>';
  }
}

async function handleAncSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('anc-form-msg');
  const editId = document.getElementById('anc-edit-id').value;
  const body = {
    title: document.getElementById('anc-title').value.trim(),
    message: document.getElementById('anc-message').value.trim(),
    pinned: document.getElementById('anc-pinned').checked
  };
  const isEdit = !!editId;
  const url = isEdit ? `${API_BASE}/announcements/${editId}` : `${API_BASE}/announcements`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ..._ancAuthHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengumuman');
    showMsg(msg, isEdit ? 'Pengumuman diperbarui.' : 'Pengumuman diterbitkan.', 'success');
    exitAncEditMode();
    await loadAncList();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function enterAncEditMode(row) {
  document.getElementById('anc-edit-id').value = row.id;
  document.getElementById('anc-title').value = row.title;
  document.getElementById('anc-message').value = row.message;
  document.getElementById('anc-pinned').checked = !!row.pinned;
  document.getElementById('anc-form-title').textContent = 'Edit Pengumuman';
  document.getElementById('anc-submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('anc-cancel-btn').style.display = 'block';
  document.getElementById('anc-form-msg').textContent = '';
  document.getElementById('anc-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitAncEditMode() {
  document.getElementById('anc-form').reset();
  document.getElementById('anc-edit-id').value = '';
  document.getElementById('anc-form-title').textContent = 'Buat Pengumuman Baru';
  document.getElementById('anc-submit-btn').textContent = 'Terbitkan';
  document.getElementById('anc-cancel-btn').style.display = 'none';
}

async function handleAncDelete(id) {
  if (!confirm('Hapus pengumuman ini?')) return;
  const msg = document.getElementById('anc-form-msg');
  try {
    const res = await fetch(`${API_BASE}/announcements/${id}`, { method: 'DELETE', headers: _ancAuthHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengumuman');
    showMsg(msg, 'Pengumuman dihapus.', 'success');
    if (document.getElementById('anc-edit-id').value == id) exitAncEditMode();
    await loadAncList();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}
