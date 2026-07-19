import { google } from 'googleapis';
import { getSheetData, withCache } from '@/lib/sheets';

// Sama seperti master-issue-dropdown: baca tab master_dropdown di spreadsheet
// SPREADSHEET_MATERIAL_ISSUE, tapi hanya butuh kolom discount_code (baru) dan
// assigned_to (id → user_name, sama persis pola resolusinya).
//
// Cache key ('daily_job_master_dropdown') sengaja SAMA dengan
// app/api/daily-job/lib/dropdown.ts — keduanya baca sheet & range yang
// identik, jadi dua fitur ini berbagi satu hasil cache alih-alih masing-
// masing nembak Sheets API sendiri.
async function getMasterDropdown() {
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

export async function getEmployeeDiscountDropdown() {
  const [rows, users] = await Promise.all([
    getMasterDropdown(),
    getSheetData('users'),
  ]);

  const discount_code = [...new Set(
    rows.map((r: any) => r.discount_code?.trim()).filter(Boolean)
  )];

  // Mapping id → user_name dari sheet users (identik dengan material-issue-dropdown)
  const userMap = new Map<string, string>();
  users.forEach((u: any) => {
    if (u.id && u.user_name) userMap.set(u.id.trim(), u.user_name.trim());
  });

  const seen = new Set<string>();
  const assigned_to = rows
    .map((r: any) => r.assigned_to?.trim())
    .filter(Boolean)
    .filter((id: string) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id: string) => ({
      id,
      label: userMap.get(id) || id,
    }));

  return { discount_code, assigned_to };
}
