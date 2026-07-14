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

## Deploy Backend (AI Compliance Guide) — ⚠️ BELUM ADA DI REPO INI
> **Catatan penting:** folder `backend/` (server.js, Dockerfile, deploy.sh) yang disebut di struktur file
> di atas **belum ter-push** ke repo `lokalbisa1` ini — repo saat ini hanya berisi file frontend
> (index.html, script.js, sw.js, manifest.json, icons). Selama backend belum di-deploy dan
> di-hubungkan, AI Compliance Guide otomatis berjalan memakai **knowledge base lokal**
> (jawaban regulasi ekspor 8 negara yang sudah ditulis manual di `index.html`) — bukan LLM live.
> Ini tetap berfungsi baik untuk demo, hanya tidak generatif/dinamis.

Untuk mengaktifkan mode AI generatif (opsional):
```bash
cd backend
bash deploy.sh sk-ant-api03-XXXXXX   # ganti dengan API key Anthropic kamu
```
Setelah selesai, copy URL Cloud Run → isi di `index.html` pada baris:
```js
const LOKALBISA_API_URL = ''; // isi dengan URL Cloud Run kamu
```
Lalu push ulang `index.html` ke GitHub. Selama variabel ini kosong, aplikasi **tidak** akan
mencoba fetch ke URL placeholder (menghindari delay/label "offline" yang membingungkan saat demo).

## Fitur yang Sudah Jalan
✅ Auth register/login dengan SHA-256 hash (tidak simpan plain text)
✅ Password strength indicator real-time
✅ Lupa password — verifikasi nomor WA + nama, reset password lokal
✅ ERS (Export Readiness Score) 4 langkah + radar chart
✅ AI Compliance Guide — 8 negara, multi-turn, knowledge base lokal (siap upgrade ke backend AI generatif)
✅ Smart Buyer Matching — 24 buyer dari 12 negara
✅ Filter buyer: Semua / Makanan / Fashion / Kerajinan / Halal / Organik / Furnitur / Kosmetik / Digital
✅ PWA installable, service worker cache-first + network-first + update detection
✅ Bottom nav pakai SVG icon (konsisten di semua device, bukan emoji OS-dependent)
✅ localStorage persistence (profil, ERS, EOI, dokumen, notifikasi)

## Diketahui Belum Ada (roadmap)
- ⏳ Backend nyata (Firestore/Cloud Run) — saat ini semua data tersimpan di localStorage per-device,
  belum sinkron antar perangkat
- ⏳ Verifikasi OTP WhatsApp saat registrasi (saat ini hanya validasi format nomor)
- ⏳ Sisi/portal khusus untuk buyer internasional (saat ini data buyer masih statis/seed)
