// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIG — LOKALBISA
// Project: lokalbisa-ea203
// ═══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyB_0_6bkXssN9a2eF8mbZVcqw2uS8Dr1F4",
  authDomain: "lokalbisa-ea203.firebaseapp.com",
  projectId: "lokalbisa-ea203",
  storageBucket: "lokalbisa-ea203.firebasestorage.app",
  messagingSenderId: "884289530754",
  appId: "1:884289530754:web:810f36fbead24430997d9b"
};

firebase.initializeApp(firebaseConfig);

// Dipakai global oleh index.html
const auth = firebase.auth();
const db = firebase.firestore();

// Opsional tapi disarankan: biar app tetap bisa dipakai (baca data yang sudah
// pernah dimuat) walau koneksi internet putus sebentar — cocok dengan fitur PWA offline.
db.enablePersistence().catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence gagal: buka di banyak tab sekaligus.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence tidak didukung browser ini.');
  }
});
