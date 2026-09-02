require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-secret-ini-di-file-.env';

// CORS_ORIGIN bisa diisi satu atau beberapa domain dipisah koma, contoh:
// CORS_ORIGIN=https://3spadateam.github.io,http://localhost:5500
// Kalau kosong (belum diset), semua origin diizinkan dulu supaya gampang waktu setup awal.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true
}));
app.use(express.json());

// Health check sederhana, dipakai Railway untuk cek servicenya hidup
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: '3spada-backend' });
});

// ---------- MIDDLEWARE AUTH ----------
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Belum login' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang' });
  }
}

function staffOnly(req, res, next) {
  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya staf/coach yang boleh melakukan ini' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya admin yang boleh melakukan ini' });
  }
  next();
}

// ---------- REGISTER ----------
app.post('/api/register', (req, res) => {
  const { username, password, full_name, ign, game_role, role } = req.body || {};

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username sudah dipakai' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const finalRole = role === 'staff' ? 'staff' : 'player';

  const info = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, game_role, ign)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, password_hash, full_name, finalRole, game_role || null, ign || null);

  res.status(201).json({ id: info.lastInsertRowid, message: 'Registrasi berhasil' });
});

// ---------- LOGIN ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

// ---------- PROFIL SENDIRI ----------
app.get('/api/me', authRequired, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, full_name, role, game_role, ign, photo_url, joined_at
    FROM users WHERE id = ?
  `).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json(user);
});

// Player/staff mengubah profil sendiri (nama, IGN, role di game, foto).
// Username dan role TIDAK bisa diubah lewat sini — role cuma lewat /api/admin/promote.
app.put('/api/me', authRequired, (req, res) => {
  const { full_name, ign, game_role, photo_url } = req.body || {};
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Nama lengkap wajib diisi' });
  }
  db.prepare(`
    UPDATE users SET full_name = ?, ign = ?, game_role = ?, photo_url = ? WHERE id = ?
  `).run(full_name.trim(), ign || null, game_role || null, photo_url || null, req.user.id);
  res.json({ message: 'Profil diperbarui' });
});

// Ganti password sendiri, wajib konfirmasi password lama dulu.
app.put('/api/me/password', authRequired, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Password lama dan password baru wajib diisi' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Password lama salah' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Password berhasil diganti' });
});

// ---------- ROSTER PUBLIK (untuk halaman Team) ----------
app.get('/api/roster', (req, res) => {
  const rows = db.prepare(`
    SELECT id, full_name, role, game_role, ign, photo_url
    FROM users ORDER BY role DESC, full_name ASC
  `).all();
  res.json(rows);
});

// ---------- ABSENSI ----------
// Player mencatat absen sendiri untuk hari ini
app.post('/api/attendance', authRequired, (req, res) => {
  const { session_date, status, note } = req.body || {};
  if (!session_date || !status) {
    return res.status(400).json({ error: 'Tanggal dan status wajib diisi' });
  }
  if (!['hadir', 'izin', 'alpha'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  db.prepare(`
    INSERT INTO attendance (user_id, session_date, status, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, session_date) DO UPDATE SET status = excluded.status, note = excluded.note
  `).run(req.user.id, session_date, status, note || null);

  res.json({ message: 'Absensi tersimpan' });
});

// Riwayat absen milik sendiri
app.get('/api/attendance/me', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT session_date, status, note FROM attendance
    WHERE user_id = ? ORDER BY session_date DESC LIMIT 30
  `).all(req.user.id);
  res.json(rows);
});

// Staf melihat rekap absen semua anggota
app.get('/api/attendance/all', authRequired, staffOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT a.session_date, a.status, a.note, u.full_name, u.username
    FROM attendance a JOIN users u ON u.id = a.user_id
    ORDER BY a.session_date DESC LIMIT 200
  `).all();
  res.json(rows);
});

// ---------- STATISTIK PERTANDINGAN ----------
// Player melihat statistik miliknya sendiri
app.get('/api/stats/me', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT match_date, opponent, result, goals, assists, passes, rating
    FROM match_stats WHERE user_id = ? ORDER BY match_date DESC
  `).all(req.user.id);
  res.json(rows);
});

// Staf melihat semua statistik yang sudah pernah diinput (untuk halaman input)
app.get('/api/stats/all', authRequired, staffOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT ms.id, ms.user_id, ms.match_date, ms.opponent, ms.result, ms.goals, ms.assists, ms.passes, ms.rating,
           u.full_name, u.ign
    FROM match_stats ms JOIN users u ON u.id = ms.user_id
    ORDER BY ms.match_date DESC, ms.id DESC LIMIT 100
  `).all();
  res.json(rows);
});

// Menghitung rating pertandingan otomatis dari performa (goal, assist, umpan, menang/kalah).
// Skala 0-10, dibulatkan 1 desimal. Formula bisa disesuaikan kalau nanti mau diubah bobotnya.
function calculateMatchRating({ goals = 0, assists = 0, passes = 0, result }) {
  let rating = 6.0; // rating dasar untuk performa rata-rata
  rating += goals * 0.6;
  rating += assists * 0.4;
  rating += passes * 0.02;
  rating += result === 'menang' ? 0.3 : -0.2;
  rating = Math.max(0, Math.min(10, rating));
  return Math.round(rating * 10) / 10;
}

// Staf/coach menambahkan statistik untuk seorang player setelah match.
// Rating TIDAK diinput manual — dihitung otomatis oleh sistem dari goal/assist/umpan/hasil.
app.post('/api/stats', authRequired, staffOnly, (req, res) => {
  const { user_id, match_date, opponent, result, goals, assists, passes } = req.body || {};
  if (!user_id || !match_date || !opponent || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }

  const g = goals || 0, a = assists || 0, p = passes || 0;
  const rating = calculateMatchRating({ goals: g, assists: a, passes: p, result });

  const info = db.prepare(`
    INSERT INTO match_stats (user_id, match_date, opponent, result, goals, assists, passes, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, match_date, opponent, result, g, a, p, rating);

  res.status(201).json({ id: info.lastInsertRowid, rating, message: 'Statistik tersimpan, rating dihitung otomatis' });
});

// Staf mengedit statistik yang sudah pernah diinput (misal salah ketik goal/assist).
// Rating dihitung ULANG otomatis berdasarkan angka yang baru.
app.put('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const { user_id, match_date, opponent, result, goals, assists, passes } = req.body || {};

  const existing = db.prepare('SELECT id FROM match_stats WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Data statistik tidak ditemukan' });

  if (!user_id || !match_date || !opponent || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }

  const g = goals || 0, a = assists || 0, p = passes || 0;
  const rating = calculateMatchRating({ goals: g, assists: a, passes: p, result });

  db.prepare(`
    UPDATE match_stats
    SET user_id = ?, match_date = ?, opponent = ?, result = ?, goals = ?, assists = ?, passes = ?, rating = ?
    WHERE id = ?
  `).run(user_id, match_date, opponent, result, g, a, p, rating, id);

  res.json({ message: 'Statistik diperbarui, rating dihitung ulang', rating });
});

// Staf menghapus statistik yang salah input
app.delete('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM match_stats WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Data statistik tidak ditemukan' });
  res.json({ message: 'Statistik dihapus' });
});

// ---------- LAPORAN PERFORMA (gabungan statistik pertandingan + kedisiplinan latihan) ----------
function buildPerformanceReport(userId) {
  const matchAgg = db.prepare(`
    SELECT
      COUNT(*) AS total_matches,
      COALESCE(SUM(goals), 0) AS total_goals,
      COALESCE(SUM(assists), 0) AS total_assists,
      COALESCE(SUM(passes), 0) AS total_passes,
      COALESCE(AVG(rating), 0) AS avg_rating,
      COALESCE(SUM(CASE WHEN result = 'menang' THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN result = 'kalah' THEN 1 ELSE 0 END), 0) AS losses
    FROM match_stats WHERE user_id = ?
  `).get(userId);

  const attendanceAgg = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
      COALESCE(SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
      COALESCE(SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END), 0) AS alpha,
      COUNT(*) AS total_sesi
    FROM attendance WHERE user_id = ?
  `).get(userId);

  const attendanceRate = attendanceAgg.total_sesi > 0
    ? Math.round((attendanceAgg.hadir / attendanceAgg.total_sesi) * 1000) / 10
    : null;

  // Skor keseluruhan: 70% dari rata-rata rating pertandingan, 30% dari persentase kehadiran latihan.
  // Kalau belum ada data pertandingan/absen sama sekali, skor keseluruhan tidak dihitung (null).
  let overallScore = null;
  if (matchAgg.total_matches > 0 || attendanceRate !== null) {
    const ratingPart = matchAgg.total_matches > 0 ? matchAgg.avg_rating : 0;
    const attendancePart = attendanceRate !== null ? attendanceRate / 10 : 0;
    const ratingWeight = matchAgg.total_matches > 0 ? 0.7 : 0;
    const attendanceWeight = attendanceRate !== null ? (matchAgg.total_matches > 0 ? 0.3 : 1) : 0;
    overallScore = Math.round((ratingPart * ratingWeight + attendancePart * attendanceWeight) * 10) / 10;
  }

  return {
    total_matches: matchAgg.total_matches,
    wins: matchAgg.wins,
    losses: matchAgg.losses,
    total_goals: matchAgg.total_goals,
    total_assists: matchAgg.total_assists,
    total_passes: matchAgg.total_passes,
    avg_rating: Math.round(matchAgg.avg_rating * 10) / 10,
    attendance_hadir: attendanceAgg.hadir,
    attendance_izin: attendanceAgg.izin,
    attendance_alpha: attendanceAgg.alpha,
    attendance_total_sesi: attendanceAgg.total_sesi,
    attendance_rate: attendanceRate,
    overall_score: overallScore
  };
}

// Player/staff melihat laporan performa diri sendiri
app.get('/api/reports/me', authRequired, (req, res) => {
  res.json(buildPerformanceReport(req.user.id));
});

// Staf/admin melihat laporan performa SEMUA player (buat evaluasi tim)
app.get('/api/reports/all', authRequired, staffOnly, (req, res) => {
  const players = db.prepare(`
    SELECT id, full_name, ign, game_role FROM users WHERE role = 'player' ORDER BY full_name ASC
  `).all();

  const report = players.map(p => ({
    user_id: p.id,
    full_name: p.full_name,
    ign: p.ign,
    game_role: p.game_role,
    ...buildPerformanceReport(p.id)
  }));

  // Urutkan dari skor keseluruhan tertinggi (yang belum punya data taruh di bawah)
  report.sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));

  res.json(report);
});

// Leaderboard publik top 10 (buat sidebar "Top Arrancar" di landing page) — tanpa perlu login.
// Cuma field yang aman ditampilkan ke publik (bukan data absen detail).
app.get('/api/reports/top10', (req, res) => {
  const players = db.prepare(`SELECT id, full_name, ign, game_role FROM users WHERE role = 'player'`).all();

  const report = players.map(p => ({
    full_name: p.full_name,
    ign: p.ign,
    game_role: p.game_role,
    ...buildPerformanceReport(p.id)
  }));

  report.sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));

  const top10 = report.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    full_name: r.full_name,
    ign: r.ign,
    game_role: r.game_role,
    overall_score: r.overall_score,
    avg_rating: r.total_matches > 0 ? r.avg_rating : null,
    total_matches: r.total_matches
  }));

  res.json(top10);
});

// ---------- EVENT (agenda di landing page) ----------
app.get('/api/events', (req, res) => {
  const rows = db.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
  res.json(rows);
});

app.post('/api/events', authRequired, adminOnly, (req, res) => {
  const { event_date, name, location, tag } = req.body || {};
  if (!event_date || !name) return res.status(400).json({ error: 'Tanggal dan nama event wajib diisi' });
  const info = db.prepare(`
    INSERT INTO events (event_date, name, location, tag) VALUES (?, ?, ?, ?)
  `).run(event_date, name, location || null, tag || null);
  res.status(201).json({ id: info.lastInsertRowid, message: 'Event ditambahkan' });
});

app.put('/api/events/:id', authRequired, adminOnly, (req, res) => {
  const { id } = req.params;
  const { event_date, name, location, tag } = req.body || {};
  const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Event tidak ditemukan' });
  if (!event_date || !name) return res.status(400).json({ error: 'Tanggal dan nama event wajib diisi' });
  db.prepare(`
    UPDATE events SET event_date = ?, name = ?, location = ?, tag = ? WHERE id = ?
  `).run(event_date, name, location || null, tag || null, id);
  res.json({ message: 'Event diperbarui' });
});

app.delete('/api/events/:id', authRequired, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Event tidak ditemukan' });
  res.json({ message: 'Event dihapus' });
});

// ---------- HASIL PERTANDINGAN TIM (landing page) ----------
app.get('/api/matches', (req, res) => {
  const rows = db.prepare('SELECT * FROM team_matches ORDER BY match_date DESC').all();
  res.json(rows);
});

app.post('/api/matches', authRequired, adminOnly, (req, res) => {
  const { match_date, opponent, score, result } = req.body || {};
  if (!match_date || !opponent || !score || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }
  const info = db.prepare(`
    INSERT INTO team_matches (match_date, opponent, score, result) VALUES (?, ?, ?, ?)
  `).run(match_date, opponent, score, result);
  res.status(201).json({ id: info.lastInsertRowid, message: 'Hasil pertandingan ditambahkan' });
});

app.put('/api/matches/:id', authRequired, adminOnly, (req, res) => {
  const { id } = req.params;
  const { match_date, opponent, score, result } = req.body || {};
  const existing = db.prepare('SELECT id FROM team_matches WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Data pertandingan tidak ditemukan' });
  if (!match_date || !opponent || !score || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }
  db.prepare(`
    UPDATE team_matches SET match_date = ?, opponent = ?, score = ?, result = ? WHERE id = ?
  `).run(match_date, opponent, score, result, id);
  res.json({ message: 'Hasil pertandingan diperbarui' });
});

app.delete('/api/matches/:id', authRequired, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM team_matches WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Data pertandingan tidak ditemukan' });
  res.json({ message: 'Hasil pertandingan dihapus' });
});

// ---------- SPONSOR (landing page) ----------
app.get('/api/sponsors', (req, res) => {
  const rows = db.prepare('SELECT * FROM sponsors ORDER BY id ASC').all();
  res.json(rows);
});

app.post('/api/sponsors', authRequired, adminOnly, (req, res) => {
  const { name, kind } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nama sponsor wajib diisi' });
  const info = db.prepare('INSERT INTO sponsors (name, kind) VALUES (?, ?)').run(name, kind || null);
  res.status(201).json({ id: info.lastInsertRowid, message: 'Sponsor ditambahkan' });
});

app.put('/api/sponsors/:id', authRequired, adminOnly, (req, res) => {
  const { id } = req.params;
  const { name, kind } = req.body || {};
  const existing = db.prepare('SELECT id FROM sponsors WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Sponsor tidak ditemukan' });
  if (!name) return res.status(400).json({ error: 'Nama sponsor wajib diisi' });
  db.prepare('UPDATE sponsors SET name = ?, kind = ? WHERE id = ?').run(name, kind || null, id);
  res.json({ message: 'Sponsor diperbarui' });
});

app.delete('/api/sponsors/:id', authRequired, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM sponsors WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Sponsor tidak ditemukan' });
  res.json({ message: 'Sponsor dihapus' });
});

// ---------- TEKS HALAMAN (home, team, about) ----------
app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_content').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

// Body: objek key-value, contoh { hero_tagline: "...", stat_members: "9" }
// Cuma key yang sudah ada di database yang akan diupdate (tidak bisa bikin key baru sembarangan).
app.put('/api/content', authRequired, adminOnly, (req, res) => {
  const updates = req.body || {};
  const existingKeys = db.prepare('SELECT key FROM site_content').all().map(r => r.key);
  const stmt = db.prepare('UPDATE site_content SET value = ? WHERE key = ?');

  const applied = [];
  for (const [key, value] of Object.entries(updates)) {
    if (existingKeys.includes(key)) {
      stmt.run(String(value), key);
      applied.push(key);
    }
  }
  res.json({ message: 'Teks landing page diperbarui', updated: applied });
});

// ---------- SETUP AWAL: promosikan akun jadi admin ----------
// Dipakai SEKALI di awal untuk bikin akun admin pertama, lewat request manual (curl/Postman),
// bukan lewat UI, supaya orang lain tidak bisa sembarangan jadi admin.
// Wajib set ADMIN_SETUP_SECRET di environment variable dulu.
app.post('/api/admin/promote', (req, res) => {
  const { username, secret } = req.body || {};
  const expectedSecret = process.env.ADMIN_SETUP_SECRET;

  if (!expectedSecret) {
    return res.status(403).json({ error: 'ADMIN_SETUP_SECRET belum diset di server, fitur ini nonaktif' });
  }
  if (!secret || secret !== expectedSecret) {
    return res.status(403).json({ error: 'Secret salah' });
  }
  if (!username) {
    return res.status(400).json({ error: 'Username wajib diisi' });
  }

  const info = db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(username);
  if (info.changes === 0) return res.status(404).json({ error: 'Username tidak ditemukan' });
  res.json({ message: `${username} sekarang jadi admin` });
});

app.listen(PORT, () => {
  console.log(`3SPADA API jalan di http://localhost:${PORT}`);
});
