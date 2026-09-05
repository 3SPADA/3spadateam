// API_BASE sekarang didefinisikan di js/config.js (dimuat sebelum file ini)

function saveToken(token){ localStorage.setItem('3spada_token', token); }
function getToken(){ return localStorage.getItem('3spada_token'); }
function clearToken(){ localStorage.removeItem('3spada_token'); }

// Dipanggil di halaman login/register: kalau di tab/browser ini ternyata
// sudah ada sesi login yang masih aktif, langsung lempar ke dashboard
// tanpa perlu isi form lagi. Kalau token ternyata sudah kedaluwarsa/tidak
// valid, dibersihkan diam-diam dan form login tetap tampil seperti biasa.
async function redirectIfAlreadyLoggedIn() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(API_BASE + '/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) {
      window.location.href = '../dashboard/';
    } else {
      clearToken();
    }
  } catch (err) {
    // Gagal cek (misalnya lagi offline) — biarkan saja, tampilkan form seperti biasa
  }
}

function showMsg(el, text, type){
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

// ---------- REGISTER ----------
const registerForm = document.getElementById('register-form');
if (registerForm) {
  redirectIfAlreadyLoggedIn();

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('register-msg');
    const roleRadio = document.querySelector('input[name="reg-role"]:checked');
    const rankRadio = document.querySelector('input[name="reg-rank"]:checked');
    const typeRadio = document.querySelector('input[name="reg-type"]:checked');
    const usia = document.getElementById('reg-usia').value;
    const body = {
      full_name: document.getElementById('reg-name').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      password: document.getElementById('reg-password').value,
      ign: document.getElementById('reg-ign').value.trim(),
      game_role: roleRadio ? roleRadio.value : '',
      rank: rankRadio ? rankRadio.value : '',
      age: usia ? Number(usia) : null,
      role: typeRadio ? typeRadio.value : 'player'
    };
    try {
      const res = await fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registrasi gagal');
      showMsg(msg, 'Berhasil daftar! Mengalihkan ke login...', 'success');
      setTimeout(() => { window.location.href = '../login/'; }, 1200);
    } catch (err) {
      showMsg(msg, err.message, 'error');
    }
  });
}

// ---------- LOGIN ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
  redirectIfAlreadyLoggedIn();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('login-msg');
    const body = {
      username: document.getElementById('login-username').value.trim(),
      password: document.getElementById('login-password').value
    };
    try {
      const res = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      saveToken(data.token);
      showMsg(msg, 'Berhasil masuk! Mengalihkan...', 'success');
      setTimeout(() => { window.location.href = '../dashboard/'; }, 800);
    } catch (err) {
      showMsg(msg, err.message, 'error');
    }
  });
}

// ---------- DASHBOARD ----------
const dashRoot = document.getElementById('dashboard-root');
if (dashRoot) {
  (async () => {
    const token = getToken();
    if (!token) { window.location.href = '../login/'; return; }

    const authHeaders = { 'Authorization': 'Bearer ' + token };

    try {
      const meRes = await fetch(API_BASE + '/me', { headers: authHeaders });
      if (meRes.status === 401) { clearToken(); window.location.href = '../login/'; return; }
      const me = await meRes.json();

      document.getElementById('dash-name').textContent = me.full_name;
      document.getElementById('dash-role').textContent = (me.game_role || '-') + ' · ' + me.role.toUpperCase();
      _currentRole = me.role;

      // Isi form Edit Profil dengan data saat ini
      document.getElementById('profile-name').value = me.full_name || '';
      document.getElementById('profile-ign').value = me.ign || '';
      document.getElementById('profile-usia').value = me.age || '';

      // Foto profil: input sekarang type=file, tidak diisi lewat .value —
      // cukup tampilkan preview foto yang sudah ada (kalau ada)
      _currentPhotoUrl = me.photo_url || null;
      if (_currentPhotoUrl) {
        const preview = document.getElementById('profile-photo-preview');
        preview.src = _currentPhotoUrl;
        preview.style.display = 'block';
      }
      document.getElementById('profile-photo').addEventListener('change', function () {
        handlePhotoFileChange(this);
      });

      if (me.game_role) {
        const roleInput = document.querySelector(`input[name="profile-role"][value="${me.game_role}"]`);
        if (roleInput) roleInput.checked = true;
      }
      if (me.rank) {
        const rankInput = document.querySelector(`input[name="profile-rank"][value="${me.rank}"]`);
        if (rankInput) rankInput.checked = true;
      }

      document.getElementById('profile-form').addEventListener('submit', (e) => handleProfileSubmit(e, authHeaders));
      document.getElementById('password-form').addEventListener('submit', (e) => handlePasswordSubmit(e, authHeaders));

      if (me.role === 'staff' || me.role === 'admin') {
        const staffLink = document.getElementById('link-staff-stats');
        if (staffLink) staffLink.style.display = 'inline-flex';
        const reportsLink = document.getElementById('link-reports');
        if (reportsLink) reportsLink.style.display = 'inline-flex';
        const announcementsLink = document.getElementById('link-announcements');
        if (announcementsLink) announcementsLink.style.display = 'inline-flex';
      }
      if (me.role === 'admin') {
        const adminLink = document.getElementById('link-admin-panel');
        if (adminLink) adminLink.style.display = 'inline-flex';
      }

      await loadAnnouncements(authHeaders);

      // Absensi hari ini
      const today = new Date().toISOString().slice(0, 10);
      document.getElementById('attendance-date').textContent = today;

      document.getElementById('btn-hadir').addEventListener('click', () => submitAttendance('hadir', today, authHeaders));
      document.getElementById('btn-izin').addEventListener('click', () => submitAttendance('izin', today, authHeaders));

      await loadAttendanceHistory(authHeaders);

      await loadPerformanceReport(authHeaders);

      // Riwayat statistik
      const statsRes = await fetch(API_BASE + '/stats/me', { headers: authHeaders });
      const stats = await statsRes.json();
      const tbody = document.getElementById('stats-body');
      tbody.innerHTML = '';
      if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">Belum ada data statistik.</td></tr>';
      } else {
        stats.forEach(s => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escapeHtml(s.match_date)}</td><td>${escapeHtml(s.opponent)}</td><td>${s.result === 'menang' ? 'Menang' : 'Kalah'}</td><td>${s.goals}</td><td>${s.assists}</td><td>${s.passes}</td><td>${Number(s.rating).toFixed(1)}</td>`;
          tbody.appendChild(tr);
        });
      }
      renderRatingChart(stats);
    } catch (err) {
      console.error(err);
    }
  })();

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    window.location.href = '../login/';
  });
}

async function submitAttendance(status, date, authHeaders) {
  const msg = document.getElementById('attendance-msg');
  try {
    const res = await fetch(API_BASE + '/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ session_date: date, status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal absen');
    showMsg(msg, 'Absen tercatat: ' + status.toUpperCase(), 'success');
    await loadAttendanceHistory(authHeaders);
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

async function loadAttendanceHistory(authHeaders) {
  const tbody = document.getElementById('attendance-body');
  if (!tbody) return;
  try {
    const res = await fetch(API_BASE + '/attendance/me', { headers: authHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat riwayat absen');

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="color:var(--muted)">Belum ada riwayat absen.</td></tr>';
      return;
    }
    const labelMap = { hadir: 'Hadir', izin: 'Izin', alpha: 'Alpha' };
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${escapeHtml(r.session_date)}</td><td>${escapeHtml(labelMap[r.status] || r.status)}</td></tr>`
    ).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--loss)">Gagal memuat data.</td></tr>';
  }
}

let _currentRole = '';
let _currentPhotoUrl = null;

// Batas ukuran file mentah sebelum dikonversi ke base64 (base64 bikin ukurannya
// bengkak ~33%, jadi 1MB file asli jadi ~1.35MB pas dikirim ke server).
const MAX_PHOTO_SIZE = 1 * 1024 * 1024;

function handlePhotoFileChange(input) {
  const file = input.files[0];
  const msg = document.getElementById('profile-photo-msg');
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showMsg(msg, 'File harus berupa gambar (JPG/PNG/dst).', 'error');
    input.value = '';
    return;
  }
  if (file.size > MAX_PHOTO_SIZE) {
    showMsg(msg, 'Ukuran foto maksimal 1 MB. Coba kompres dulu atau pilih foto lain.', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    _currentPhotoUrl = reader.result; // hasilnya string base64 data URL
    const preview = document.getElementById('profile-photo-preview');
    preview.src = _currentPhotoUrl;
    preview.style.display = 'block';
    showMsg(msg, 'Foto siap disimpan — klik "Simpan Profil" untuk menerapkan.', 'success');
  };
  reader.onerror = () => {
    showMsg(msg, 'Gagal membaca file foto.', 'error');
  };
  reader.readAsDataURL(file);
}

async function handleProfileSubmit(e, authHeaders) {
  e.preventDefault();
  const msg = document.getElementById('profile-form-msg');
  const roleRadio = document.querySelector('input[name="profile-role"]:checked');
  const rankRadio = document.querySelector('input[name="profile-rank"]:checked');
  const usia = document.getElementById('profile-usia').value;
  const body = {
    full_name: document.getElementById('profile-name').value.trim(),
    ign: document.getElementById('profile-ign').value.trim(),
    game_role: roleRadio ? roleRadio.value : '',
    rank: rankRadio ? rankRadio.value : '',
    age: usia ? Number(usia) : null,
    photo_url: _currentPhotoUrl
  };
  try {
    const res = await fetch(API_BASE + '/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');
    showMsg(msg, 'Profil tersimpan.', 'success');
    document.getElementById('dash-name').textContent = body.full_name;
    document.getElementById('dash-role').textContent = (body.game_role || '-') + ' · ' + _currentRole.toUpperCase();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

async function handlePasswordSubmit(e, authHeaders) {
  e.preventDefault();
  const msg = document.getElementById('password-form-msg');
  const body = {
    current_password: document.getElementById('pw-current').value,
    new_password: document.getElementById('pw-new').value
  };
  try {
    const res = await fetch(API_BASE + '/me/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengganti password');
    showMsg(msg, 'Password berhasil diganti.', 'success');
    document.getElementById('password-form').reset();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
}

function renderRatingChart(stats) {
  const canvas = document.getElementById('rating-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (stats.length === 0) {
    canvas.style.display = 'none';
    const note = document.createElement('p');
    note.style.cssText = 'color:var(--muted); font-size:14px;';
    note.textContent = 'Belum ada data statistik untuk ditampilkan.';
    canvas.parentElement.appendChild(note);
    return;
  }

  // stats datang urutan terbaru dulu (DESC) — dibalik biar grafik jalan dari kiri (lama) ke kanan (baru)
  const chronological = [...stats].reverse();
  const labels = chronological.map(s => s.match_date + ' vs ' + s.opponent);
  const ratings = chronological.map(s => Number(s.rating));

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rating',
        data: ratings,
        borderColor: '#ff2e4d',
        backgroundColor: 'rgba(255,46,77,0.15)',
        tension: 0.25,
        fill: true,
        pointBackgroundColor: '#ff2e4d',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 10, ticks: { color: '#9a9aa4' }, grid: { color: '#2a2a31' } },
        x: { ticks: { color: '#9a9aa4' }, grid: { display: false } }
      }
    }
  });
}

async function loadPerformanceReport(authHeaders) {
  const overallEl = document.getElementById('rep-overall');
  if (!overallEl) return;
  try {
    const res = await fetch(API_BASE + '/reports/me', { headers: authHeaders });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || 'Gagal memuat laporan');

    document.getElementById('rep-overall').textContent = r.overall_score !== null ? r.overall_score : '-';
    document.getElementById('rep-avg-rating').textContent = r.total_matches > 0 ? r.avg_rating : '-';
    document.getElementById('rep-matches').textContent = r.total_matches;
    document.getElementById('rep-attendance').textContent = r.attendance_rate !== null ? r.attendance_rate + '%' : '-';
    document.getElementById('rep-wl').textContent = r.wins + '-' + r.losses;
    document.getElementById('rep-goals').textContent = r.total_goals;
    document.getElementById('rep-assists').textContent = r.total_assists;
    document.getElementById('rep-passes').textContent = r.total_passes;
  } catch (err) {
    console.error('Gagal memuat laporan performa:', err);
  }
}

async function loadAnnouncements(authHeaders) {
  const list = document.getElementById('announcements-list');
  if (!list) return;
  try {
    const res = await fetch(API_BASE + '/announcements', { headers: authHeaders });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Gagal memuat pengumuman');

    if (rows.length === 0) {
      list.innerHTML = '<p style="color:var(--muted); font-size:14px; margin:0;">Belum ada pengumuman.</p>';
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
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:var(--loss); font-size:14px; margin:0;">Gagal memuat pengumuman.</p>';
  }
}
