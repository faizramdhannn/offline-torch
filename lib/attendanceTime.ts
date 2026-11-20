// ─── Helper: parse Indonesian locale timestamp to YYYY-MM-DD ─────────────────
export function tsToISO(ts: string): string {
  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'mei': '05', 'may': '05',
    'jun': '06', 'juni': '06',
    'jul': '07', 'juli': '07',
    'agu': '08', 'aug': '08',
    'sep': '09', 'okt': '10', 'oct': '10',
    'nov': '11', 'des': '12', 'dec': '12',
  };
  const m = ts.match(/^(\d{1,2})\s+(\w+\.?)\s+(\d{4})/);
  if (!m) return ts;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].replace('.', '').toLowerCase();
  const month = monthMap[monthKey] || '00';
  return `${m[3]}-${month}-${day}`;
}


// Jam "HH:MM" dari timestamp lokal Indonesia ("19 Nov 2026 09.12.30" / "2026-11-19 09:12"); kosong bila tidak ada.
export function tsToTime(ts: string): string {
  const m = String(ts || '').match(/(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

// Tanggal hari ini (WIB) format YYYY-MM-DD.
export function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}
