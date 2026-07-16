# LOKALBISA — File Final Semifinal PIDI DIGDAYA 2026

## Struktur File
```
lokalbisa/
├── index.html          ← App utama (push ke root GitHub repo)
├── manifest.json       ← PWA manifest
├── sw.js               ← Service worker offline
├── icons/              ← Icon PWA semua ukuran (72–512px)
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
├── backend/
│   ├── server.js       ← Backend Node.js (AI Compliance Claude API)
│   ├── package.json
│   ├── Dockerfile
│   ├── deploy.sh       ← Script deploy Cloud Run 1 perintah
│   └── DEPLOY.md       ← Panduan lengkap deploy
├── PITCH_SEMIFINAL.md  ← Script pitch + antisipasi pertanyaan juri
└── README.md           ← File ini
```

## Deploy ke GitHub Pages
1. Extract ZIP ini
2. Push SEMUA file (termasuk folder icons/ dan sw.js) ke root repo lokalbisa1
3. Pastikan GitHub Pages aktif di Settings → Pages → Branch: main / root

## Deploy Backend (AI Compliance, OTP WhatsApp, Sync) — ✅ SUDAH ADA DI REPO INI
Folder `backend/` sudah lengkap: `server.js`, `firestore.js`, `Dockerfile`, `deploy.sh`, `package.json`,
`.env.example`, dan `DEPLOY.md` (panduan step-by-step lengkap ada di sana).

Backend ini punya 3 fitur independen (bisa diaktifkan satu-satu):
- **AI Compliance Guide generatif** (Claude API) — butuh `ANTHROPIC_API_KEY`
- **OTP WhatsApp** (via Fonnte) — butuh `FONNTE_TOKEN` + `FIREBASE_SERVICE_ACCOUNT`
- **Sinkronisasi data lintas perangkat** (Firestore) — butuh `FIREBASE_SERVICE_ACCOUNT`

Kalau env var suatu fitur belum di-set, endpoint terkait otomatis nonaktif (balas 501 yang jelas,
bukan crash) — dan frontend tetap jalan normal pakai knowledge base lokal seperti sekarang.

Deploy cepat:
```bash
cd backend
bash deploy.sh sk-ant-api03-XXXXXX   # AI Compliance saja
# atau lengkap:
bash deploy.sh sk-ant-api03-XXXXXX YOUR_FONNTE_TOKEN ./service-account.json
```
Baca **`backend/DEPLOY.md`** untuk panduan lengkap (setup Firebase, Fonnte, cek fitur aktif, dst).

Setelah dapat URL Cloud Run, isi di `index.html`:
```js
const BACKEND_BASE_URL = 'https://<URL-KAMU>.run.app';
```
Satu variabel ini otomatis mengaktifkan **4 fitur sekaligus**: AI Compliance generatif, OTP WhatsApp
saat registrasi, sinkronisasi data ke Firestore, dan Login Sidik Jari. Selama variabel ini kosong,
aplikasi berjalan 100% seperti sekarang (localStorage saja) — tidak ada perubahan perilaku.

**Sudah di-wiring ke frontend (bukan cuma endpoint doang):**
- ✅ Registrasi → kirim OTP ke WhatsApp → verifikasi kode → baru akun dibuat. Kalau backend/OTP
  gagal dihubungi, otomatis fallback lanjut daftar tanpa verifikasi (tidak mengunci user).
- ✅ Login & auto-login sesi lama → otomatis `syncPull()`, mengisi data dari Firestore HANYA
  kalau device ini belum punya data (device baru/ganti HP). Tidak pernah menimpa data lokal yang sudah ada.
- ✅ Setelah ERS selesai, EOI terkirim, edit profil, atau update dokumen → otomatis `syncPush()`
  ke Firestore di background (debounced, gagal pun tidak mengganggu UI).
- ✅ Setelah login/registrasi berhasil → muncul prompt aktifkan Login Sidik Jari (WebAuthn asli,
  bukan simulasi). Login berikutnya bisa tap sidik jari, tanpa ketik password.

## Setup Login Sidik Jari (WebAuthn) — Langkah demi Langkah

1. **Deploy backend dengan parameter RP_ID** (domain PWA kamu tanpa `https://` dan tanpa path):
   ```bash
   cd backend
   bash deploy.sh sk-ant-api03-XXXXXX YOUR_FONNTE_TOKEN ./service-account.json arvipasaribu2000.github.io
   ```
2. Isi `BACKEND_BASE_URL` di `index.html` dengan URL Cloud Run yang muncul, commit & push.
3. Buka PWA di HP (harus **HTTPS**, GitHub Pages sudah otomatis HTTPS ✅) dan **install sebagai PWA**
   (biometrik paling stabil jalan di app yang sudah ter-install, bukan tab browser biasa).
4. **Daftar akun baru** (atau login pakai akun lama).
5. Setelah masuk ke Beranda, akan muncul prompt "👆 Aktifkan Login Sidik Jari?" — tap **Aktifkan Sekarang**,
   lalu ikuti instruksi sensor sidik jari/Face ID di device kamu.
6. Logout, lalu coba login lagi — sekarang ada tombol **"👆 Masuk dengan Sidik Jari"** di bawah tombol Masuk biasa.

**Kalau tombol sidik jari tidak muncul, cek:**
- `BACKEND_BASE_URL` sudah diisi dan bisa diakses (buka URL-nya langsung, harus muncul JSON status)
- Device kamu punya sensor biometrik aktif (cek di pengaturan HP, coba unlock HP pakai sidik jari dulu)
- Diakses lewat HTTPS (WebAuthn tidak jalan di HTTP biasa, kecuali localhost)
- `GET /` di URL backend kamu — field `biometricLogin` harus `true`

**Catatan keamanan:** ini WebAuthn asli (bukan simulasi) — pakai crypto public-key standar yang sama
dipakai Google/Apple/perbankan. Server tidak pernah menyimpan sidik jari kamu; yang disimpan cuma
public key hasil verifikasi, sidik jari fisiknya tetap cuma ada di chip keamanan device kamu.

## Fitur yang Sudah Jalan
✅ Auth register/login dengan SHA-256 hash (tidak simpan plain text)
✅ Password strength indicator real-time
✅ Lupa password — verifikasi nomor WA + nama, reset password lokal
✅ Login Sidik Jari (WebAuthn) — untuk user terdaftar, login berikutnya tanpa ketik password
✅ Kotak Notifikasi nyata — muncul otomatis saat ERS selesai, EOI terkirim, akun dibuat (bukan toast statis)
✅ ERS (Export Readiness Score) 4 langkah + radar chart
✅ AI Roadmap Generator — roadmap ERS dipersonalisasi AI (kategori produk, negara, skor per dimensi); fallback ke roadmap statis kalau backend nonaktif
✅ Dashboard Dampak — statistik agregat platform (total UMKM, rata-rata skor ERS, EOI terkirim, sebaran kesiapan) untuk investor/juri
✅ AI Compliance Guide — 8 negara, multi-turn, knowledge base lokal (siap upgrade ke backend AI generatif)
✅ Smart Buyer Matching — 24 buyer dari 12 negara
✅ Filter buyer: Semua / Makanan / Fashion / Kerajinan / Halal / Organik / Furnitur / Kosmetik / Digital
✅ PWA installable, service worker cache-first + network-first + update detection
✅ Bottom nav pakai SVG icon (konsisten di semua device, bukan emoji OS-dependent)
✅ localStorage persistence (profil, ERS, EOI, dokumen, notifikasi)

## Diketahui Belum Ada (roadmap)
- ⏳ Backend belum di-*deploy* — kode & wiring frontend sudah lengkap, tinggal jalankan `deploy.sh`
  dan isi `BACKEND_BASE_URL` di `index.html` (lihat `backend/DEPLOY.md`)
- ⏳ Dashboard Dampak masih hitung on-the-fly dari Firestore (cache 5 menit) — untuk skala ribuan
  user, pertimbangkan snapshot berkala ke collection terpisah biar makin ringan
- ⏳ Sisi/portal khusus untuk buyer internasional (saat ini data buyer masih statis/seed)
