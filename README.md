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

## Deploy Backend (AI Compliance Guide)
```bash
cd backend
bash deploy.sh sk-ant-api03-XXXXXX   # ganti dengan API key Anthropic kamu
```
Setelah selesai, copy URL Cloud Run → ganti di index.html baris:
const LOKALBISA_API_URL = 'https://YOUR-BACKEND-URL.run.app/api/compliance';
Lalu push ulang index.html ke GitHub.

## Fitur yang Sudah Jalan
✅ Auth register/login dengan SHA-256 hash (tidak simpan plain text)
✅ Password strength indicator real-time
✅ ERS (Export Readiness Score) 4 langkah + radar chart
✅ AI Compliance Guide — 8 negara, multi-turn, fallback offline
✅ Smart Buyer Matching — 24 buyer dari 12 negara
✅ Filter buyer: Semua / Makanan / Fashion / Kerajinan / Halal / Organik / Furnitur / Kosmetik / Digital
✅ PWA installable + offline banner
✅ Service worker cache + update detection
✅ localStorage persistence (profil, ERS, EOI)
