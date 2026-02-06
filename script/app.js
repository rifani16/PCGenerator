/**
 * app.js — Logika aplikasi affiliate generator (JSON version).
 *
 * Alur kerja:
 *   1. Saat halaman siap, load data.json via fetch.
 *   2. Dropdown diisi dari data JSON.
 *   3. User memilih program + memasukkan kode affiliate atau link lengkap.
 *   4. Tombol "Generate & Copy" membangun link penuh, mengganti {LINK} di template,
 *      menampilkan hasilnya di area preview, dan langsung menyalin ke clipboard.
 *   5. Tombol "Copy Narasi" menyalin teks narasi yang sudah di-generate.
 *   6. Tombol "Share ke WhatsApp" membuka WhatsApp Web / deep-link dengan narasi.
 */

// ─── Referensi DOM ───────────────────────────────────────────────────────────
const programSelect      = document.getElementById('programSelect');
const affiliateInput     = document.getElementById('affiliateInput');
const affiliateLinkInput = document.getElementById('affiliateLinkInput');
const konfirmasiInput    = document.getElementById('konfirmasiInput');
const generateBtn        = document.getElementById('generateBtn');
const copyBtn            = document.getElementById('copyBtn');
const shareBtn           = document.getElementById('shareBtn');
const previewSection     = document.getElementById('previewSection');
const previewText        = document.getElementById('previewText');
const linkPreview        = document.getElementById('linkPreview');
const toastEl            = document.getElementById('toast');

const codeInputSection   = document.getElementById('codeInputSection');
const linkInputSection   = document.getElementById('linkInputSection');
const inputModeRadios    = document.querySelectorAll('input[name="inputMode"]');

// ─── State internal ──────────────────────────────────────────────────────────
let currentNarasi = '';   // narasi yang sudah di-generate (siap copy)
let currentLink   = '';   // link affiliate yang sudah di-generate

// Data dari JSON (akan di-load saat init)
let CONFIG = null;    // data.json - config umum
let PROGRAMS = null;  // program.json - data program

// ─── Inisialisasi ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  populateDropdown();
  bindEvents();
});

/**
 * Load data dari data.json dan program.json.
 */
async function loadData() {
  try {

    const BASE_PATH = window.location.pathname.includes('/PCGenerator/')
    ? '/PCGenerator'
    : '';
    
    const CONFIG_URL = `${BASE_PATH}/json/data.json`;
    const PROGRAM_URL = `${BASE_PATH}/json/program.json`;


    // Load kedua file JSON secara paralel
    const [configResponse, programsResponse] = await Promise.all([
      fetch(CONFIG_URL),
      fetch(PROGRAM_URL)
    ]);

    if (!configResponse.ok || !programsResponse.ok) {
      throw new Error('Failed to load JSON files');
    }

    CONFIG = await configResponse.json();
    PROGRAMS = await programsResponse.json();

    // Set default value untuk nomor konfirmasi
    if (CONFIG && CONFIG.konfirmasiDefault) {
      konfirmasiInput.value = '';
      konfirmasiInput.placeholder = `Default: ${CONFIG.konfirmasiDefault}`;
    }

  } catch (error) {
    console.error('Error loading JSON files:', error);
    showToast('❌ Gagal memuat data');
    generateBtn.disabled = true;
  }
}

/**
 * Isi <select> dari PROGRAMS.
 */
function populateDropdown() {
  if (!PROGRAMS) return;
  
  Object.keys(PROGRAMS).forEach(key => {
    const opt       = document.createElement('option');
    opt.value       = key;
    opt.textContent = PROGRAMS[key].name;
    programSelect.appendChild(opt);
  });
}

/**
 * Pasangkan semua event listener.
 */
function bindEvents() {
  generateBtn.addEventListener('click', handleGenerate);
  copyBtn.addEventListener('click', handleCopyNarasi);
  shareBtn.addEventListener('click', handleShareWhatsApp);

  // Toggle input mode (kode vs link)
  inputModeRadios.forEach(radio => {
    radio.addEventListener('change', handleInputModeChange);
  });

  // Reset preview ketika input berubah
  programSelect.addEventListener('change', resetPreview);
  affiliateInput.addEventListener('input', resetPreview);
  affiliateLinkInput.addEventListener('input', resetPreview);
  konfirmasiInput.addEventListener('input', resetPreview);
}

/**
 * Toggle visibility antara input kode vs input link lengkap.
 */
function handleInputModeChange(e) {
  const mode = e.target.value;
  
  if (mode === 'code') {
    codeInputSection.classList.remove('hidden');
    linkInputSection.classList.add('hidden');
    affiliateLinkInput.value = ''; // clear link input
  } else {
    codeInputSection.classList.add('hidden');
    linkInputSection.classList.remove('hidden');
    affiliateInput.value = ''; // clear code input
  }
  
  resetPreview();
}

// ─── Handler utama ───────────────────────────────────────────────────────────

/**
 * Generate narasi + link, tampilkan di preview, dan salin ke clipboard.
 */
async function handleGenerate() {
  if (!CONFIG || !PROGRAMS) {
    showToast('❌ Data belum dimuat.');
    return;
  }

  const programKey  = programSelect.value;
  const affCode     = affiliateInput.value.trim();
  const affLink     = affiliateLinkInput.value.trim();
  const customKonfirmasi = konfirmasiInput.value.trim();

  // ── Validasi program ──
  if (!programKey) {
    showToast('⚠️ Pilih program donasi dulu.');
    return;
  }

  const program = PROGRAMS[programKey];

  // ── Deteksi mode input (kode vs link) ──
  const inputMode = document.querySelector('input[name="inputMode"]:checked').value;
  
  let finalLink = '';

  if (inputMode === 'code') {
    // Mode: input kode affiliate
    if (!affCode) {
      showToast('⚠️ Masukkan kode affiliate dulu.');
      affiliateInput.focus();
      return;
    }
    
    // Bangun link dari baseUrl + path + ?affiliate_code= + kode
    finalLink = CONFIG.baseUrl + program.path + "?affiliate_code=" + encodeURIComponent(affCode);
    
  } else {
    // Mode: input link lengkap
    if (!affLink) {
      showToast('⚠️ Masukkan link affiliate lengkap dulu.');
      affiliateLinkInput.focus();
      return;
    }

    // Validasi: pastikan link memiliki struktur yang valid
    try {
      const url = new URL(affLink);
      
      // Cek apakah link sudah mengandung affiliate_code parameter
      if (!url.searchParams.has('affiliate_code')) {
        showToast('⚠️ Link harus mengandung parameter ?affiliate_code=');
        return;
      }
      
      finalLink = affLink; // gunakan link yang diinput user
      
    } catch (err) {
      showToast('⚠️ Format link tidak valid. Pastikan URL lengkap.');
      return;
    }
  }

  // ── Tentukan nomor konfirmasi (custom atau default) ──
  const nomorKonfirmasi = customKonfirmasi || CONFIG.konfirmasiDefault;

  // ── Bangun info rekening & konfirmasi ──
  const infoRekening = `

Rekening:
🏦 BSI ${CONFIG.rekening.bsi}
a.n ${CONFIG.rekening.anBSI}
🏦 Mandiri ${CONFIG.rekening.mandiri}
a.n ${CONFIG.rekening.anMandiri}

📞 Konfirmasi: ${nomorKonfirmasi}`;

  // ── Bangun narasi ──
  currentLink   = finalLink;
  currentNarasi = program.text.replace('{LINK}', currentLink) + infoRekening;

  // ── Tampilkan preview ──
  linkPreview.textContent = currentLink;
  previewText.textContent = currentNarasi;
  showPreview();

  // ── Salin ke clipboard ──
  await copyToClipboard(currentNarasi);
  showToast('✅ Narasi berhasil di-generate & disalin!');
}

/**
 * Salin narasi yang sudah ada di state.
 */
async function handleCopyNarasi() {
  if (!currentNarasi) {
    showToast('⚠️ Generate narasi dulu.');
    return;
  }
  await copyToClipboard(currentNarasi);
  showToast('📋 Narasi berhasil disalin ke clipboard!');
}

/**
 * Share ke WhatsApp via deep-link.
 * Pada desktop → buka WhatsApp Web; pada mobile → buka aplikasi WhatsApp.
 */
function handleShareWhatsApp() {
  if (!currentNarasi) {
    showToast('⚠️ Generate narasi dulu.');
    return;
  }

  const encoded = encodeURIComponent(currentNarasi);

  // Deteksi mobile: gunakan wa:// scheme agar langsung buka aplikasi
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const url      = isMobile
    ? `whatsapp://send?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank');
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Salin teks ke clipboard (fallback untuk browser lama).
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback: textarea trick
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/**
 * Tampilkan area preview.
 */
function showPreview() {
  previewSection.classList.remove('hidden');
  // Smooth scroll ke preview (mobile-friendly)
  setTimeout(() => {
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

/**
 * Reset preview & state saat input berubah.
 */
function resetPreview() {
  currentNarasi = '';
  currentLink   = '';
  previewSection.classList.add('hidden');
}

/**
 * Tampilkan toast notifikasi.
 * @param {string} msg – pesan yang ditampilkan
 */
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}