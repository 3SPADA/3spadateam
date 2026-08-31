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
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  is_mvp INTEGER DEFAULT 0,            -- 0 = bukan, 1 = MVP
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user ON match_stats(user_id);
