#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Deploy LOKALBISA backend ke Google Cloud Run — 1 perintah.
#
# Pemakaian:
#   bash deploy.sh <ANTHROPIC_API_KEY> [FONNTE_TOKEN] [FIREBASE_SERVICE_ACCOUNT_JSON_PATH] [RP_ID]
#
# Contoh (cuma AI Compliance dulu, fitur lain nanti):
#   bash deploy.sh sk-ant-api03-XXXXXX
#
# Contoh (lengkap, semua fitur termasuk OTP, Sync, & Login Sidik Jari):
#   bash deploy.sh sk-ant-api03-XXXXXX YOUR_FONNTE_TOKEN ./service-account.json arvipasaribu2000.github.io
#
# RP_ID = domain PWA kamu TANPA https:// dan TANPA path (wajib untuk Login Sidik Jari/WebAuthn)
#
# Prasyarat:
#   - gcloud CLI sudah terinstall & login (gcloud auth login)
#   - Project GCP sudah dibuat & billing aktif
#   - Cloud Run API & Cloud Build API sudah diaktifkan:
#       gcloud services enable run.googleapis.com cloudbuild.googleapis.com
# ═══════════════════════════════════════════════════════════
set -e

ANTHROPIC_KEY="${1:?❌ Wajib isi ANTHROPIC_API_KEY sebagai argumen pertama. Lihat komentar di atas untuk contoh pemakaian.}"
FONNTE_TOKEN="${2:-}"
FIREBASE_JSON_PATH="${3:-}"
RP_ID="${4:-}"

SERVICE_NAME="lokalbisa-backend"
REGION="asia-southeast2"   # Jakarta — paling dekat ke target user UMKM Indonesia

echo "🚀 Deploy $SERVICE_NAME ke Cloud Run (region: $REGION)..."

ENV_VARS="ANTHROPIC_API_KEY=${ANTHROPIC_KEY}"
if [ -n "$FONNTE_TOKEN" ]; then
  ENV_VARS="${ENV_VARS},FONNTE_TOKEN=${FONNTE_TOKEN}"
fi
if [ -n "$FIREBASE_JSON_PATH" ]; then
  if [ ! -f "$FIREBASE_JSON_PATH" ]; then
    echo "❌ File service account tidak ditemukan: $FIREBASE_JSON_PATH"
    exit 1
  fi
  FIREBASE_B64=$(base64 -w0 "$FIREBASE_JSON_PATH" 2>/dev/null || base64 "$FIREBASE_JSON_PATH" | tr -d '\n')
  ENV_VARS="${ENV_VARS},FIREBASE_SERVICE_ACCOUNT=${FIREBASE_B64}"
fi
if [ -n "$RP_ID" ]; then
  ENV_VARS="${ENV_VARS},RP_ID=${RP_ID},RP_ORIGIN=https://${RP_ID},RP_NAME=LOKALBISA"
fi

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "$ENV_VARS"

echo ""
echo "✅ Selesai! Cek URL layanan di atas (format: https://lokalbisa-backend-xxxxx-as.a.run.app)"
echo ""
echo "Langkah selanjutnya:"
echo "1. Copy URL Cloud Run yang muncul di atas"
echo "2. Buka index.html, cari baris:"
echo "   const BACKEND_BASE_URL = '';"
echo "   Isi jadi:"
echo "   const BACKEND_BASE_URL = 'https://<URL-KAMU>.run.app';"
echo "3. Commit & push index.html ke GitHub Pages"
echo "4. Tes: buka https://<URL-KAMU>.run.app/  → harus muncul JSON status fitur"
