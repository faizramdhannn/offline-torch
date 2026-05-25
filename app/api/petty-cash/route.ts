import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';
import { google } from 'googleapis';

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

// Auto-add debit entry to petty_cash_balance
async function addBalanceDebit(value: string, notes: string, updateBy: string) {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const SPREADSHEET_BALANCE = process.env.SPREADSHEET_BALANCE || '';

  const id = Date.now().toString().slice(-8);
  const now = new Date().toISOString();
  const rawValue = String(value).replace(/[^0-9]/g, '');

  const newEntry = [id, 'debit', rawValue, notes, updateBy, now, now];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_BALANCE,
    range: 'petty_cash_balance!A2',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [newEntry] },
  });
}

// Log history to petty_cash_history sheet
async function logHistory(
  petty_cash_id: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
  action_by: string,
  snapshot: Record<string, string>,
  notes?: string
) {
  try {
    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_PETTY_CASH = process.env.SPREADSHEET_PETTY_CASH || '';

    const history_id = `H${Date.now().toString().slice(-10)}`;
    const action_at = new Date().toISOString();

    const newRow = [
      history_id,
      petty_cash_id,
      action,
      action_by,
      action_at,
      JSON.stringify(snapshot),
      notes || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_PETTY_CASH,
      range: 'petty_cash_history!A2',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newRow] },
    });
  } catch (error) {
    // Non-fatal: log error but don't break main operation
    console.error('Failed to write history log:', error);
  }
}

// Check if ket contains both "dana talang" and "odi"
function isDanaTalangOdi(ket: string): boolean {
  const lower = (ket || '').toLowerCase();
  return lower.includes('dana talang') && lower.includes('odi');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const isAdmin = searchParams.get('isAdmin') === 'true';

    const data = await getSheetData('petty_cash');

    // Sort by date (newest first)
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const parseDate = (dateString: string) => {
      if (!dateString) return new Date(0);
      const parts = dateString.split(' ');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
      }
      return new Date(dateString);
    };
    const sortedData = data.sort((a: any, b: any) => {
      return parseDate(b.date).getTime() - parseDate(a.date).getTime();
    });

    if (!isAdmin && username) {
      const filteredData = sortedData.filter((item: any) => item.store === username);
      return NextResponse.json(filteredData);
    }

    return NextResponse.json(sortedData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch petty cash data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const value = formData.get('value') as string;
    const store = formData.get('store') as string;
    const ket = formData.get('ket') as string || '';
    const transfer = formData.get('transfer') === 'true';
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string;

    const id = Date.now().toString().slice(-8);

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

    let linkUrl = '';

    if (file) {
      const fileName = `${date.replace(/ /g, '_')}_${category}_${store}_${id}`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        store
      );
    }

    const createdAt = now.toISOString();
    const rawValue = value.replace(/[^0-9]/g, '');

    const newEntry = [
      id,
      date,
      description,
      category,
      rawValue,
      store,
      ket,
      transfer ? 'TRUE' : 'FALSE',
      linkUrl,
      username,
      createdAt,
      createdAt,
    ];

    await appendSheetData('petty_cash', [newEntry]);

    // Log CREATE history
    await logHistory(
      id,
      'CREATE',
      username,
      {
        id, date, description, category, value: rawValue,
        store, ket, transfer: transfer ? 'TRUE' : 'FALSE',
        link_url: linkUrl, update_by: username,
        created_at: createdAt, update_at: createdAt,
      },
      `Created by ${username}`
    );

    // Auto debit balance if dana talang + odi and transfer TRUE
    if (transfer && isDanaTalangOdi(ket)) {
      await addBalanceDebit(
        rawValue,
        `Auto debit - ${description} (${store})`,
        username
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to create petty cash entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const value = formData.get('value') as string;
    const store = formData.get('store') as string;
    const ket = formData.get('ket') as string || '';
    const transfer = formData.get('transfer') === 'true';
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string;

    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);

    if (entryIndex === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const entry = pettyCashData[entryIndex];
    const rowIndex = entryIndex + 2;

    // Snapshot BEFORE update (for audit trail)
    const snapshotBefore = {
      id: entry.id,
      date: entry.date,
      description: entry.description,
      category: entry.category,
      value: entry.value,
      store: entry.store,
      ket: entry.ket,
      transfer: entry.transfer,
      link_url: entry.link_url,
      update_by: entry.update_by,
      created_at: entry.created_at,
      update_at: entry.update_at,
    };

    let linkUrl = entry.link_url || '';

    if (file) {
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const date = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
      const fileName = `${date.replace(/ /g, '_')}_${category}_${store}_${id}`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        store
      );
    }

    const now = new Date().toISOString();
    const rawValue = value.replace(/[^0-9]/g, '');

    const updatedEntry = [
      id,
      entry.date,
      description,
      category,
      rawValue,
      store,
      ket,
      transfer ? 'TRUE' : 'FALSE',
      linkUrl,
      username,
      entry.created_at,
      now,
    ];

    await updateSheetRow('petty_cash', rowIndex, updatedEntry);

    // Build diff notes
    const changes: string[] = [];
    if (snapshotBefore.description !== description) changes.push(`description: "${snapshotBefore.description}" → "${description}"`);
    if (snapshotBefore.category !== category) changes.push(`category: "${snapshotBefore.category}" → "${category}"`);
    if (snapshotBefore.value !== rawValue) changes.push(`value: ${snapshotBefore.value} → ${rawValue}`);
    if (snapshotBefore.ket !== ket) changes.push(`ket: "${snapshotBefore.ket}" → "${ket}"`);
    if ((snapshotBefore.transfer || '').toUpperCase() !== (transfer ? 'TRUE' : 'FALSE')) {
      changes.push(`transfer: ${snapshotBefore.transfer} → ${transfer ? 'TRUE' : 'FALSE'}`);
    }

    // Log UPDATE history — snapshot is the BEFORE state so it can be restored
    await logHistory(
      id,
      'UPDATE',
      username,
      snapshotBefore,
      changes.length > 0 ? `Changed: ${changes.join('; ')}` : 'No field changes detected'
    );

    // Auto debit balance logic
    const wasAlreadyTransferred = (entry.transfer || '').toUpperCase() === 'TRUE';
    const isNowTransferred = transfer === true;
    const ketHasDanaTalangOdi = isDanaTalangOdi(ket);

    if (isNowTransferred && ketHasDanaTalangOdi && !wasAlreadyTransferred) {
      await addBalanceDebit(
        rawValue,
        `Auto debit - ${description} (${store})`,
        username
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to update petty cash entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deletedBy = searchParams.get('deletedBy') || 'unknown';

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);

    if (entryIndex === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const entry = pettyCashData[entryIndex];
    const rowIndex = entryIndex + 2;

    // Snapshot the full entry BEFORE deletion
    const snapshot = {
      id: entry.id,
      date: entry.date,
      description: entry.description,
      category: entry.category,
      value: entry.value,
      store: entry.store,
      ket: entry.ket,
      transfer: entry.transfer,
      link_url: entry.link_url,
      update_by: entry.update_by,
      created_at: entry.created_at,
      update_at: entry.update_at,
    };

    // Log DELETE history BEFORE clearing
    await logHistory(
      id,
      'DELETE',
      deletedBy,
      snapshot,
      `Deleted by ${deletedBy} — was: ${entry.description} | ${entry.category} | ${entry.value} | ${entry.store}`
    );

    // Clear the row
    const updatedRow = Array(12).fill('');
    await updateSheetRow('petty_cash', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete petty cash entry' },
      { status: 500 }
    );
  }
}