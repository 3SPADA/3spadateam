# Website 3SPADA

Struktur project:

```
3spada-website/
├── frontend/                -> file website statis (HTML/CSS/JS)
│   ├── index.html           -> Home (root, URL: /)
│   ├── team/index.html      -> URL: /team/
│   ├── about/index.html     -> URL: /about/
│   ├── login/index.html     -> URL: /login/
│   ├── register/index.html  -> URL: /register/
│   ├── dashboard/index.html -> URL: /dashboard/ (khusus anggota yang sudah login: absen + statistik)
│   ├── staff-stats/index.html -> URL: /staff-stats/ (khusus staff/coach: input statistik player)
│   ├── reports/index.html   -> URL: /reports/ (khusus staff/admin: leaderboard performa)
│   ├── admin/index.html     -> URL: /admin/ (khusus admin: kelola event, hasil match, teks halaman)
│   ├── css/style.css
│   └── js/
│       ├── config.js        -> SATU baris API_BASE, ini yang diubah saat deploy
│       ├── anti-inspect.js  -> matikan klik kanan & shortcut devtools (lihat catatan di bawah)
│       ├── main.js          -> menu mobile & tab player/staff
│       ├── auth.js          -> koneksi ke backend (login/registrasi/dashboard)
│       ├── staff-stats.js   -> logika halaman input statistik staff
│       ├── home.js          -> mengisi event, sponsor, hasil match, leaderboard di Home
│       ├── content.js       -> generic: isi teks halaman dari /api/content (dipakai home/team/about)
│       ├── team.js          -> mengisi roster Team dari akun asli (GET /api/roster)
│       ├── reports.js       -> logika halaman leaderboard laporan performa
│       └── admin.js         -> logika panel admin
└── backend/            -> API + database
    ├── server.js
    ├── db.js
    ├── schema.sql
    ├── package.json
    └── .env.example
```

### Kenapa strukturnya folder + index.html, bukan nama-file.html?

Ini yang disebut "clean URL" — supaya alamatnya `namadomain.com/3spadateam/team/` (tanpa `.html` kelihatan), bukan `.../team.html`. GitHub Pages (dan hampir semua static hosting) otomatis nampilin `index.html` kalau sebuah folder diakses. Semua link internal (nav, tombol, redirect JS) sudah disesuaikan pakai path relatif (`../`) supaya tetap benar meskipun repo di-hosting di subpath (`/3spadateam/`) bukan di root domain.

Kalau nanti nambah halaman baru, ikutin pola ini: bikin folder baru berisi `index.html`, isi asset path-nya (`css/`, `js/`) diawali `../`.

### Catatan soal anti-inspect (`js/anti-inspect.js`)

Script ini mematikan klik kanan dan shortcut buka DevTools (F12, Ctrl+Shift+I, dll) di semua halaman. **Ini bukan proteksi keamanan sungguhan** — cuma penghalang ringan buat pengunjung awam:
- Source HTML/CSS/JS tetap terkirim ke browser siapa pun yang buka situsnya, dan tetap bisa dilihat lewat `curl`, `view-source:`, mematikan JavaScript, atau banyak cara lain yang tidak bisa diblokir dari sisi frontend.
- Jangan pernah taruh data rahasia (password, API key, secret) di kode frontend dengan asumsi script ini akan menyembunyikannya.
- Kalau ternyata bikin pengalaman pengunjung jadi terganggu (misalnya ada yang butuh copy-paste teks buat keperluan wajar), tinggal hapus baris `<script src="js/anti-inspect.js">` (atau `../js/anti-inspect.js`) dari halaman yang bersangkutan.

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

Buka `index.html` (Home) lewat server tersebut (jangan double-click file langsung dari File Explorer, supaya fetch ke API tidak diblokir browser).

Kalau backend dan frontend jalan di alamat berbeda saat sudah online nanti, ubah baris `API_BASE` di `frontend/js/config.js` (cuma satu file itu yang perlu diubah).

## 3. Alur fitur yang sudah jalan

- **Registrasi** (`register/`) — player/staff daftar akun baru, password otomatis di-hash (bcrypt), tidak disimpan mentah. Field Status (Player/Staff) dan Role (GK/CB/WF/ST — posisi bermain) pakai **radio button**, Rank (PRO/WORLD CLASS) juga radio button, plus field Usia.
- **Login** (`login/`) — dapat token (JWT) yang disimpan di browser, berlaku 7 hari.
- **Dashboard** (`dashboard/`, wajib login):
  - Absen harian (Hadir/Izin) — satu status per orang per tanggal.
  - Lihat riwayat statistik pertandingan sendiri (Goal/Assist/Umpan/Rating, menang/kalah).
  - **Edit Profil** — ubah nama lengkap, IGN, Role (radio GK/CB/WF/ST), Rank (radio PRO/WORLD CLASS), Usia, dan URL foto sendiri. Perubahan ini langsung kelihatan di halaman Team (roster ambil data asli dari akun terdaftar lewat `js/team.js`).
  - **Ganti Password** — wajib masukkan password lama dulu sebelum bisa ganti ke password baru.
- **Input statistik pertandingan** (`staff-stats/`) — hanya bisa diakses akun berstatus **staff/admin**. Kalau player login lalu buka halaman ini, langsung ditolak (dicek dua kali: di frontend lewat `/api/me`, dan di backend lewat middleware `staffOnly`). Di halaman ini staff pilih nama player dari dropdown (otomatis terisi dari roster), isi tanggal/lawan/hasil/Goal/Assist/Umpan — **Rating dihitung otomatis oleh sistem**, tidak diinput manual (lihat bagian "Rating otomatis" di bawah) — lalu langsung muncul di tabel "Statistik Terakhir Diinput" di bawahnya, lengkap dengan tombol **Edit** dan **Hapus** per baris.
- **Laporan Performa** — di dashboard, tiap player/staff lihat laporan performa miliknya sendiri (skor keseluruhan, rata-rata rating, match diikuti, kehadiran latihan, total goal/assist/umpan), lengkap dengan **grafik tren rating per pertandingan** (line chart, pakai Chart.js). Staff/admin juga punya halaman **`reports/`** ("Laporan Performa Tim") yang menampilkan leaderboard SEMUA player — kolom-kolomnya bisa **diklik buat sort** (naik/turun), default diurutkan dari skor tertinggi.
- **Sidebar "Top Arrancar"** di halaman Home — leaderboard publik (tanpa perlu login) yang menampilkan 10 player dengan skor keseluruhan tertinggi. Sticky di sisi kanan pas discroll (di layar besar), pindah ke bawah konten utama di HP. Datanya dari endpoint publik `GET /api/reports/top10` — beda dari `/api/reports/all` yang cuma bisa diakses staff, ini sengaja dibuat publik tapi cuma nampilin field yang aman (nama, skor, rating, jumlah match — tanpa detail absen).
- Link ke halaman ini otomatis muncul di `dashboard/` (tombol "Input Statistik Player") kalau yang login akunnya staff/admin — player tidak akan melihat tombol ini sama sekali.
- **Panel Admin** (`admin/`) — khusus akun berstatus **admin** (dicek sama seperti di atas, tapi role harus persis `admin`, staff biasa tidak bisa masuk). Ada 5 tab:
  - **Event** — tambah/edit/hapus agenda yang tampil di section "Event Terdekat" di halaman Home.
  - **Hasil Pertandingan** — tambah/edit/hapus hasil match tim yang tampil di section "Hasil Match Terakhir" di halaman Home.
  - **Sponsor** — tambah/edit/hapus sponsor yang tampil di section "Sponsorship" di halaman Home.
  - **Teks Halaman** — form untuk mengubah semua teks di halaman Home (hero, statistik ringkas, "Tentang Tim"), Team (judul & subjudul di atas roster), dan About Us (cerita tim, visi/misi/nilai, jejak singkat, link kontak) — tanpa perlu edit kode sama sekali.
  - **Kelola Akun** — daftar semua akun player/staff (nama, username, role, rank, usia) dengan tombol **Hapus** per akun. Data absen dan statistik pertandingan akun itu ikut terhapus otomatis (cascade). Akun admin tidak bisa dihapus lewat sini (proteksi biar nggak ada yang salah pencet dan kehilangan akses admin).
- Halaman `index.html` (Home), `team/`, dan `about/` sekarang mengambil semua teks dari API lewat `js/content.js` (dan `index.html` (Home) juga ambil event/sponsor/hasil match lewat `js/home.js`), jadi begitu admin simpan perubahan di panel admin, langsung kelihatan di halaman terkait (refresh halaman). Daftar player/staff di halaman Team tetap otomatis dari akun yang terdaftar, bukan dari panel admin.

### Cara bikin akun admin pertama

Tidak ada tombol "daftar sebagai admin" di form registrasi (sengaja, biar orang lain tidak bisa asal jadi admin). Caranya manual, sekali saja:

1. Daftar akun biasa dulu lewat `register/` (boleh role player atau staff).
2. Set environment variable `ADMIN_SETUP_SECRET` di backend (di Railway: tab Variables) — isi string acak, contoh: `promote-admin-3spada-2026`.
3. Jalankan (dari terminal, ganti `URL-BACKEND` dan `USERNAME` dan `SECRET`):
   ```bash
   curl -X POST https://URL-BACKEND/api/admin/promote \
     -H "Content-Type: application/json" \
     -d '{"username":"USERNAME","secret":"SECRET"}'
   ```
4. Kalau berhasil, muncul `{"message":"USERNAME sekarang jadi admin"}`. Login ulang di website — tombol "Panel Admin" akan muncul di dashboard.

### Rating otomatis & Laporan Performa

Rating per pertandingan **tidak lagi diinput manual** — dihitung sistem lewat fungsi `calculateMatchRating()` di `backend/server.js`:

```
rating = 6.0 (dasar)
       + goals   × 0.6
       + assists × 0.4
       + passes  × 0.02
       + (menang ? +0.3 : -0.2)
→ dibatasi 0-10, dibulatkan 1 desimal
```

Dihitung ulang otomatis tiap kali staff tambah atau edit statistik. Kalau bobotnya mau diubah (misalnya assist dianggap lebih berharga), tinggal ubah angka-angka di fungsi itu.

**Skor Keseluruhan** (`overall_score`) di Laporan Performa = 70% rata-rata rating pertandingan + 30% persentase kehadiran latihan. Kalau player belum punya data pertandingan ATAU belum punya data absen sama sekali, bagian yang kosong itu diabaikan dari perhitungan (bukan dianggap nol) — logikanya ada di fungsi `buildPerformanceReport()`.

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

Catatan: `frontend/index.html` sekarang berisi halaman Home langsung (bukan file redirect lagi), jadi alamat pembuka (`/`) langsung menampilkan Home tanpa pengalihan.

## 6. Keamanan yang sudah dipasang

- **Password di-hash** (bcrypt), tidak pernah disimpan mentah.
- **SQL injection aman** — semua query pakai parameterized query (`db.prepare(...).run(...)`), tidak ada string SQL yang digabung manual dari input user.
- **XSS (Cross-Site Scripting) dicegah** — semua data yang datang dari user (nama, IGN, nama event, sponsor, lawan pertandingan, dst) di-escape lewat fungsi `escapeHtml()` (di `js/main.js`) sebelum ditampilkan ke halaman. Jadi kalau ada yang coba isi nama dengan kode `<script>...</script>`, itu bakal tampil sebagai teks biasa, bukan dieksekusi.
- **Rate limiting** — endpoint `/api/login` dan `/api/register` dibatasi 10 percobaan per 15 menit per IP; `/api/admin/promote` dibatasi lebih ketat lagi (5 percobaan per jam) karena paling sensitif.
- **Helmet.js** — menambahkan HTTP security header standar (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, dst) ke semua response API.
- **CORS terkontrol** — bisa dibatasi cuma domain tertentu yang boleh akses API lewat env `CORS_ORIGIN`.
- **Role-based access control** — endpoint sensitif (input statistik, kelola event/sponsor/teks, promote admin) diproteksi middleware `staffOnly`/`adminOnly`, dicek di setiap request, bukan cuma disembunyikan di frontend.

## 7. Yang masih perlu dibereskan sebelum dipakai publik

Ini starter yang sudah jalan dan sudah saya test end-to-end, tapi belum "production-ready":

- Ganti `JWT_SECRET` di env dengan string acak panjang, jangan pakai contoh bawaan (server sekarang kasih peringatan di log kalau ini belum diset).
- Set `ADMIN_SETUP_SECRET` di env sebelum promote akun admin pertama (lihat bagian 3 di atas), lalu idealnya dihapus/diganti lagi setelahnya biar tidak ada yang iseng promote diri sendiri.
- Pasang Volume di Railway untuk database (lihat bagian Deploy di atas) — tanpa ini, data bisa hilang tiap deploy ulang.
- Belum ada halaman admin untuk lihat rekap absen semua orang (API-nya sudah ada: `GET /api/attendance/all`, tinggal dibuatkan tampilannya).
- Belum ada fitur reset password lewat email (kalau lupa password, sementara ini harus reset manual lewat database).

## 8. Daftar endpoint API

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/register` | publik | Daftar akun player/staff |
| POST | `/api/login` | publik | Login, dapat token |
| GET | `/api/me` | login | Profil sendiri |
| PUT | `/api/me` | login | Edit profil sendiri (nama, IGN, role di game, foto) |
| PUT | `/api/me/password` | login | Ganti password sendiri (wajib password lama) |
| GET | `/api/roster` | publik | Daftar semua anggota (untuk halaman Team) |
| POST | `/api/attendance` | login | Catat absen hari ini |
| GET | `/api/attendance/me` | login | Riwayat absen sendiri |
| GET | `/api/attendance/all` | staff | Rekap absen semua anggota |
| GET | `/api/stats/me` | login | Statistik pertandingan sendiri |
| GET | `/api/stats/all` | staff | Semua statistik yang sudah diinput (untuk halaman input) |
| POST | `/api/stats` | staff | Input statistik untuk seorang player |
| PUT | `/api/stats/:id` | staff | Edit statistik (rating dihitung ulang otomatis) |
| DELETE | `/api/stats/:id` | staff | Hapus statistik |
| GET | `/api/reports/me` | login | Laporan performa (skor, rating, kehadiran) milik sendiri |
| GET | `/api/reports/all` | staff | Leaderboard laporan performa semua player |
| GET | `/api/reports/top10` | publik | Top 10 leaderboard ringkas (buat sidebar Home) |
| GET | `/api/events` | publik | Daftar event/agenda (untuk landing page) |
| POST | `/api/events` | admin | Tambah event |
| PUT | `/api/events/:id` | admin | Edit event |
| DELETE | `/api/events/:id` | admin | Hapus event |
| GET | `/api/matches` | publik | Daftar hasil pertandingan tim (untuk landing page) |
| POST | `/api/matches` | admin | Tambah hasil pertandingan |
| PUT | `/api/matches/:id` | admin | Edit hasil pertandingan |
| DELETE | `/api/matches/:id` | admin | Hapus hasil pertandingan |
| GET | `/api/sponsors` | publik | Daftar sponsor (untuk halaman Home) |
| POST | `/api/sponsors` | admin | Tambah sponsor |
| PUT | `/api/sponsors/:id` | admin | Edit sponsor |
| DELETE | `/api/sponsors/:id` | admin | Hapus sponsor |
| GET | `/api/content` | publik | Semua teks halaman (home/team/about) |
| PUT | `/api/content` | admin | Update teks halaman (kirim object key-value) |
| POST | `/api/admin/promote` | secret khusus | Jadikan sebuah akun sebagai admin (dipakai sekali di awal) |
| GET | `/api/admin/users` | admin | Daftar semua akun player/staff |
| DELETE | `/api/admin/users/:id` | admin | Hapus akun player/staff (data absen & statistik ikut terhapus) |
