// Parser tanggal berformat locale id-ID yang disimpan di sheet, mis. "24 Jun 2026, 14.54.19" / "5 Okt 2026, 09.03.01".
// `new Date()` tidak mengenal nama bulan Indonesia (Mei, Agu, Okt, Des...) → NaN → baris terurut salah. Murni (aman diimpor klien).
const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3, mei: 4, may: 4,
  jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agt: 7, agustus: 7, aug: 7, sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, nov: 10, november: 10, des: 11, desember: 11, dec: 11,
};

export function parseIdDateTime(str: string | null | undefined): number {
  const s = String(str ?? "").trim();
  if (!s) return 0;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})(?:[,\s]+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) return new Date(+m[3], mon, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  }
  // Format lain (ISO, "2026-10-05 09:03:01", dll.)
  const t = new Date(s.replace(",", "").replace(/(\d)\.(\d{2})\.(\d{2})$/, "$1:$2:$3")).getTime();
  return isNaN(t) ? 0 : t;
}
