import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_TRAFFIC = process.env.SPREADSHEET_TRAFFIC || '';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  try {
    const credentials = JSON.parse(credsEnv);
    if (!credentials.client_email) throw new Error('Missing client_email');
    if (!credentials.private_key) throw new Error('Missing private_key');
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
    throw error;
  }
}

async function getTrafficSheetData(sheetName: string) {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_TRAFFIC,
    range: `${sheetName}!A1:ZZ`,
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0] as string[];
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
    .map((row) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
}

async function appendTrafficRow(sheetName: string, row: any[]) {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_TRAFFIC,
    range: `${sheetName}!A2`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function updateTrafficRow(sheetName: string, rowIndex: number, row: any[]) {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const numCols = row.length;
  const endCol = numCols <= 26
    ? String.fromCharCode(64 + numCols)
    : String.fromCharCode(64 + Math.floor((numCols - 1) / 26)) + String.fromCharCode(65 + ((numCols - 1) % 26));
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_TRAFFIC,
    range: `${sheetName}!A${rowIndex}:${endCol}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

// GET: fetch traffic_source data + master_traffic dropdowns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'data';
    const username = searchParams.get('username') || '';

    if (type === 'master') {
      const master = await getTrafficSheetData('master_traffic');
      return NextResponse.json(master);
    }

    // Fetch traffic data
    const data = await getTrafficSheetData('traffic_source');

    // Sort newest first
    const sorted = data.sort((a: any, b: any) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching traffic store:', error);
    return NextResponse.json({ error: 'Failed to fetch traffic data' }, { status: 500 });
  }
}

// POST: add new traffic entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { store_location, taft_name, traffic_source, intention, case: caseVal, notes, created_by } = body;

    if (!store_location || !taft_name || !traffic_source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    const newRow = [
      id,
      store_location,
      taft_name,
      traffic_source,
      intention || '',
      caseVal || '',
      notes || '',
      now,
      now,
    ];

    await appendTrafficRow('traffic_source', newRow);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating traffic entry:', error);
    return NextResponse.json({ error: 'Failed to create traffic entry' }, { status: 500 });
  }
}

// PUT: update existing traffic entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, store_location, taft_name, traffic_source, intention, case: caseVal, notes } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const data = await getTrafficSheetData('traffic_source');
    const idx = data.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const existing = data[idx];
    const rowIndex = idx + 2;
    const now = new Date().toISOString();

    const updatedRow = [
      id,
      store_location ?? existing.store_location,
      taft_name ?? existing.taft_name,
      traffic_source ?? existing.traffic_source,
      intention ?? existing.intention,
      caseVal ?? existing.case,
      notes ?? existing.notes,
      existing.created_at,
      now,
    ];

    await updateTrafficRow('traffic_source', rowIndex, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating traffic entry:', error);
    return NextResponse.json({ error: 'Failed to update traffic entry' }, { status: 500 });
  }
}

// DELETE: clear a traffic row
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const data = await getTrafficSheetData('traffic_source');
    const idx = data.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const rowIndex = idx + 2;
    await updateTrafficRow('traffic_source', rowIndex, Array(9).fill(''));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting traffic entry:', error);
    return NextResponse.json({ error: 'Failed to delete traffic entry' }, { status: 500 });
  }
}