import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_PETTY_CASH = process.env.SPREADSHEET_PETTY_CASH || '';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  try {
    const credentials = JSON.parse(credsEnv);
    if (!credentials.client_email) throw new Error('GOOGLE_CREDENTIALS missing client_email field');
    if (!credentials.private_key) throw new Error('GOOGLE_CREDENTIALS missing private_key field');
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
    throw error;
  }
}

async function getSheetsClient() {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getHistorySheetData() {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_PETTY_CASH,
    range: 'petty_cash_history!A1:ZZ',
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

// GET - fetch history (optionally filter by petty_cash_id or action)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pettyCashId = searchParams.get('petty_cash_id');
    const action = searchParams.get('action');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const historyData = await getHistorySheetData();

    let filtered = historyData.filter((item) => item.history_id);

    if (pettyCashId) {
      filtered = filtered.filter((item) => item.petty_cash_id === pettyCashId);
    }
    if (action) {
      filtered = filtered.filter((item) => item.action === action);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((item) => {
        const d = new Date(item.action_at);
        return d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => {
        const d = new Date(item.action_at);
        return d <= to;
      });
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.action_at).getTime() - new Date(a.action_at).getTime());

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST - log a history entry
// Body: { action, petty_cash_id, action_by, snapshot, notes }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, petty_cash_id, action_by, snapshot, notes } = body;

    const sheets = await getSheetsClient();

    const history_id = `H${Date.now().toString().slice(-10)}`;
    const action_at = new Date().toISOString();

    // snapshot stored as JSON string
    const snapshotStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot || {});

    const newRow = [
      history_id,       // A - history_id
      petty_cash_id,    // B - petty_cash_id
      action,           // C - action  (CREATE | UPDATE | DELETE | RESTORE)
      action_by,        // D - action_by
      action_at,        // E - action_at
      snapshotStr,      // F - snapshot (full JSON of the petty_cash row at that moment)
      notes || '',      // G - notes
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_PETTY_CASH,
      range: 'petty_cash_history!A2',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newRow] },
    });

    return NextResponse.json({ success: true, history_id });
  } catch (error) {
    console.error('Error logging history:', error);
    return NextResponse.json(
      { error: 'Failed to log history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT - restore a deleted entry back to petty_cash sheet
// Body: { history_id, restore_by }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { history_id, restore_by } = body;

    const sheets = await getSheetsClient();

    // Fetch history to find the snapshot
    const historyData = await getHistorySheetData();
    const historyEntry = historyData.find((item) => item.history_id === history_id);

    if (!historyEntry) {
      return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
    }

    let snapshot: Record<string, string>;
    try {
      snapshot = JSON.parse(historyEntry.snapshot);
    } catch {
      return NextResponse.json({ error: 'Invalid snapshot data' }, { status: 400 });
    }

    // Check if entry already exists in petty_cash (not empty)
    const pettyCashResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_PETTY_CASH,
      range: 'petty_cash!A1:ZZ',
    });
    const pcRows = pettyCashResponse.data.values || [];
    const pcHeaders = pcRows[0] || [];
    const existingRows = pcRows.slice(1);

    // Find an empty row or the row with matching id
    let targetRowIndex = -1;
    let foundExisting = false;

    for (let i = 0; i < existingRows.length; i++) {
      const rowId = existingRows[i][0];
      if (rowId === snapshot.id) {
        targetRowIndex = i + 2; // +2: header + 0-based
        foundExisting = true;
        break;
      }
    }

    // If not found as existing, find first empty row
    if (!foundExisting) {
      for (let i = 0; i < existingRows.length; i++) {
        if (!existingRows[i][0] || existingRows[i][0] === '') {
          targetRowIndex = i + 2;
          break;
        }
      }
    }

    // Build the restored row in correct column order
    // Columns: id, date, description, category, value, store, ket, transfer, link_url, update_by, created_at, update_at
    const now = new Date().toISOString();
    const restoredRow = [
      snapshot.id || '',
      snapshot.date || '',
      snapshot.description || '',
      snapshot.category || '',
      snapshot.value || '',
      snapshot.store || '',
      snapshot.ket || '',
      snapshot.transfer || 'FALSE',
      snapshot.link_url || '',
      restore_by,          // update_by = the person who restored
      snapshot.created_at || now,
      now,                 // update_at = restore time
    ];

    if (targetRowIndex > 0) {
      // Update existing (previously cleared) row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_PETTY_CASH,
        range: `petty_cash!A${targetRowIndex}:L${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [restoredRow] },
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_PETTY_CASH,
        range: 'petty_cash!A2',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [restoredRow] },
      });
    }

    // Log the restore action in history
    const restoreHistoryId = `H${Date.now().toString().slice(-10)}`;
    const action_at = new Date().toISOString();
    const restoreRow = [
      restoreHistoryId,
      snapshot.id || '',
      'RESTORE',
      restore_by,
      action_at,
      historyEntry.snapshot,
      `Restored from history entry ${history_id}`,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_PETTY_CASH,
      range: 'petty_cash_history!A2',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [restoreRow] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring entry:', error);
    return NextResponse.json(
      { error: 'Failed to restore entry', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}