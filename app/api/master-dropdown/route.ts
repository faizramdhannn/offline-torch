import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheetData } from '@/lib/sheets';

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
    const [dropdownData, usersData] = await Promise.all([
      getMasterDropdownFromStore(),
      getSheetData('users'),
    ]);

    // Map id → { username, name }
    const userMap: Record<string, { user_name: string; name: string }> = {};
    usersData.forEach((u: any) => {
      if (u.id) userMap[u.id.trim()] = { user_name: u.user_name?.trim(), name: u.name?.trim() };
    });

    const requesters = dropdownData
      .map((row: any) => row.requester)
      .filter((v: any) => v?.trim());

    // assignees: resolve id → { label: name, value: user_name }
    const assigneesSeen = new Set<string>();
    const assignees = dropdownData
      .map((row: any) => {
        const raw = row.assigned_to?.trim();
        if (!raw) return null;
        const resolved = userMap[raw];
        if (!resolved) return null; // id tidak ditemukan di users
        return { label: resolved.name, value: resolved.user_name };
      })
      .filter((v: any) => {
        if (!v) return false;
        if (assigneesSeen.has(v.value)) return false;
        assigneesSeen.add(v.value);
        return true;
      });

    const reasons = dropdownData
      .map((row: any) => row.reason_request)
      .filter((v: any) => v?.trim());

    return NextResponse.json({
      requesters: [...new Set(requesters)],
      assignees, // array of { label, value }
      reasons: [...new Set(reasons)],
    });
  } catch (error) {
    console.error('Error fetching dropdown data:', error);
    return NextResponse.json({ error: 'Failed to fetch dropdown data' }, { status: 500 });
  }
}