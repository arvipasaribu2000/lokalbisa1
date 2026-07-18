// LOKALBISA — script.js
// Service Worker registration, online/offline detection, dynamic SEO meta

'use strict';

/* ═══════════════════════════════════════════
   1. SERVICE WORKER REGISTRATION
═══════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[LOKALBISA] ✅ Service Worker terdaftar. Scope:', reg.scope);

        // Deteksi update SW — beri tahu user ada versi baru
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showConnectionBanner(
                '🔄 Pembaruan LOKALBISA tersedia! Tutup & buka ulang aplikasi untuk memperbarui.',
                'info'
              );
            }
          });
        });
      })
      .catch(err => {
        console.warn('[LOKALBISA] ⚠ Gagal mendaftarkan Service Worker:', err);
      });
  });
} else {
  console.info('[LOKALBISA] Service Worker tidak didukung di browser ini.');
}

/* ═══════════════════════════════════════════
   2. ONLINE / OFFLINE DETECTION
═══════════════════════════════════════════ */
function showConnectionBanner(message, type = 'offline') {
  const banner = document.getElementById('connection-status');
  if (!banner) return;

  const colors = {
    offline: { bg: '#ef4444', icon: '📵' },
    online:  { bg: '#22c55e', icon: '✅' },
    info:    { bg: '#0ea5e9', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.offline;

  banner.style.background = c.bg;
  banner.innerHTML = `<span>${c.icon} ${message}</span>`;
  banner.style.display = 'block';
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('role', 'status');

  // Sembunyikan banner "Kembali online" setelah 4 detik
  if (type === 'online') {
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
  }
}

function updateOnlineStatus() {
  if (navigator.onLine) {
    showConnectionBanner('Koneksi internet kembali. Fitur AI sudah aktif kembali.', 'online');
  } else {
    showConnectionBanner(
      'Mode Offline — Chat AI tidak tersedia. Fitur ERS, profil, dan buyer tetap berjalan.',
      'offline'
    );
  }
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Cek status awal saat halaman dibuka
window.addEventListener('DOMContentLoaded', () => {
  if (!navigator.onLine) {
    showConnectionBanner(
      'Mode Offline — Chat AI tidak tersedia. Fitur lain tetap berjalan.',
      'offline'
    );
  }
});

/* ═══════════════════════════════════════════
   3. DYNAMIC SEO META TAG UPDATER
   Dipanggil setiap kali layar/halaman berganti
   supaya meta title & description ikut berubah
   (penting untuk SPA agar Lighthouse happy)
═══════════════════════════════════════════ */
const PAGE_META = {
  home: {
    title: 'Dashboard — LOKALBISA | AI Export Launchpad untuk UMKM Indonesia',
    desc:  'Pantau Export Readiness Score, status compliance, dan peluang buyer internasional kamu dari satu dashboard.',
  },
  ers: {
    title: 'Hitung ERS — LOKALBISA | Export Readiness Score',
    desc:  'Ukur kesiapan ekspormu dalam 4 langkah. Dapatkan skor, radar chart, dan roadmap action plan personal.',
  },
  compliance: {
    title: 'AI Compliance Guide — LOKALBISA | Panduan Regulasi Ekspor',
    desc:  'Tanya AI tentang dokumen, sertifikasi, dan regulasi bea cukai ke 8 negara tujuan ekspor Indonesia.',
  },
  matching: {
    title: 'Smart Buyer Matching — LOKALBISA | Temukan Importir Internasional',
    desc:  '24 buyer terkurasi dari 14 negara siap temui produk UMKM Indonesia. Filter by kategori & negara.',
  },
  profile: {
    title: 'Profil UMKM — LOKALBISA | Kelola Data Bisnis Ekspor',
    desc:  'Kelola profil bisnis, sertifikasi, dan progress ekspor UMKM kamu.',
  },
  auth: {
    title: 'Masuk / Daftar — LOKALBISA | Platform Ekspor Digital UMKM',
    desc:  'Daftar gratis dan mulai perjalanan ekspor UMKM Indonesia bersama LOKALBISA.',
  },
};

/**
 * updatePageMeta(screenId)
 * Panggil fungsi ini setiap kali showScreen() dipanggil di app utama.
 * Contoh: updatePageMeta('ers')
 */
function updatePageMeta(screenId) {
  const meta = PAGE_META[screenId];
  if (!meta) return;

  // Update <title>
  document.title = meta.title;

  // Update meta description
  let descTag = document.querySelector('meta[name="description"]');
  if (!descTag) {
    descTag = document.createElement('meta');
    descTag.setAttribute('name', 'description');
    document.head.appendChild(descTag);
  }
  descTag.setAttribute('content', meta.desc);

  // Update Open Graph (untuk share di WhatsApp, dll.)
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', meta.title);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', meta.desc);
}

// Expose ke global supaya bisa dipanggil dari index.html
window.updatePageMeta = updatePageMeta;
window.showConnectionBanner = showConnectionBanner;
