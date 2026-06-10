import { NextResponse } from 'next/server';
import { google } from 'googleapis';

async function getMasterDropdown() {
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

export async function GET() {
  try {
    const rows = await getMasterDropdown();

    const request_by = [...new Set(
      rows.map((r: any) => r.request_by?.trim()).filter(Boolean)
    )];

    const type_reason = [...new Set(
      rows.map((r: any) => r.type_reason?.trim()).filter(Boolean)
    )];

    return NextResponse.json({ request_by, type_reason });
  } catch (error) {
    console.error('GET material-issue-dropdown error:', error);
    return NextResponse.json({ request_by: [], type_reason: [] }, { status: 500 });
  }
}