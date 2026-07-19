import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheetData, withCache } from '@/lib/sheets';

// Cache key ('daily_job_master_dropdown') sengaja SAMA dengan
// app/api/daily-job/lib/dropdown.ts dan app/api/employee-discount/lib/dropdown.ts
// — ketiganya baca sheet & range yang identik (master_dropdown di
// SPREADSHEET_MATERIAL_ISSUE), jadi berbagi satu hasil cache.
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

export async function GET() {
  try {
    const [rows, users] = await Promise.all([
      getMasterDropdown(),
      getSheetData('users'),
    ]);

    const request_by = [...new Set(
      rows.map((r: any) => r.request_by?.trim()).filter(Boolean)
    )];

    const type_reason = [...new Set(
      rows.map((r: any) => r.type_reason?.trim()).filter(Boolean)
    )];

    // Mapping id → user_name dari sheet users
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
        label: userMap.get(id) || id, // fallback ke id kalau tidak ketemu
      }));

    return NextResponse.json({ request_by, type_reason, assigned_to });
  } catch (error) {
    console.error('GET material-issue-dropdown error:', error);
    return NextResponse.json({ request_by: [], type_reason: [], assigned_to: [] }, { status: 500 });
  }
}