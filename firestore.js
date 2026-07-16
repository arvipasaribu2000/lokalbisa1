/**
 * Inisialisasi Firestore — graceful degradation, mendukung 2 cara isi kredensial:
 *
 *   CARA 1 (Render.com, atau platform dengan "Secret Files"):
 *   Upload file service-account.json apa adanya lewat fitur Secret File,
 *   lalu set FIREBASE_SERVICE_ACCOUNT_PATH ke path filenya (Render otomatis
 *   kasih tahu path-nya, biasanya /etc/secrets/nama-file.json).
 *
 *   CARA 2 (Cloud Run, atau platform tanpa Secret Files):
 *   base64-encode isi file JSON, simpan sebagai env var FIREBASE_SERVICE_ACCOUNT.
 *   Cara generate: base64 -w0 service-account.json (lihat DEPLOY.md)
 *
 * Kalau keduanya tidak di-set, modul ini export `null` dan server.js otomatis
 * menonaktifkan fitur OTP & Sync (bukan crash).
 */
let db = null;

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'));
  }
  return null;
}

try {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    db = admin.firestore();
    console.log('✅ Firestore terhubung:', serviceAccount.project_id);
  } else {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_PATH tidak di-set — fitur OTP & Sync nonaktif.');
  }
} catch (err) {
  console.error('⚠️  Gagal inisialisasi Firestore:', err.message);
  db = null;
}

module.exports = db;
