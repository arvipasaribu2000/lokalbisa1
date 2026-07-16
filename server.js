/**
 * LOKALBISA Backend — Cloud Run
 * ─────────────────────────────
 * 3 fitur utama:
 *   1. POST /api/compliance   → AI Compliance Guide beneran (Claude API)
 *   2. POST /api/otp/send
 *      POST /api/otp/verify   → OTP WhatsApp (via Fonnte)
 *   3. POST /api/sync/user
 *      GET  /api/sync/user/:phone → Sinkronisasi data lintas perangkat (Firestore)
 *
 * Semua fitur BERSIFAT OPSIONAL & GRACEFUL: kalau env var terkait tidak
 * di-set, endpoint akan balas 501 dengan pesan jelas — tidak bikin server crash.
 * Ini penting supaya kamu bisa deploy bertahap (misal: aktifkan AI Compliance
 * dulu, OTP & Firestore menyusul).
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors()); // untuk produksi, ganti origin:'*' dengan domain GitHub Pages kamu (lihat DEPLOY.md)
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8080;

/* ═══════════════════════════════════════════
   RATE LIMITING SEDERHANA (in-memory, per IP)
   Cukup untuk demo/kompetisi. Untuk produksi
   nyata, pakai Cloud Armor atau express-rate-limit + Redis.
═══════════════════════════════════════════ */
const rateBuckets = new Map();
function rateLimit(maxPerMinute) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const now = Date.now();
    const bucket = rateBuckets.get(ip) || [];
    const recent = bucket.filter(t => now - t < 60000);
    if (recent.length >= maxPerMinute) {
      return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar lagi.' });
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    next();
  };
}

/* ═══════════════════════════════════════════
   1. AI COMPLIANCE GUIDE — Claude API
═══════════════════════════════════════════ */
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const COMPLIANCE_SYSTEM_PROMPT = `Kamu adalah AI Compliance Guide di LOKALBISA, asisten regulasi ekspor untuk UMKM Indonesia
yang baru mulai atau sedang merintis ekspor produk ke luar negeri.

Format jawaban (pakai HTML sederhana: <br>, <b>, tidak usah markdown):
1. Mulai dengan 1-2 kalimat jawaban inti langsung ke poin pertanyaan.
2. <b>📄 Dokumen/Sertifikasi yang diperlukan</b> — daftar poin per poin, sebutkan instansi
   penerbitnya (mis. BPOM, MUI, Kemendag, Kementerian Pertanian, bea cukai negara tujuan).
3. <b>💰 Estimasi biaya & waktu</b> — kasih kisaran (boleh perkiraan, tegaskan itu perkiraan)
   supaya UMKM bisa merencanakan budget & timeline.
4. <b>⚠️ Yang sering jadi masalah</b> — 1-2 kesalahan umum UMKM pemula di area ini.
5. Tutup dengan saran langkah konkret berikutnya (actionable next step).

Aturan penting:
- Bahasa Indonesia santai tapi profesional, hindari jargon berlebihan — audiensnya UMKM kecil-menengah.
- Kalau tidak yakin 100% soal angka tarif/nomor peraturan spesifik, sampaikan itu perkiraan dan
  sarankan verifikasi ke instansi resmi (Kemendag, BPOM, MUI, atau bea cukai/otoritas negara tujuan).
- Jangan mengarang nomor peraturan, tanggal, atau nama pejabat yang tidak yakin kebenarannya.
- Kalau pertanyaan di luar topik ekspor/regulasi/UMKM, arahkan balik dengan sopan ke topik yang bisa kamu bantu.
- Manfaatkan riwayat percakapan sebelumnya (kalau ada) supaya jawaban nyambung, tidak mengulang dari nol.`;

app.post('/api/compliance', rateLimit(20), async (req, res) => {
  if (!anthropic) {
    return res.status(501).json({
      error: 'ANTHROPIC_API_KEY belum di-set di Cloud Run. AI Compliance backend belum aktif — ' +
             'frontend akan otomatis pakai knowledge base lokal sebagai fallback.'
    });
  }
  try {
    const { question, country, history = [] } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Field "question" wajib diisi' });
    }
    if (question.length > 2000) {
      return res.status(400).json({ error: 'Pertanyaan terlalu panjang (maks 2000 karakter)' });
    }

    // Susun riwayat percakapan (maks 10 turn terakhir biar konteks lebih kaya, tetap hemat token)
    const messages = history.slice(-10).map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content || '').slice(0, 2000)
    }));
    messages.push({
      role: 'user',
      content: `Negara tujuan ekspor: ${country || 'belum ditentukan'}\n\nPertanyaan: ${question}`
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', // cek model terbaru di console.anthropic.com jika perlu upgrade
      max_tokens: 1500,
      temperature: 0.4,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    res.json({
      text: text.replace(/\n/g, '<br>'),
      cite: 'AI Compliance Guide LOKALBISA · Claude AI',
      confidence: 90
    });
  } catch (err) {
    console.error('Compliance API error:', err.message);
    res.status(502).json({ error: 'Gagal menghubungi Claude API: ' + err.message });
  }
});

/* ═══════════════════════════════════════════
   1b. AI ROADMAP GENERATOR — personalisasi roadmap ERS pakai Claude
   (melengkapi roadmap statis yang sudah ada di frontend, bukan menggantikan —
   kalau endpoint ini gagal/nonaktif, frontend tetap tampilkan roadmap statis)
═══════════════════════════════════════════ */
const ROADMAP_SYSTEM_PROMPT = `Kamu adalah AI Export Advisor di LOKALBISA. Tugasmu: berdasarkan hasil
Export Readiness Score (ERS) UMKM, buatkan roadmap perbaikan yang DIPERSONALISASI — bukan generik.

WAJIB balas HANYA dalam format JSON valid (tanpa markdown fence, tanpa teks lain di luar JSON), dengan struktur persis:
{
  "summary": "1-2 kalimat ringkasan kondisi UMKM ini dan strategi utamanya",
  "steps": [
    { "period": "Minggu 1-4", "title": "...", "desc": "...", "badge": "Segera" }
  ]
}
Buat 4-6 steps, urutkan dari yang paling mendesak. "badge" salah satu dari: "Segera","3 Bulan","4 Bulan","6 Bulan","12 Bulan".
Personalisasi berdasarkan: kategori produk, negara tujuan, dimensi skor terendah (prioritaskan!), dan sertifikasi yang sudah/belum dimiliki.
Bahasa Indonesia santai-profesional, actionable, sebutkan instansi/platform konkret kalau relevan (BPOM, MUI, SNI, Alibaba, Etsy, dll).
Jangan mengarang angka biaya pasti — kalau kasih estimasi, tegaskan itu perkiraan.`;

app.post('/api/roadmap', rateLimit(10), async (req, res) => {
  if (!anthropic) {
    return res.status(501).json({ error: 'ANTHROPIC_API_KEY belum di-set — roadmap statis tetap dipakai.' });
  }
  try {
    const { category, country, scores, certs = [] } = req.body || {};
    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({ error: 'Field "scores" (dimensi ERS) wajib diisi' });
    }
    const scoreText = Object.entries(scores).map(([k, v]) => `${k}: ${v}/100`).join(', ');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      temperature: 0.5,
      system: ROADMAP_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Kategori produk: ${category || 'tidak disebutkan'}\nNegara tujuan: ${country || 'belum ditentukan'}\nSertifikasi yang sudah dimiliki: ${certs.join(', ') || 'belum ada'}\nSkor per dimensi ERS: ${scoreText}\n\nBuatkan roadmap personalisasi sesuai instruksi.`
      }]
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Format roadmap dari AI tidak valid');

    res.json(parsed);
  } catch (err) {
    console.error('Roadmap API error:', err.message);
    res.status(502).json({ error: 'Gagal generate roadmap AI: ' + err.message });
  }
});

/* ═══════════════════════════════════════════
   2. OTP WHATSAPP — via Fonnte
   (Fonnte dipilih karena gateway WA lokal Indonesia yang murah & simpel.
    Mau pakai Twilio WhatsApp API? Tinggal ganti isi sendWhatsAppOTP().)
═══════════════════════════════════════════ */
const db = require('./firestore'); // lihat firestore.js — null kalau belum dikonfigurasi

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}
function hashOtp(code, phone) {
  return crypto.createHash('sha256').update(code + ':' + phone + ':' + (process.env.OTP_SALT || 'lokalbisa')).digest('hex');
}

async function sendWhatsAppOTP(phone, code) {
  if (!process.env.FONNTE_TOKEN) {
    throw new Error('FONNTE_TOKEN belum di-set');
  }
  const message = `*LOKALBISA*\nKode verifikasi kamu: *${code}*\nBerlaku 5 menit. Jangan bagikan kode ini ke siapa pun.`;
  const params = new URLSearchParams({ target: phone, message });
  const resp = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      'Authorization': process.env.FONNTE_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  const data = await resp.json();
  if (data.status === false) throw new Error(data.reason || 'Fonnte gagal mengirim pesan');
  return data;
}

app.post('/api/otp/send', rateLimit(5), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi (lihat DEPLOY.md)' });
  if (!process.env.FONNTE_TOKEN) return res.status(501).json({ error: 'FONNTE_TOKEN belum di-set' });

  const { phone } = req.body || {};
  const phoneClean = String(phone || '').replace(/[\s-]/g, '');
  if (!/^(08|\+628)[0-9]{8,13}$/.test(phoneClean)) {
    return res.status(400).json({ error: 'Format nomor WhatsApp tidak valid' });
  }

  try {
    const code = generateOtpCode();
    await db.collection('otp_codes').doc(phoneClean).set({
      hash: hashOtp(code, phoneClean),
      attempts: 0,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now()
    });
    await sendWhatsAppOTP(phoneClean, code);
    res.json({ sent: true, message: 'Kode OTP dikirim via WhatsApp, berlaku 5 menit.' });
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(502).json({ error: 'Gagal mengirim OTP: ' + err.message });
  }
});

app.post('/api/otp/verify', rateLimit(10), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });

  const { phone, code } = req.body || {};
  const phoneClean = String(phone || '').replace(/[\s-]/g, '');
  if (!phoneClean || !code) return res.status(400).json({ error: 'phone dan code wajib diisi' });

  try {
    const ref = db.collection('otp_codes').doc(phoneClean);
    const snap = await ref.get();
    if (!snap.exists) return res.status(400).json({ verified: false, error: 'Kode tidak ditemukan, minta kode baru' });

    const data = snap.data();
    if (Date.now() > data.expiresAt) {
      await ref.delete();
      return res.status(400).json({ verified: false, error: 'Kode sudah kedaluwarsa, minta kode baru' });
    }
    if (data.attempts >= 5) {
      await ref.delete();
      return res.status(429).json({ verified: false, error: 'Terlalu banyak percobaan gagal, minta kode baru' });
    }
    if (data.hash !== hashOtp(code, phoneClean)) {
      await ref.update({ attempts: data.attempts + 1 });
      return res.status(400).json({ verified: false, error: 'Kode salah' });
    }

    await ref.delete();
    res.json({ verified: true });
  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).json({ error: 'Gagal verifikasi OTP: ' + err.message });
  }
});

/* ═══════════════════════════════════════════
   3. SINKRONISASI DATA — Firestore
   Menyimpan blob data user (profil, ERS, EOI, notifikasi) supaya
   bisa login dari perangkat lain dan datanya tetap ada.
   Skema sengaja generik (mirror localStorage) biar gampang dihubungkan
   ke frontend yang sudah ada tanpa perlu redesign besar-besaran.
═══════════════════════════════════════════ */
app.post('/api/sync/user', rateLimit(30), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  const { phone, data } = req.body || {};
  const phoneClean = String(phone || '').replace(/[\s-]/g, '');
  if (!phoneClean || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'phone dan data wajib diisi' });
  }
  try {
    await db.collection('users').doc(phoneClean).set(
      { ...data, updatedAt: Date.now() },
      { merge: true }
    );
    res.json({ synced: true });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: 'Gagal sinkronisasi: ' + err.message });
  }
});

app.get('/api/sync/user/:phone', rateLimit(30), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  const phoneClean = String(req.params.phone || '').replace(/[\s-]/g, '');
  try {
    const snap = await db.collection('users').doc(phoneClean).get();
    if (!snap.exists) return res.status(404).json({ error: 'Data tidak ditemukan' });
    res.json(snap.data());
  } catch (err) {
    console.error('Sync fetch error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data: ' + err.message });
  }
});

/* ═══════════════════════════════════════════
   3b. DASHBOARD DAMPAK — statistik agregat platform (untuk investor/juri)
   Dihitung on-the-fly dari koleksi `users` di Firestore. Untuk skala kecil
   (ratusan-ribuan user) ini cukup cepat; kalau nanti user sudah puluhan ribu,
   pertimbangkan cache hasil ini di collection terpisah yang di-update berkala.
═══════════════════════════════════════════ */
let statsCache = { data: null, expiresAt: 0 };
app.get('/api/stats/impact', rateLimit(20), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });

  // Cache 5 menit — dashboard dampak tidak perlu real-time detik-per-detik,
  // dan ini menghemat biaya baca Firestore kalau dashboard sering dibuka.
  if (statsCache.data && Date.now() < statsCache.expiresAt) {
    return res.json(statsCache.data);
  }

  try {
    const snap = await db.collection('users').get();
    let totalUsers = 0, totalErsSum = 0, totalErsCount = 0, totalEoi = 0;
    const categoryCount = {};
    const levelCount = { 'Siap Ekspor': 0, 'Perlu Sedikit Perbaikan': 0, 'Perlu Persiapan': 0, 'Belum Siap': 0 };

    snap.forEach(doc => {
      const d = doc.data();
      totalUsers++;
      if (d.user?.cat) categoryCount[d.user.cat] = (categoryCount[d.user.cat] || 0) + 1;
      if (d.ers) {
        const score = parseInt(d.ers);
        if (!isNaN(score)) {
          totalErsSum += score;
          totalErsCount++;
          if (score >= 80) levelCount['Siap Ekspor']++;
          else if (score >= 60) levelCount['Perlu Sedikit Perbaikan']++;
          else if (score >= 40) levelCount['Perlu Persiapan']++;
          else levelCount['Belum Siap']++;
        }
      }
      if (Array.isArray(d.eoi)) totalEoi += d.eoi.length;
    });

    const result = {
      totalUsers,
      avgErsScore: totalErsCount ? Math.round(totalErsSum / totalErsCount) : null,
      ersCompletedCount: totalErsCount,
      totalEoiSent: totalEoi,
      categoryBreakdown: categoryCount,
      readinessLevelBreakdown: levelCount,
      generatedAt: Date.now(),
    };
    statsCache = { data: result, expiresAt: Date.now() + 5 * 60 * 1000 };
    res.json(result);
  } catch (err) {
    console.error('Stats API error:', err.message);
    res.status(500).json({ error: 'Gagal menghitung statistik: ' + err.message });
  }
});

/* ═══════════════════════════════════════════
   4. LOGIN SIDIK JARI (WebAuthn) — untuk user yang sudah terdaftar
═══════════════════════════════════════════ */
const webauthn = require('./webauthn');

app.post('/api/webauthn/register/options', rateLimit(10), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  if (!webauthn.configured()) return res.status(501).json({ error: 'RP_ID/RP_ORIGIN belum di-set (lihat DEPLOY.md)' });
  const phoneClean = String(req.body?.phone || '').replace(/[\s-]/g, '');
  if (!phoneClean) return res.status(400).json({ error: 'phone wajib diisi' });
  try {
    const options = await webauthn.getRegistrationOptions(db, phoneClean);
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webauthn/register/verify', rateLimit(10), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  if (!webauthn.configured()) return res.status(501).json({ error: 'RP_ID/RP_ORIGIN belum di-set' });
  const phoneClean = String(req.body?.phone || '').replace(/[\s-]/g, '');
  if (!phoneClean || !req.body?.response) return res.status(400).json({ error: 'phone dan response wajib diisi' });
  try {
    await webauthn.verifyRegistration(db, phoneClean, req.body.response);
    res.json({ verified: true });
  } catch (err) {
    res.status(400).json({ verified: false, error: err.message });
  }
});

app.post('/api/webauthn/login/options', rateLimit(15), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  if (!webauthn.configured()) return res.status(501).json({ error: 'RP_ID/RP_ORIGIN belum di-set' });
  const phoneClean = String(req.body?.phone || '').replace(/[\s-]/g, '');
  if (!phoneClean) return res.status(400).json({ error: 'phone wajib diisi' });
  try {
    const options = await webauthn.getAuthenticationOptions(db, phoneClean);
    res.json(options);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/webauthn/login/verify', rateLimit(15), async (req, res) => {
  if (!db) return res.status(501).json({ error: 'Firestore belum dikonfigurasi' });
  if (!webauthn.configured()) return res.status(501).json({ error: 'RP_ID/RP_ORIGIN belum di-set' });
  const phoneClean = String(req.body?.phone || '').replace(/[\s-]/g, '');
  if (!phoneClean || !req.body?.response) return res.status(400).json({ error: 'phone dan response wajib diisi' });
  try {
    await webauthn.verifyAuthentication(db, phoneClean, req.body.response);
    // Ambil profil dari Firestore (diisi otomatis oleh syncPush() di frontend)
    const userSnap = await db.collection('users').doc(phoneClean).get();
    if (!userSnap.exists) throw new Error('Profil tidak ditemukan, login pakai password dulu 1x untuk sinkronisasi awal');
    const userData = userSnap.data();
    res.json({ verified: true, user: userData.user || null, ers: userData.ers || null });
  } catch (err) {
    res.status(400).json({ verified: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════
   HEALTH CHECK — dipakai Cloud Run & buat cek status fitur
═══════════════════════════════════════════ */
app.get('/', (req, res) => {
  res.json({
    service: 'LOKALBISA Backend',
    status: 'ok',
    features: {
      aiCompliance: !!anthropic,
      whatsappOtp: !!(db && process.env.FONNTE_TOKEN),
      firestoreSync: !!db,
      biometricLogin: !!(db && webauthn.configured())
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ LOKALBISA backend jalan di port ${PORT}`);
  console.log(`   AI Compliance : ${anthropic ? 'AKTIF' : 'NONAKTIF (ANTHROPIC_API_KEY kosong)'}`);
  console.log(`   OTP WhatsApp  : ${process.env.FONNTE_TOKEN ? 'AKTIF' : 'NONAKTIF (FONNTE_TOKEN kosong)'}`);
  console.log(`   Firestore     : ${db ? 'AKTIF' : 'NONAKTIF (belum dikonfigurasi)'}`);
  console.log(`   Sidik Jari    : ${db && webauthn.configured() ? 'AKTIF' : 'NONAKTIF (RP_ID/RP_ORIGIN kosong)'}`);
});
