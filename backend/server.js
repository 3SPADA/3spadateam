require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-secret-ini-di-file-.env';

app.use(cors());
app.use(express.json());

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
    SELECT match_date, opponent, result, kills, deaths, assists, is_mvp
    FROM match_stats WHERE user_id = ? ORDER BY match_date DESC
  `).all(req.user.id);
  res.json(rows);
});

// Staf melihat semua statistik yang sudah pernah diinput (untuk halaman input)
app.get('/api/stats/all', authRequired, staffOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT ms.id, ms.user_id, ms.match_date, ms.opponent, ms.result, ms.kills, ms.deaths, ms.assists, ms.is_mvp,
           u.full_name, u.ign
    FROM match_stats ms JOIN users u ON u.id = ms.user_id
    ORDER BY ms.match_date DESC, ms.id DESC LIMIT 100
  `).all();
  res.json(rows);
});

// Staf/coach menambahkan statistik untuk seorang player setelah match
app.post('/api/stats', authRequired, staffOnly, (req, res) => {
  const { user_id, match_date, opponent, result, kills, deaths, assists, is_mvp } = req.body || {};
  if (!user_id || !match_date || !opponent || !result) {
    return res.status(400).json({ error: 'Data pertandingan belum lengkap' });
  }
  if (!['menang', 'kalah'].includes(result)) {
    return res.status(400).json({ error: 'Hasil harus "menang" atau "kalah"' });
  }

  const info = db.prepare(`
    INSERT INTO match_stats (user_id, match_date, opponent, result, kills, deaths, assists, is_mvp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, match_date, opponent, result, kills || 0, deaths || 0, assists || 0, is_mvp ? 1 : 0);

  res.status(201).json({ id: info.lastInsertRowid, message: 'Statistik tersimpan' });
});

// Staf mengedit statistik yang sudah pernah diinput (misal salah ketik)
app.put('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const { user_id, match_date, opponent, result, kills, deaths, assists, is_mvp } = req.body || {};

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
    SET user_id = ?, match_date = ?, opponent = ?, result = ?, kills = ?, deaths = ?, assists = ?, is_mvp = ?
    WHERE id = ?
  `).run(user_id, match_date, opponent, result, kills || 0, deaths || 0, assists || 0, is_mvp ? 1 : 0, id);

  res.json({ message: 'Statistik diperbarui' });
});

// Staf menghapus statistik yang salah input
app.delete('/api/stats/:id', authRequired, staffOnly, (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM match_stats WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Data statistik tidak ditemukan' });
  res.json({ message: 'Statistik dihapus' });
});

app.listen(PORT, () => {
  console.log(`3SPADA API jalan di http://localhost:${PORT}`);
});
