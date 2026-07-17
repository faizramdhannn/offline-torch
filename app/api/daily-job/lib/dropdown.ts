import { google } from 'googleapis';

// Sama persis pola app/api/employee-discount/lib/dropdown.ts: baca tab
// master_dropdown di spreadsheet SPREADSHEET_MATERIAL_ISSUE lewat client
// googleapis langsung (BUKAN lewat lib/sheets.ts punya 'master_dropdown',
// karena mapping lib/sheets.ts untuk key itu menunjuk ke SPREADSHEET_MASTER
// yang dipakai request-store — spreadsheet BEDA).
//
// Kolom-kolom berikut sudah diisi user langsung di file mereka (dikonfirmasi
// dari export asli), tidak perlu setup tambahan:
//  - role_taft
//  - error_category_delivery_note / error_solved_delivery_note
//  - error_category_sales_order   / error_solved_sales_order
//  - error_category_stock_entry   / error_solved_stock_entry
async function getMasterDropdownRows() {
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
}

function dedupColumn(rows: any[], column: string): string[] {
  return [...new Set(
    rows.map((r: any) => r[column]?.trim()).filter(Boolean)
  )];
}

export interface DailyJobDropdowns {
  role_taft: string[];
  error_category_delivery_note: string[];
  error_solved_delivery_note: string[];
  error_category_sales_order: string[];
  error_solved_sales_order: string[];
  error_category_stock_entry: string[];
  error_solved_stock_entry: string[];
}

export async function getDailyJobDropdowns(): Promise<DailyJobDropdowns> {
  const rows = await getMasterDropdownRows();

  return {
    role_taft: dedupColumn(rows, 'role_taft'),
    error_category_delivery_note: dedupColumn(rows, 'error_category_delivery_note'),
    error_solved_delivery_note: dedupColumn(rows, 'error_solved_delivery_note'),
    error_category_sales_order: dedupColumn(rows, 'error_category_sales_order'),
    error_solved_sales_order: dedupColumn(rows, 'error_solved_sales_order'),
    error_category_stock_entry: dedupColumn(rows, 'error_category_stock_entry'),
    error_solved_stock_entry: dedupColumn(rows, 'error_solved_stock_entry'),
  };
}
