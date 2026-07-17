// ─────────────────────────────────────────────────────────────────────────────
// Perbandingan "apakah baris ini dari HARI INI (Asia/Jakarta)" untuk fitur
// Daily Job. `created_at` disimpan sebagai string locale id-ID yang SUDAH
// dalam jam Jakarta, contoh: "17 Jul 2026, 23.14.32" (dari toLocaleString
// dengan timeZone: 'Asia/Jakarta').
//
// BUG YANG DIPERBAIKI DI SINI: pendekatan lama parse string itu balik lewat
// `new Date(str)` lalu convert ke Asia/Jakarta lagi via toLocaleDateString.
// Itu HANYA benar kalau runtime server kebetulan bertimezone Asia/Jakarta —
// begitu di-deploy ke Vercel (default UTC), "23.14.32" dibaca sebagai 23:14
// UTC (bukan 23:14 Jakarta), lalu di-convert +7 lagi jadi jam 06:14 KEESOKAN
// HARINYA — jadi entri yang diisi malam hari (>= ~17:00 WIB) selalu dianggap
// "bukan hari ini". Ini konsisten muncul di produksi meski lolos test lokal
// (banyak mesin dev kebetulan bertimezone WIB).
//
// Fix: JANGAN pernah balik ke epoch/Date object untuk pertanyaan "tanggal
// berapa" — ekstrak "DD Mon YYYY" langsung dari string sebagai teks, sama
// sekali tidak melalui konversi timezone apa pun.
// ─────────────────────────────────────────────────────────────────────────────

const ID_MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', Mei: '05', Jun: '06',
  Jul: '07', Agu: '08', Sep: '09', Okt: '10', Nov: '11', Des: '12',
};

// "17 Jul 2026, 23.14.32" -> "2026-07-17". Return '' kalau format tidak
// dikenali (jangan pernah lempar error — pemanggil harus tetap jalan).
export function jakartaDateKeyFromCreatedAt(str: string | undefined | null): string {
  if (!str) return '';
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return '';
  const [, day, monAbbr, year] = m;
  const mon = ID_MONTHS[monAbbr];
  if (!mon) return '';
  return `${year}-${mon}-${day.padStart(2, '0')}`;
}

// Tanggal HARI INI di Asia/Jakarta, format YYYY-MM-DD. Ini AMAN pakai
// timeZone option karena cuma dipakai untuk "sekarang", bukan parse ulang
// string yang sudah kehilangan info timezone-nya.
export function todayJakartaKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

// Untuk SORTING (urutan terbaru/terlama) — beda kebutuhan dari "hari ini
// atau bukan": di sini toleransi beberapa jam meleset tidak masalah, cuma
// butuh urutan relatif yang benar antar baris. Tetap tidak sepenuhnya akurat
// kalau timezone runtime bukan Jakarta, tapi errornya konsisten (selalu +7
// jam) jadi urutan RELATIF antar timestamp tetap benar walau nilai absolut
// epoch-nya bias.
export function parseCreatedAtForSort(str: string | undefined | null): number {
  if (!str) return 0;
  const cleaned = str.replace(',', '').replace(/\./g, ':');
  const t = new Date(cleaned).getTime();
  return isNaN(t) ? 0 : t;
}
