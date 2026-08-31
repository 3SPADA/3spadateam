# Website 3SPADA

Struktur project:

```
3spada-website/
├── frontend/           -> file website statis (HTML/CSS/JS)
│   ├── home.html
│   ├── team.html
│   ├── about.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html  -> khusus anggota yang sudah login (absen + statistik)
│   ├── staff-stats.html -> khusus staff/coach: input statistik pertandingan player
│   ├── css/style.css
│   └── js/
│       ├── main.js         -> menu mobile & tab player/staff
│       ├── auth.js         -> koneksi ke backend (login/registrasi/dashboard)
│       └── staff-stats.js  -> logika halaman input statistik staff
└── backend/            -> API + database
    ├── server.js
    ├── db.js
    ├── schema.sql
    ├── package.json
    └── .env.example
```

## 1. Menjalankan backend (API + database)

Database pakai **SQLite** (file lokal, tidak perlu install database server terpisah).

```bash
cd backend
cp .env.example .env      # lalu ganti JWT_SECRET dengan string acak sendiri
npm install
npm start
```

Kalau berhasil, muncul: `3SPADA API jalan di http://localhost:4000`
File database `3spada.db` akan otomatis dibuat di folder `backend/` saat pertama kali jalan.

## 2. Menjalankan frontend

Paling gampang pakai extension "Live Server" di VS Code, atau:

```bash
cd frontend
npx serve .
```

Buka `home.html` lewat server tersebut (jangan double-click file langsung dari File Explorer, supaya fetch ke API tidak diblokir browser).

Kalau backend dan frontend jalan di alamat berbeda saat sudah online nanti, ubah baris `API_BASE` di `frontend/js/auth.js`.

## 3. Alur fitur yang sudah jalan

- **Registrasi** (`register.html`) — player/staff daftar akun baru, password otomatis di-hash (bcrypt), tidak disimpan mentah.
- **Login** (`login.html`) — dapat token (JWT) yang disimpan di browser, berlaku 7 hari.
- **Dashboard** (`dashboard.html`, wajib login):
  - Absen harian (Hadir/Izin) — satu status per orang per tanggal.
  - Lihat riwayat statistik pertandingan sendiri (K/D/A, menang/kalah, MVP).
- **Input statistik pertandingan** (`staff-stats.html`) — hanya bisa diakses akun berstatus **staff**. Kalau player login lalu buka halaman ini, langsung ditolak (dicek dua kali: di frontend lewat `/api/me`, dan di backend lewat middleware `staffOnly`). Di halaman ini staff pilih nama player dari dropdown (otomatis terisi dari roster), isi tanggal/lawan/hasil/K-D-A/MVP, lalu langsung muncul di tabel "Statistik Terakhir Diinput" di bawahnya.
- Link ke halaman ini otomatis muncul di `dashboard.html` (tombol "Input Statistik Player") kalau yang login akunnya staff — player tidak akan melihat tombol ini sama sekali.

## 4. Yang masih perlu dibereskan sebelum dipakai publik

Ini starter yang sudah jalan dan sudah saya test end-to-end, tapi belum "production-ready":

- Ganti `JWT_SECRET` di `.env` dengan string acak panjang, jangan pakai contoh bawaan.
- Saat dideploy online, wajib pakai **HTTPS** (token dikirim di header, kalau lewat HTTP biasa bisa disadap).
- Belum ada halaman admin untuk lihat rekap absen semua orang (API-nya sudah ada: `GET /api/attendance/all`, tinggal dibuatkan tampilannya).
- Belum bisa edit/hapus statistik yang salah input — kalau ada typo K/D/A, saat ini harus tambah lewat database langsung.
- Belum ada validasi lanjutan (rate limiting, reset password, dsb).

## 5. Daftar endpoint API

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/register` | publik | Daftar akun player/staff |
| POST | `/api/login` | publik | Login, dapat token |
| GET | `/api/me` | login | Profil sendiri |
| GET | `/api/roster` | publik | Daftar semua anggota (untuk halaman Team) |
| POST | `/api/attendance` | login | Catat absen hari ini |
| GET | `/api/attendance/me` | login | Riwayat absen sendiri |
| GET | `/api/attendance/all` | staff | Rekap absen semua anggota |
| GET | `/api/stats/me` | login | Statistik pertandingan sendiri |
| GET | `/api/stats/all` | staff | Semua statistik yang sudah diinput (untuk halaman input) |
| POST | `/api/stats` | staff | Input statistik untuk seorang player |
