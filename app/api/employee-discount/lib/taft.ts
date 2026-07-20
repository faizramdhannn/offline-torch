import { google } from 'googleapis';

// Sama seperti resolusi taft_name di Traffic Store (app/(main)/traffic-store/page.tsx,
// userStore & taftsForStore) tapi dilakukan di server: cocokkan user_name login
// terhadap store_location di master_traffic (exact match dulu, lalu substring),
// lalu ambil daftar taft_name unik untuk store tersebut.
//
// PENTING: sheet `master_traffic` yang dipakai Traffic Store TIDAK berada di
// spreadsheet yang sama dengan mapping `master_traffic` di lib/sheets.ts
// (yang menunjuk ke SPREADSHEET_ORDER — dipakai untuk keperluan lain). Sheet
// yang benar ada di SPREADSHEET_TRAFFIC (lihat app/api/traffic-store/route.ts).
// Karena itu di sini kita baca langsung dari SPREADSHEET_TRAFFIC, BUKAN lewat
// getSheetData('master_traffic') dari lib/sheets.ts.
const STORE_NAME_MAP: Record<string, string> = {
  cirebon: 'Cirebon', jogja: 'Jogja', karawaci: 'Karawaci', karawang: 'Karawang',
  lampung: 'Lampung', lembong: 'Lembong', makassar: 'Makassar', malang: 'Malang',
  margonda: 'Margonda', medan: 'Medan', pekalongan: 'Pekalongan',
  purwokerto: 'Purwokerto', surabaya: 'Surabaya', tambun: 'Tambun',
};

// getEmployeeDiscountTaft() is called on nearly every Daily Job checklist /
// Employee Discount request, so without a cache it hits the Google Sheets
// API directly every single time — a major contributor to the "Quota
// exceeded for quota metric 'Read requests'" errors seen in production.
// Cache + single-flight dedup here, mirroring the pattern already used by
// lib/sheets.ts for everything else.
const MASTER_TRAFFIC_CACHE_TTL_MS = 60_000;
let masterTrafficCache: { data: any[]; expiresAt: number } | null = null;
let masterTrafficInFlight: Promise<any[]> | null = null;

async function getMasterTraffic(): Promise<any[]> {
  if (masterTrafficCache && masterTrafficCache.expiresAt > Date.now()) {
    return masterTrafficCache.data;
  }
  if (masterTrafficInFlight) return masterTrafficInFlight;

  masterTrafficInFlight = (async () => {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_TRAFFIC || '',
      range: 'master_traffic!A1:ZZ',
    });

    const rows = response.data.values || [];
    const data = rows.length === 0 ? [] : rows.slice(1).map((row: string[]) => {
      const obj: any = {};
      rows[0].forEach((header: string, i: number) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });

    masterTrafficCache = { data, expiresAt: Date.now() + MASTER_TRAFFIC_CACHE_TTL_MS };
    return data;
  })();

  try {
    return await masterTrafficInFlight;
  } finally {
    masterTrafficInFlight = null;
  }
}

export async function getEmployeeDiscountTaft(userNameRaw: string) {
  const userName = userNameRaw.toLowerCase().trim();

  const master = await getMasterTraffic();

  const masterStores = [...new Set(
    master.map((m: any) => m.store_location).filter(Boolean)
  )] as string[];

  let userStore: string | null = null;
  const exactMatch = masterStores.find((s) => s.toLowerCase().trim() === userName);
  if (exactMatch) {
    userStore = exactMatch;
  } else {
    const partialMatch = masterStores.find(
      (s) => userName.includes(s.toLowerCase().trim()) || s.toLowerCase().trim().includes(userName)
    );
    if (partialMatch) {
      userStore = partialMatch;
    } else {
      const storeKeys = Object.keys(STORE_NAME_MAP);
      const mapMatch = storeKeys.find(
        (k) => userName === k || userName === k.replace(/\s/g, '') || userName.includes(k)
      );
      userStore = mapMatch ? STORE_NAME_MAP[mapMatch] : null;
    }
  }

  // Persis seperti taftsForStore di traffic-store: HANYA taft_name milik
  // store user yang login, tidak ada fallback "tampilkan semua" — kalau
  // kosong berarti user ini tidak terpetakan ke store manapun di
  // master_traffic (sama seperti yang akan terjadi di halaman Traffic Store
  // untuk user yang sama).
  const taftsForStore = userStore
    ? [...new Set(
        master
          .filter((m: any) => m.store_location?.toLowerCase().trim() === (userStore as string).toLowerCase().trim())
          .map((m: any) => m.taft_name)
          .filter(Boolean)
      )]
    : [];

  return { userStore, taftsForStore };
}
