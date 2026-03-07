import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

async function getMasterDropdownFromStore() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_STORE || '',
    range: 'master_dropdown!A1:ZZ',
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row: string[]) => {
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });
}

export async function GET(request: NextRequest) {
  try {
    const dropdownData = await getMasterDropdownFromStore();

    const requesters = dropdownData
      .map((row: any) => row.requester)
      .filter((v: any) => v && v.trim() !== '');

    const assignees = dropdownData
      .map((row: any) => row.assigned_to)
      .filter((v: any) => v && v.trim() !== '');

    const reasons = dropdownData
      .map((row: any) => row.reason_request)
      .filter((v: any) => v && v.trim() !== '');

    return NextResponse.json({
      requesters: [...new Set(requesters)],
      assignees: [...new Set(assignees)],
      reasons: [...new Set(reasons)],
    });
  } catch (error) {
    console.error('Error fetching dropdown data:', error);
    return NextResponse.json({ error: 'Failed to fetch dropdown data' }, { status: 500 });
  }
}