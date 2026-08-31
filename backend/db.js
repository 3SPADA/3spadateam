const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// DB_PATH bisa dioverride lewat env variable, misalnya kalau di Railway
// kalian pasang Volume dan mount ke /data supaya database tidak hilang tiap deploy ulang:
// DB_PATH=/data/3spada.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '3spada.db');
const db = new Database(DB_PATH);

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// --- Migrasi kecil: kalau tabel match_stats masih pakai struktur lama
// (kills/deaths/is_mvp), drop & buat ulang dengan struktur baru (goals/assists/passes/rating).
// Ini cuma menghapus data statistik pertandingan lama, tidak menyentuh users/attendance.
const columns = db.prepare("PRAGMA table_info(match_stats)").all().map(c => c.name);
if (columns.includes('kills') && !columns.includes('goals')) {
  db.exec('DROP TABLE match_stats');
  db.exec(schema); // buat ulang match_stats dengan struktur terbaru dari schema.sql
}

module.exports = db;
