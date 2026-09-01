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

// --- Seed teks halaman default (pakai INSERT OR IGNORE per-key, jadi:
// - key yang belum ada otomatis ditambahkan (misalnya waktu ada fitur baru menambah key baru)
// - key yang sudah pernah diedit admin TIDAK akan ketimpa ulang ke nilai default)
const defaults = {
  // Home — hero & intro
  hero_eyebrow: 'Komunitas Esport — Kalimantan Barat',
  hero_title_line1: 'TIGA',
  hero_title_line2: 'MATA',
  hero_title_accent: 'PEDANG.',
  hero_tagline: '3SPADA lahir dari pertemanan tiga pemain yang menolak kalah diam-diam. Sekarang jadi rumah bagi pemain dan staf yang serius main, santai ngobrol.',
  stat_founded: '2023',
  stat_members: '8',
  stat_tournaments: '14',
  stat_record: '9-5',
  intro_title: 'Dari Sambas, untuk arena',
  intro_paragraph_1: '3SPADA berawal dari mabar rutin tiga anak Sambas yang keterusan sampai ikut turnamen regional. Nama "Spada" kami ambil dari kata pedang — filosofinya sederhana, main harus tajam dan tenang, bukan asal agresif.',
  intro_paragraph_2: 'Hari ini tim diisi lima pemain inti dan tiga staf pendukung, semua masih berstatus komunitas — belum ada yang jadi pro penuh waktu, tapi latihannya sudah seserius tim semi-pro.',
  philosophy_text: 'Rotasi rapi, komunikasi pendek, dan nggak ada yang boleh nge-blame di voice chat pas lagi kalah. Evaluasi selalu habis pertandingan, bukan di tengah game.',

  // Team page
  team_title: 'Player & Staff',
  team_subtitle: 'Delapan orang, satu voice channel, satu tujuan: naik divisi musim depan.',

  // About Us page
  about_eyebrow: 'Siapa kami',
  about_paragraph_1: '3SPADA dibentuk pertengahan 2023 oleh tiga pemain asal Sambas, Kalimantan Barat, yang awalnya cuma nge-push rank bareng tiap malam. Setelah menang beberapa turnamen kecil antar-warnet, mereka memutuskan bikin tim resmi dan merekrut dua pemain tambahan plus tiga staf pendukung.',
  about_paragraph_2: 'Nama "Spada" — dari kata pedang — dipilih karena filosofi main tim: tajam saat perlu, tenang saat tertekan. Angka tiga menandai tiga pendiri yang sampai sekarang masih jadi tulang punggung roster.',
  vision_text: 'Jadi tim komunitas Kalimantan Barat yang naik ke level semi-pro dalam tiga musim ke depan.',
  mission_text: 'Latihan terjadwal, evaluasi rutin, dan regenerasi pemain muda dari kota sendiri.',
  values_text: 'Disiplin latihan, jujur soal kesalahan, dan nggak toxic ke tim lawan maupun ke sesama anggota.',
  timeline_2023_title: 'Tim resmi terbentuk',
  timeline_2023_desc: 'Lima pemain inti mulai latihan terjadwal tiga kali seminggu.',
  timeline_2024_title: 'Turnamen regional pertama',
  timeline_2024_desc: 'Lolos ke babak grup IEL Regional Kalimantan untuk pertama kali.',
  timeline_2025_title: 'Sponsor pertama masuk',
  timeline_2025_desc: 'NusaHost dan Gearloka jadi mitra tetap tim.',
  timeline_2026_title: 'Target naik divisi',
  timeline_2026_desc: 'Fokus musim ini: masuk 8 besar IEL Season 5 Regional Kalimantan.',
  contact_intro: 'Buat urusan sponsorship, tantangan scrim, atau sekadar nanya jadwal latihan.',
  contact_instagram_url: '#',
  contact_tiktok_url: '#',
  contact_discord_url: '#',
  contact_email_url: '#'
};
const insertContentIfMissing = db.prepare('INSERT OR IGNORE INTO site_content (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaults)) insertContentIfMissing.run(key, value);

// --- Seed event & hasil match default (cuma kalau tabelnya masih kosong)
const eventCount = db.prepare('SELECT COUNT(*) AS c FROM events').get().c;
if (eventCount === 0) {
  const insertEvent = db.prepare('INSERT INTO events (event_date, name, location, tag) VALUES (?, ?, ?, ?)');
  insertEvent.run('2026-09-14', 'IEL Season 5 — Regional Kalimantan', 'Pontianak, offline qualifier', 'Kualifikasi');
  insertEvent.run('2026-09-28', 'NUSA CUP — Community Series', 'Online, BO3 grup', 'Fase Grup');
  insertEvent.run('2026-10-19', 'Piala Kemerdekaan Esport Kalbar', 'Sambas, offline final', 'Undangan');
}

const matchCount = db.prepare('SELECT COUNT(*) AS c FROM team_matches').get().c;
if (matchCount === 0) {
  const insertMatch = db.prepare('INSERT INTO team_matches (match_date, opponent, score, result) VALUES (?, ?, ?, ?)');
  insertMatch.run('2026-08-20', 'EVOS Muda Kalbar', '2–1', 'menang');
  insertMatch.run('2026-08-12', 'RRQ Sahur Squad', '0–2', 'kalah');
  insertMatch.run('2026-08-05', 'ONIC Prodigy', '2–0', 'menang');
  insertMatch.run('2026-07-29', 'Bigetron Alpha', '2–1', 'menang');
}

const sponsorCount = db.prepare('SELECT COUNT(*) AS c FROM sponsors').get().c;
if (sponsorCount === 0) {
  const insertSponsor = db.prepare('INSERT INTO sponsors (name, kind) VALUES (?, ?)');
  insertSponsor.run('NUSAHOST', 'Internet & Hosting');
  insertSponsor.run('ARENAFUEL', 'Minuman Energi');
  insertSponsor.run('GEARLOKA', 'Peripheral Gaming');
  insertSponsor.run('KEDAI KOPI SAMBAS', 'Bootcamp Partner');
}

module.exports = db;
