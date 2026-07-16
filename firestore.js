/**
 * Inisialisasi Firestore — graceful degradation.
 * Kalau FIREBASE_SERVICE_ACCOUNT (JSON, base64-encoded) belum di-set,
 * modul ini export `null` dan server.js akan otomatis menonaktifkan
 * fitur OTP & Sync (bukan crash).
 *
 * Cara isi FIREBASE_SERVICE_ACCOUNT (lihat juga DEPLOY.md):
 *   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. base64 -w0 service-account.json   (Linux/Mac: base64 -i service-account.json | tr -d '\n')
 *   3. Simpan hasilnya sebagai secret di Cloud Run (JANGAN commit file json ke repo!)
 */
let db = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
    );
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    db = admin.firestore();
    console.log('✅ Firestore terhubung:', serviceAccount.project_id);
  } catch (err) {
    console.error('⚠️  Gagal inisialisasi Firestore:', err.message);
    db = null;
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT tidak di-set — fitur OTP & Sync nonaktif.');
}

module.exports = db;
