import { google } from 'googleapis';
import { withCache } from '@/lib/sheets';

// Sama persis pola app/api/employee-discount/lib/dropdown.ts: baca tab
// master_dropdown di spreadsheet SPREADSHEET_MATERIAL_ISSUE lewat client
// googleapis langsung (BUKAN lewat lib/sheets.ts punya 'master_dropdown',
// karena mapping lib/sheets.ts untuk key itu menunjuk ke SPREADSHEET_MASTER
// yang dipakai request-store — spreadsheet BEDA).
//
// Kolom yang dipakai di sini: role_taft. (Kolom error_category_*/error_solved_*
// dari fitur report delivery-note/sales-order/stock-entry sudah tidak
// dipakai lagi sejak fitur report tersebut dihapus.)
async function getMasterDropdownRows() {
  return withCache('daily_job_master_dropdown', 120_000, async () => {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_MATERIAL_ISSUE || '',
      range: 'master_dropdown!A1:ZZ',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];
    const headers = rows[0];
    return rows.slice(1).map((row: string[]) => {
      const obj: any = {};
      headers.forEach((header: string, i: number) => {
        obj[header] = row[i] || null;
      });
      return obj;
    });
  });
}

function dedupColumn(rows: any[], column: string): string[] {
  return [...new Set(
    rows.map((r: any) => r[column]?.trim()).filter(Boolean)
  )];
}

export interface DailyJobDropdowns {
  role_taft: string[];
  checklist_opening: string[];
  checklist_operational: string[];
  checklist_closing: string[];
}

// Daftar item checklist per kategori (Opening/Operational/Closing) sekarang
// SEPENUHNYA dinamis dari master_dropdown — bukan lagi kolom boolean
// hardcoded di sheet daily_checklist. Tambah/hapus baris di kolom
// checklist_opening/checklist_operational/checklist_closing di
// master_dropdown langsung berefek ke form & tabel tanpa perlu ubah kode.
export async function getDailyJobDropdowns(): Promise<DailyJobDropdowns> {
  const rows = await getMasterDropdownRows();

  return {
    role_taft: dedupColumn(rows, 'role_taft'),
    checklist_opening: dedupColumn(rows, 'checklist_opening'),
    checklist_operational: dedupColumn(rows, 'checklist_operational'),
    checklist_closing: dedupColumn(rows, 'checklist_closing'),
  };
}
