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
│       ├── config.js       -> SATU baris API_BASE, ini yang diubah saat deploy
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

Kalau backend dan frontend jalan di alamat berbeda saat sudah online nanti, ubah baris `API_BASE` di `frontend/js/config.js` (cuma satu file itu yang perlu diubah).

## 3. Alur fitur yang sudah jalan

- **Registrasi** (`register.html`) — player/staff daftar akun baru, password otomatis di-hash (bcrypt), tidak disimpan mentah.
- **Login** (`login.html`) — dapat token (JWT) yang disimpan di browser, berlaku 7 hari.
- **Dashboard** (`dashboard.html`, wajib login):
  - Absen harian (Hadir/Izin) — satu status per orang per tanggal.
  - Lihat riwayat statistik pertandingan sendiri (K/D/A, menang/kalah, MVP).
- **Input statistik pertandingan** (`staff-stats.html`) — hanya bisa diakses akun berstatus **staff**. Kalau player login lalu buka halaman ini, langsung ditolak (dicek dua kali: di frontend lewat `/api/me`, dan di backend lewat middleware `staffOnly`). Di halaman ini staff pilih nama player dari dropdown (otomatis terisi dari roster), isi tanggal/lawan/hasil/K-D-A/MVP, lalu langsung muncul di tabel "Statistik Terakhir Diinput" di bawahnya — lengkap dengan tombol **Edit** dan **Hapus** per baris.
- Link ke halaman ini otomatis muncul di `dashboard.html` (tombol "Input Statistik Player") kalau yang login akunnya staff — player tidak akan melihat tombol ini sama sekali.

## 4. Deploy ke Railway

**A. Backend**

1. Buka [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → pilih repo `3spadateam`.
2. Di pengaturan service, set **Root Directory** ke `backend` (karena backend ada di subfolder, bukan di root repo).
3. Di tab **Variables**, tambahkan:
   - `JWT_SECRET` — isi string acak panjang, jangan pakai contoh bawaan.
   - `CORS_ORIGIN` — isi dengan alamat frontend kalian nanti (boleh dikosongkan dulu waktu masih tahap coba-coba).
   - `DB_PATH` — isi `/data/3spada.db` **kalau** kalian sudah pasang Volume (lihat poin 4 di bawah). Kalau belum pasang Volume, biarkan kosong dulu.
   - `PORT` tidak perlu diisi manual, Railway yang mengatur otomatis.
4. **Penting soal database**: filesystem Railway bawaan itu sementara — tiap kali deploy ulang, isi database SQLite bisa hilang. Supaya data absen/statistik tidak hilang, tambahkan **Volume** di tab Settings service ini, mount ke path `/data`, lalu set env `DB_PATH=/data/3spada.db` seperti poin di atas.
5. Setelah deploy sukses, Railway kasih URL publik semacam `https://3spadateam-backend-production.up.railway.app`. Cek jalan atau tidak dengan buka URL itu di browser — harus muncul `{"status":"ok","service":"3spada-backend"}`.

**B. Frontend**

1. Buka `frontend/js/config.js`, ganti `API_BASE` jadi URL Railway kalian + `/api`, contoh:
   ```js
   const API_BASE = 'https://3spadateam-backend-production.up.railway.app/api';
   ```
2. Commit & push perubahan itu ke GitHub.
3. Frontend-nya sendiri (file HTML statis) bisa di-hosting terpisah — misalnya GitHub Pages, Netlify, Vercel, atau sebagai service kedua di Railway juga. Bilang aja kalau mau dibantu setup salah satunya.
4. Setelah frontend live, masukkan alamat frontend itu ke env `CORS_ORIGIN` di Railway backend (poin 3 di bagian Backend), supaya browser tidak memblokir requestnya.

## 5. Yang masih perlu dibereskan sebelum dipakai publik

Ini starter yang sudah jalan dan sudah saya test end-to-end, tapi belum "production-ready":

- Ganti `JWT_SECRET` di env dengan string acak panjang, jangan pakai contoh bawaan.
- Pasang Volume di Railway untuk database (lihat bagian Deploy di atas) — tanpa ini, data bisa hilang tiap deploy ulang.
- Belum ada halaman admin untuk lihat rekap absen semua orang (API-nya sudah ada: `GET /api/attendance/all`, tinggal dibuatkan tampilannya).
- Belum ada validasi lanjutan (rate limiting, reset password, dsb).

## 6. Daftar endpoint API

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
| PUT | `/api/stats/:id` | staff | Edit statistik yang salah input |
| DELETE | `/api/stats/:id` | staff | Hapus statistik |
