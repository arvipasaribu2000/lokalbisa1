# Panduan Deploy Backend LOKALBISA

Backend ini punya 3 fitur, dan **masing-masing independen** — kamu bisa aktifkan satu per satu,
tidak harus sekaligus semua. Kalau env var suatu fitur belum di-set, endpoint terkait cuma balas
`501` dengan pesan jelas (server tidak crash, dan fitur lain tetap jalan normal).

| Fitur | Wajib env var | Biaya |
|---|---|---|
| AI Compliance Guide (Claude) | `ANTHROPIC_API_KEY` | Bayar per token, cek console.anthropic.com |
| OTP WhatsApp | `FONNTE_TOKEN` + `FIREBASE_SERVICE_ACCOUNT` | Fonnte ada paket gratis terbatas, lalu berbayar |
| Sinkronisasi lintas device | `FIREBASE_SERVICE_ACCOUNT` | Firestore gratis sampai kuota cukup besar (Spark plan) |

---

## 1. Setup Anthropic API Key (untuk AI Compliance)
1. Buka [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Simpan key-nya (format `sk-ant-api03-...`)

## 2. Setup Firebase/Firestore (untuk OTP & Sync)
1. Buka [console.firebase.google.com](https://console.firebase.google.com) → buat project baru (boleh pakai project GCP yang sama dengan Cloud Run)
2. Firestore Database → Create Database → mode production, region asia-southeast2 (Jakarta)
3. Project Settings ⚙️ → Service Accounts → **Generate new private key** → download `service-account.json`
4. **JANGAN commit file ini ke GitHub!** (sudah ada di `.gitignore`)

## 3. Setup Fonnte (untuk OTP WhatsApp)
1. Daftar di [fonnte.com](https://fonnte.com)
2. Hubungkan nomor WhatsApp kamu (scan QR, sama seperti WhatsApp Web)
3. Ambil token dari dashboard → Device → Token

## 4. Deploy ke Cloud Run

Install & login gcloud CLI dulu kalau belum:
```bash
gcloud auth login
gcloud config set project NAMA_PROJECT_GCP_KAMU
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

Lalu jalankan salah satu dari `backend/`:

**Cuma AI Compliance dulu:**
```bash
bash deploy.sh sk-ant-api03-XXXXXX
```

**Lengkap (AI Compliance + OTP + Sync):**
```bash
bash deploy.sh sk-ant-api03-XXXXXX YOUR_FONNTE_TOKEN ./service-account.json
```

Setelah selesai, gcloud akan menampilkan URL Cloud Run kamu, contoh:
```
https://lokalbisa-backend-abc123-as.a.run.app
```

## 5. Cek fitur mana yang aktif
Buka URL Cloud Run kamu langsung di browser (root `/`), akan muncul:
```json
{
  "service": "LOKALBISA Backend",
  "status": "ok",
  "features": { "aiCompliance": true, "whatsappOtp": true, "firestoreSync": true }
}
```
Kalau ada yang `false`, cek lagi env var terkait di Cloud Run Console → service kamu → Edit & Deploy New Revision → Variables & Secrets.

## 6. Hubungkan ke Frontend

### AI Compliance (index.html)
Cari baris ini di `index.html`:
```js
const LOKALBISA_API_URL = '';
```
Ganti jadi:
```js
const LOKALBISA_API_URL = 'https://lokalbisa-backend-abc123-as.a.run.app/api/compliance';
```

### OTP WhatsApp & Sync
Endpoint sudah siap dipakai:
- `POST /api/otp/send` — body `{ "phone": "081234567890" }`
- `POST /api/otp/verify` — body `{ "phone": "081234567890", "code": "123456" }`
- `POST /api/sync/user` — body `{ "phone": "081234567890", "data": { ...semua state localStorage... } }`
- `GET /api/sync/user/081234567890`

Ini **belum dihubungkan otomatis** ke `index.html` (supaya tidak mengubah alur/tampilan yang sudah
kamu approve). Kalau kamu mau saya bantu wiring form registrasi & login supaya benar-benar
memanggil endpoint ini (tetap tanpa mengubah tampilan, cuma logic di baliknya), tinggal bilang —
saya siapkan sebagai langkah terpisah supaya lebih mudah kamu review satu-satu.

## 7. Update CORS (penting sebelum submit final!)
Di `server.js`, baris:
```js
app.use(cors());
```
Untuk produksi, ganti jadi (biar backend cuma bisa diakses dari domain PWA kamu):
```js
app.use(cors({ origin: 'https://arvipasaribu2000.github.io' }));
```

## Estimasi Biaya (skala kecil, demo kompetisi)
- Cloud Run: gratis sampai 2 juta request/bulan (tier gratis GCP)
- Claude API: ~$0.003–0.015 per pertanyaan tergantung panjang jawaban
- Fonnte: paket gratis biasanya 1000 pesan pertama, cek harga terbaru di fonnte.com
- Firestore: gratis sampai 50rb read + 20rb write/hari (Spark plan)

Untuk demo/pitch semifinal, semua ini realistis tetap di tier gratis.
