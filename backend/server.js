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

// Staf/coach menambahkan statistik untuk seorang player setelah match
app.post('/api/stats', authRequired, staffOnly, (req, res) => {
  const { user_id, match_date, opponent, result, goals, assists, passes, rating } = req.body || {};
  if (!user_id || !match_date || !opponent || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }

  const info = db.prepare(`
    INSERT INTO match_stats (user_id, match_date, opponent, result, goals, assists, passes, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, match_date, opponent, result, goals || 0, assists || 0, passes || 0, rating || 0);

  res.status(201).json({ id: info.lastInsertRowid, message: 'Statistik tersimpan' });
});

// Staf mengedit statistik yang sudah pernah diinput (misal salah ketik)
app.put('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const { user_id, match_date, opponent, result, goals, assists, passes, rating } = req.body || {};

  const existing = db.prepare('SELECT id FROM match_stats WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Data statistik tidak ditemukan' });

  if (!user_id || !match_date || !opponent || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }

  db.prepare(`
    UPDATE match_stats
    SET user_id = ?, match_date = ?, opponent = ?, result = ?, goals = ?, assists = ?, passes = ?, rating = ?
    WHERE id = ?
  `).run(user_id, match_date, opponent, result, goals || 0, assists || 0, passes || 0, rating || 0, id);

  res.json({ message: 'Statistik diperbarui' });
});

// Staf menghapus statistik yang salah input
app.delete('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM match_stats WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Data statistik tidak ditemukan' });
  res.json({ message: 'Statistik dihapus' });
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
