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
│   ├── admin.html       -> khusus admin: kelola event, hasil pertandingan tim, teks landing page
│   ├── css/style.css
│   └── js/
│       ├── config.js       -> SATU baris API_BASE, ini yang diubah saat deploy
│       ├── main.js         -> menu mobile & tab player/staff
│       ├── auth.js         -> koneksi ke backend (login/registrasi/dashboard)
│       ├── staff-stats.js  -> logika halaman input statistik staff
│       ├── home.js         -> mengisi landing page dari API (teks, event, hasil match)
│       └── admin.js        -> logika panel admin
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
- **Input statistik pertandingan** (`staff-stats.html`) — hanya bisa diakses akun berstatus **staff/admin**. Kalau player login lalu buka halaman ini, langsung ditolak (dicek dua kali: di frontend lewat `/api/me`, dan di backend lewat middleware `staffOnly`). Di halaman ini staff pilih nama player dari dropdown (otomatis terisi dari roster), isi tanggal/lawan/hasil/Goal/Assist/Umpan/Rating, lalu langsung muncul di tabel "Statistik Terakhir Diinput" di bawahnya — lengkap dengan tombol **Edit** dan **Hapus** per baris.
- Link ke halaman ini otomatis muncul di `dashboard.html` (tombol "Input Statistik Player") kalau yang login akunnya staff/admin — player tidak akan melihat tombol ini sama sekali.
- **Panel Admin** (`admin.html`) — khusus akun berstatus **admin** (dicek sama seperti di atas, tapi role harus persis `admin`, staff biasa tidak bisa masuk). Ada 3 tab:
  - **Event** — tambah/edit/hapus agenda yang tampil di section "Event Terdekat" di landing page.
  - **Hasil Pertandingan** — tambah/edit/hapus hasil match tim yang tampil di section "Hasil Match Terakhir" di landing page.
  - **Teks Landing Page** — form untuk mengubah semua teks di halaman Home (judul hero, tagline, angka statistik, teks "Tentang Tim", teks filosofi) tanpa perlu edit kode sama sekali.
- Halaman `home.html` sekarang mengambil semua teks/event/hasil match dari API (lewat `js/home.js`), jadi begitu admin simpan perubahan di panel admin, langsung kelihatan di landing page (refresh halaman).

### Cara bikin akun admin pertama

Tidak ada tombol "daftar sebagai admin" di form registrasi (sengaja, biar orang lain tidak bisa asal jadi admin). Caranya manual, sekali saja:

1. Daftar akun biasa dulu lewat `register.html` (boleh role player atau staff).
2. Set environment variable `ADMIN_SETUP_SECRET` di backend (di Railway: tab Variables) — isi string acak, contoh: `promote-admin-3spada-2026`.
3. Jalankan (dari terminal, ganti `URL-BACKEND` dan `USERNAME` dan `SECRET`):
   ```bash
   curl -X POST https://URL-BACKEND/api/admin/promote \
     -H "Content-Type: application/json" \
     -d '{"username":"USERNAME","secret":"SECRET"}'
   ```
4. Kalau berhasil, muncul `{"message":"USERNAME sekarang jadi admin"}`. Login ulang di website — tombol "Panel Admin" akan muncul di dashboard.

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

## 5. Deploy frontend ke GitHub Pages

Repo ini sudah dilengkapi workflow otomatis di `.github/workflows/deploy-pages.yml` yang men-deploy isi folder `frontend/` ke GitHub Pages setiap kali ada push ke branch `main`.

1. Pastikan `frontend/js/config.js` sudah diisi URL backend Railway kamu (lihat bagian 4 di atas), lalu commit & push.
2. Di GitHub, buka repo `3spadateam` → **Settings** → **Pages** (di sidebar kiri, grup "Code and automation").
3. Di bagian **Build and deployment**, ubah **Source** jadi **"GitHub Actions"** (bukan "Deploy from a branch").
4. Push apa saja ke `main` (atau buka tab **Actions** di repo, pilih workflow "Deploy frontend to GitHub Pages", klik **Run workflow** untuk trigger manual pertama kali).
5. Tunggu workflow selesai (tanda centang hijau di tab Actions), lalu buka lagi **Settings → Pages** — di situ akan muncul URL publiknya, formatnya seperti: `https://USERNAME-KAMU.github.io/3spadateam/`.
6. Update env `CORS_ORIGIN` di Railway dengan URL itu (tanpa garis miring di akhir), supaya backend mengizinkan request dari domain ini.

Catatan: alamat pembuka (`/`) otomatis mengarahkan ke `home.html` lewat `frontend/index.html`.

## 6. Yang masih perlu dibereskan sebelum dipakai publik

Ini starter yang sudah jalan dan sudah saya test end-to-end, tapi belum "production-ready":

- Ganti `JWT_SECRET` di env dengan string acak panjang, jangan pakai contoh bawaan.
- Set `ADMIN_SETUP_SECRET` di env sebelum promote akun admin pertama (lihat bagian 3 di atas), lalu idealnya dihapus/diganti lagi setelahnya biar tidak ada yang iseng promote diri sendiri.
- Pasang Volume di Railway untuk database (lihat bagian Deploy di atas) — tanpa ini, data bisa hilang tiap deploy ulang.
- Belum ada halaman admin untuk lihat rekap absen semua orang (API-nya sudah ada: `GET /api/attendance/all`, tinggal dibuatkan tampilannya).
- Belum ada validasi lanjutan (rate limiting, reset password, dsb).

## 7. Daftar endpoint API

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
| GET | `/api/events` | publik | Daftar event/agenda (untuk landing page) |
| POST | `/api/events` | admin | Tambah event |
| PUT | `/api/events/:id` | admin | Edit event |
| DELETE | `/api/events/:id` | admin | Hapus event |
| GET | `/api/matches` | publik | Daftar hasil pertandingan tim (untuk landing page) |
| POST | `/api/matches` | admin | Tambah hasil pertandingan |
| PUT | `/api/matches/:id` | admin | Edit hasil pertandingan |
| DELETE | `/api/matches/:id` | admin | Hapus hasil pertandingan |
| GET | `/api/content` | publik | Semua teks landing page |
| PUT | `/api/content` | admin | Update teks landing page (kirim object key-value) |
| POST | `/api/admin/promote` | secret khusus | Jadikan sebuah akun sebagai admin (dipakai sekali di awal) |
