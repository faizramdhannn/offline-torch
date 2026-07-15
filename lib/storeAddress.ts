import { google } from 'googleapis';

// store_address hidup di spreadsheet TERPISAH (SPREADSHEET_STORE) dari sheet
// yang dipakai fitur Attendance (`store_list`, di SPREADSHEET_ATTENDANCE) —
// keduanya BUKAN sheet yang sama. Modul ini jadi satu sumber kebenaran untuk
// status toko (Active/Draft/Archived): fitur lain (Attendance, Dashboard)
// cross-reference ke sini lewat NAMA toko (store_location), bukan berbagi
// sheet secara langsung.
export interface StoreAddressRow {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
  status: string; // 'Active' | 'Draft' | 'Archived' — kosong dianggap 'Active' (backward-compat)
}

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  }
  try {
    return JSON.parse(credsEnv);
  } catch {
    throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
  }
}

export async function getStoreAddressList(): Promise<StoreAddressRow[]> {
  const spreadsheetId = process.env.SPREADSHEET_STORE;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_STORE environment variable is not set');
  }

  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'store_address!A:E', // E = status (kolom baru)
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return [];

  return rows
    .slice(1)
    .filter((row: string[]) => row.some((cell) => cell && cell.trim() !== ''))
    .map((row: string[]) => ({
      id: row[0] || '',
      store_location: row[1] || '',
      phone_number: row[2] || '',
      address: row[3] || '',
      status: row[4] || '',
    }));
}

function isActiveStatus(status: string): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === '' || s === 'active'; // kosong = Active (baris lama sebelum kolom status ada)
}

// PENTING: penamaan toko di store_address BEDA FORMAT dari store_list
// (Attendance) —
//   store_address.store_location: "Torch Cirebon", "Torch Jogja", dst
//   store_list.store_name:        "cirebon", "jogja", dst (tanpa prefix "Torch")
// Jadi tidak bisa exact-match langsung. Normalisasi: lowercase, trim, buang
// prefix "torch " kalau ada — supaya "Torch Cirebon" dan "cirebon" match.
export function normalizeStoreName(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/^torch\s+/, '');
}

// Set nama toko yang statusnya Active (SUDAH dinormalisasi lewat
// normalizeStoreName) — dipakai untuk filter store_list di fitur Attendance
// supaya toko Draft/Archived tidak muncul di sana, TANPA perlu menduplikasi
// kolom status ke sheet store_list. Baris "PCA" (bukan nama toko fisik) ikut
// masuk apa adanya kalau statusnya Active — tidak masalah karena tidak akan
// pernah match dengan store_name manapun di store_list.
export async function getActiveStoreNameSet(): Promise<Set<string>> {
  const list = await getStoreAddressList();
  return new Set(
    list
      .filter((s) => isActiveStatus(s.status))
      .map((s) => normalizeStoreName(s.store_location))
      .filter(Boolean)
  );
}

export { isActiveStatus };
