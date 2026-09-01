-- Database untuk 3SPADA: akun anggota, absensi latihan, dan statistik pertandingan

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('player','staff','admin')) DEFAULT 'player',
  game_role TEXT,             -- contoh: 'EXP Laner', 'Head Coach'
  ign TEXT,                   -- in-game name / username publik
  photo_url TEXT,
  joined_at TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,          -- format YYYY-MM-DD
  status TEXT NOT NULL CHECK(status IN ('hadir','izin','alpha')) DEFAULT 'hadir',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, session_date)        -- satu status per orang per hari
);

CREATE TABLE IF NOT EXISTS match_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_date TEXT NOT NULL,
  opponent TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('menang','kalah')),
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  passes INTEGER DEFAULT 0,            -- jumlah umpan
  rating REAL DEFAULT 0,               -- rating pertandingan, contoh: 7.5
  created_at TEXT DEFAULT (datetime('now'))
);

-- Event/agenda yang tampil di landing page (dikelola admin)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL,            -- format YYYY-MM-DD
  name TEXT NOT NULL,
  location TEXT,
  tag TEXT,                            -- contoh: 'Kualifikasi', 'Fase Grup'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Hasil pertandingan TIM (beda dari match_stats yang per-player) untuk landing page (dikelola admin)
CREATE TABLE IF NOT EXISTS team_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_date TEXT NOT NULL,
  opponent TEXT NOT NULL,
  score TEXT NOT NULL,                 -- contoh: '2-1'
  result TEXT NOT NULL CHECK(result IN ('menang','kalah')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sponsor yang tampil di landing page (dikelola admin)
CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT,                           -- contoh: 'Internet & Hosting', 'Minuman Energi'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Teks-teks landing page yang bisa diubah admin (hero, intro, statistik ringkas, dst)
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user ON match_stats(user_id);
