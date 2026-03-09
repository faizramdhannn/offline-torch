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
    
    // Filter based on user permissions
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

    // Generate ID (short numeric ID)
    const id = Date.now().toString().slice(-8);
    
    // Format date
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    let linkUrl = '';
    
    // Upload file to Google Drive if present
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
    
    // Extract raw number from value
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
      createdAt
    ];

    await appendSheetData('petty_cash', [newEntry]);

    // ── Auto debit balance jika dana talang + odi dan transfer TRUE saat POST ──
    if (transfer && isDanaTalangOdi(ket)) {
      await addBalanceDebit(
        rawValue,
        `Auto debit - ${description} (${store})`,
        username
      );
    }
    // ──────────────────────────────────────────────────────────────────────────

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

    // Get all petty cash data to find the row index
    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const entry = pettyCashData[entryIndex];
    const rowIndex = entryIndex + 2;
    
    let linkUrl = entry.link_url || '';
    
    // Upload new file if present
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
      now
    ];

    await updateSheetRow('petty_cash', rowIndex, updatedEntry);

    // ── Auto debit balance jika: ──────────────────────────────────────────────
    // 1. transfer sekarang TRUE
    // 2. ket mengandung "dana talang" dan "odi"
    // 3. sebelumnya transfer BELUM TRUE (hindari double debit)
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
    // ──────────────────────────────────────────────────────────────────────────

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

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Get all petty cash data
    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const rowIndex = entryIndex + 2;
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