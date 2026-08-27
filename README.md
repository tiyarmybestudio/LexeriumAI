# Lexerium AI

Struktur proyek lengkap: server `http` native (bukan Express), MongoDB, login Google, upload foto/gambar ke AI, chat suara, dan jawaban khusus untuk pertanyaan "siapa pencipta kamu".

## Struktur folder

```
lexerium-ai/
├── server.js           # Server utama + semua routing (/, /api/auth/*, /api/chat, /api/user/avatar)
├── ai.js                # Panggilan ke AI (teks & gambar) + override jawaban kata kunci
├── db.js                # Koneksi MongoDB
├── auth.js               # Verifikasi Google login + sesi JWT
├── models/
│   ├── User.js           # Skema user MongoDB
│   └── Message.js        # Skema riwayat chat MongoDB
├── utils/
│   └── cookies.js        # Helper cookie manual (server tidak pakai Express)
├── public/
│   └── index.html        # Frontend (chat UI, profil, login, upload foto, mic)
├── package.json
└── .env.example
```

## 1. Install dependency

```bash
cd lexerium-ai
npm install
```

## 2. Setup environment

```bash
cp .env.example .env
```

Isi `.env`:
- `MONGODB_URI` — connection string MongoDB (Atlas atau lokal).
- `GOOGLE_CLIENT_ID` — lihat langkah di bawah.
- `JWT_SECRET` — string acak panjang, bebas (contoh: hasil `openssl rand -hex 32`).
- `AI_TEXT_MODEL` / `AI_VISION_MODEL` — sesuaikan dengan model yang tersedia di provider AI kamu.

## 3. Setup Google Login

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project.
2. **APIs & Services > OAuth consent screen** → isi info dasar aplikasi.
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID** → tipe **Web application**.
4. Di **Authorized JavaScript origins**, tambahkan `http://localhost:3000` (dev) dan domain production kamu.
5. Salin Client ID, tempel ke `.env` (`GOOGLE_CLIENT_ID`) **dan** ke `public/index.html`, cari baris:
   ```js
   const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
   ```

## 4. Jalankan

```bash
npm start
```

Buka `http://localhost:3000`.

## Fitur yang sudah aktif

| Fitur | Keterangan |
|---|---|
| Ganti avatar dari galeri | Tombol pensil di foto profil, tersimpan ke MongoDB jika sudah login |
| Bar ubah username | Sudah diperbaiki agar tombol Save tidak overflow |
| Limit 3 pesan untuk tamu | Ditegakkan **di server** lewat cookie httpOnly (`lx_guest_count`), bukan cuma di browser |
| Login Google + MongoDB | User baru otomatis dibuat di koleksi `users` saat login pertama |
| Kirim foto ke AI | Tombol klip di sebelah kotak chat → gambar dikirim sebagai base64 ke model vision |
| Chat suara | Tombol mic memakai **Web Speech API** browser untuk transkrip suara → teks, lalu dikirim seperti chat biasa. Hanya berjalan optimal di browser berbasis Chromium (Chrome/Edge) |
| Jawaban khusus "siapa penciptamu" | Dicek di `ai.js` sebelum memanggil AI eksternal — jawaban tetap, tidak melalui model AI |
| Sidebar riwayat chat | Klik logo Lexerium di header → daftar percakapan lama dikelompokkan per tanggal (Hari ini/Kemarin/dst), + tombol "Percakapan baru" |
| Menu Akun | Di Profil → Akun. Tamu bisa langsung login (tanpa nunggu limit 3x); user login bisa Ganti akun, Logout, atau Hapus akun |
| Hapus akun | Menghapus user + semua percakapan & pesannya dari MongoDB, supaya sesi tidak menumpuk |
| Gambar AI kustom | Isi `LEXERIUM_AI_AVATAR_URL` di `public/index.html` (dekat awal `<script>`) dengan link Catbox kamu — otomatis dipakai untuk logo header, ikon welcome, dan avatar AI di chat |

## Catatan penting

- **TEMPEL LINK CATBOX**: cari `LEXERIUM_AI_AVATAR_URL` di `public/index.html` dan isi dengan link gambar Catbox kamu. Selama masih kosong, semua tempat itu tetap pakai logo placeholder.
- **Model vision**: `AI_VISION_MODEL` di `.env` harus benar-benar model yang mendukung gambar di provider kamu (rewind.ai). Cek dokumentasi provider — kalau modelnya tidak mendukung gambar, endpoint akan mengembalikan error saat pesan berisi foto dikirim.
- **Riwayat chat** disimpan per percakapan (koleksi `Conversation` + `Message`) hanya untuk user yang **sudah login**. Tamu tidak punya riwayat tersimpan (sidebar akan menampilkan pesan ajakan login).
- **Ganti akun** melakukan logout diam-diam lalu membuka modal login lagi dengan `disableAutoSelect()` supaya Google menampilkan pemilih akun, bukan auto-login ke akun yang sama.
- **Kata kunci pemicu** jawaban pencipta ada di `ai.js` (`CREATOR_TRIGGERS`) — tambahkan variasi kalimat lain di situ kalau perlu.
- Untuk production, jalankan di belakang HTTPS (mis. lewat Nginx/reverse proxy) supaya cookie `Secure` berfungsi dan Google Sign-In berjalan normal.
# LexeriumAI
