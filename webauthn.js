/**
 * WebAuthn (Login Sidik Jari / Face ID) — logika lengkap di sini.
 * Dipakai oleh 4 endpoint di server.js: register/options, register/verify,
 * login/options, login/verify.
 *
 * PENTING soal identitas: app ini TIDAK punya sistem akun server-side
 * (password login sepenuhnya di localStorage client). Jadi kredensial WebAuthn
 * di sini diikat ke NOMOR WHATSAPP sebagai identifier, dan profil yang
 * dikembalikan saat login sidik jari diambil dari koleksi `users` di Firestore
 * (diisi otomatis oleh syncPush() di frontend setelah registrasi/login pertama).
 * Artinya: user harus sudah pernah sync minimal 1x (otomatis terjadi kalau
 * BACKEND_BASE_URL sudah aktif saat registrasi) sebelum bisa daftarkan sidik jari.
 */
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_NAME = process.env.RP_NAME || 'LOKALBISA';
const RP_ID = process.env.RP_ID || '';       // contoh: 'arvipasaribu2000.github.io'
const RP_ORIGIN = process.env.RP_ORIGIN || ''; // contoh: 'https://arvipasaribu2000.github.io'

function configured() {
  return !!(RP_ID && RP_ORIGIN);
}

function challengeRef(db, phone) { return db.collection('webauthn_challenges').doc(phone); }
function credRef(db, phone) { return db.collection('webauthn_credentials').doc(phone); }

async function getRegistrationOptions(db, phone) {
  const existing = await credRef(db, phone).get();
  const existingCreds = existing.exists ? (existing.data().credentials || []) : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: phone,
    userDisplayName: phone,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // wajib sensor di device (sidik jari/Face ID), bukan security key eksternal
      userVerification: 'required',
      residentKey: 'preferred',
    },
    excludeCredentials: existingCreds.map(c => ({ id: c.id, transports: c.transports })),
  });

  await challengeRef(db, phone).set({ challenge: options.challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
  return options;
}

async function verifyRegistration(db, phone, response) {
  const snap = await challengeRef(db, phone).get();
  if (!snap.exists) throw new Error('Sesi pendaftaran sidik jari kedaluwarsa, coba lagi');
  const { challenge, expiresAt } = snap.data();
  if (Date.now() > expiresAt) { await challengeRef(db, phone).delete(); throw new Error('Sesi kedaluwarsa, coba lagi'); }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('Verifikasi sidik jari gagal');

  const { credential } = verification.registrationInfo;
  const existing = await credRef(db, phone).get();
  const list = existing.exists ? (existing.data().credentials || []) : [];
  list.push({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports || [],
    createdAt: Date.now(),
  });
  await credRef(db, phone).set({ credentials: list });
  await challengeRef(db, phone).delete();
  return true;
}

async function getAuthenticationOptions(db, phone) {
  const snap = await credRef(db, phone).get();
  if (!snap.exists || !(snap.data().credentials || []).length) {
    throw new Error('Belum ada sidik jari terdaftar untuk nomor ini');
  }
  const creds = snap.data().credentials;

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports })),
  });

  await challengeRef(db, phone).set({ challenge: options.challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
  return options;
}

async function verifyAuthentication(db, phone, response) {
  const challengeSnap = await challengeRef(db, phone).get();
  if (!challengeSnap.exists) throw new Error('Sesi login kedaluwarsa, coba lagi');
  const { challenge, expiresAt } = challengeSnap.data();
  if (Date.now() > expiresAt) { await challengeRef(db, phone).delete(); throw new Error('Sesi kedaluwarsa, coba lagi'); }

  const credSnap = await credRef(db, phone).get();
  if (!credSnap.exists) throw new Error('Kredensial tidak ditemukan');
  const creds = credSnap.data().credentials || [];
  const matched = creds.find(c => c.id === response.id);
  if (!matched) throw new Error('Sidik jari tidak dikenali untuk nomor ini');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: matched.id,
      publicKey: Buffer.from(matched.publicKey, 'base64url'),
      counter: matched.counter,
      transports: matched.transports,
    },
  });
  if (!verification.verified) throw new Error('Verifikasi sidik jari gagal');

  // Update counter (proteksi replay/kloning authenticator)
  matched.counter = verification.authenticationInfo.newCounter;
  await credRef(db, phone).set({ credentials: creds });
  await challengeRef(db, phone).delete();
  return true;
}

module.exports = {
  configured,
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
};
