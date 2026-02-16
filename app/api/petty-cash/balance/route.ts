import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_BALANCE = process.env.SPREADSHEET_BALANCE || '';

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

async function getBalanceSheetData() {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_BALANCE,
    range: 'petty_cash_balance!A1:ZZ',
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });
}

async function getPettyCashSheetData() {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_PETTY_CASH || '';
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'petty_cash!A1:ZZ',
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Fetch balance entries
    const balanceData = await getBalanceSheetData();

    // Fetch petty cash data for paid/unpaid
    const pettyCashData = await getPettyCashSheetData();

    // Parse dates helper
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const parseDate = (dateString: string) => {
      if (!dateString) return null;
      const parts = dateString.split(' ');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
      }
      return new Date(dateString);
    };

    // Filter balance data by date
    let filteredBalance = balanceData.filter((item: any) => item.id); // filter empty rows
    if (dateFrom) {
      const from = new Date(dateFrom);
      filteredBalance = filteredBalance.filter((item: any) => {
        const d = item.created_at ? new Date(item.created_at) : parseDate(item.created_at);
        return d && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filteredBalance = filteredBalance.filter((item: any) => {
        const d = item.created_at ? new Date(item.created_at) : parseDate(item.created_at);
        return d && d <= to;
      });
    }

    // Calculate balance (credit - debit)
    let balance = 0;
    for (const item of filteredBalance) {
      const val = parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0;
      if ((item.type_balance || '').toLowerCase() === 'credit') {
        balance += val;
      } else if ((item.type_balance || '').toLowerCase() === 'debit') {
        balance -= val;
      }
    }

    // Calculate paid (transfer = TRUE) and unpaid (transfer = FALSE) from petty cash
    let filteredPettyCash = pettyCashData.filter((item: any) => item.id);
    if (dateFrom) {
      const from = new Date(dateFrom);
      filteredPettyCash = filteredPettyCash.filter((item: any) => {
        const d = parseDate(item.date);
        return d && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      filteredPettyCash = filteredPettyCash.filter((item: any) => {
        const d = parseDate(item.date);
        return d && d <= to;
      });
    }

    const paid = filteredPettyCash
      .filter((item: any) => item.transfer === 'TRUE')
      .reduce((sum: number, item: any) => {
        return sum + (parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0);
      }, 0);

    const unpaid = filteredPettyCash
      .filter((item: any) => item.transfer === 'FALSE' || item.transfer === null)
      .reduce((sum: number, item: any) => {
        return sum + (parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0);
      }, 0);

    return NextResponse.json({
      balance,
      paid,
      unpaid,
      entries: filteredBalance,
    });
  } catch (error) {
    console.error('Error fetching balance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type_balance, value, notes, update_by } = await request.json();

    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const id = Date.now().toString().slice(-8);
    const now = new Date().toISOString();
    const rawValue = String(value).replace(/[^0-9]/g, '');

    const newEntry = [id, type_balance, rawValue, notes || '', update_by, now, now];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_BALANCE,
      range: 'petty_cash_balance!A2',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newEntry] },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating balance entry:', error);
    return NextResponse.json(
      { error: 'Failed to create balance entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, type_balance, value, notes, update_by } = await request.json();

    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Get all balance data to find the row index
    const balanceData = await getBalanceSheetData();
    const entryIndex = balanceData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const entry = balanceData[entryIndex];
    const rowIndex = entryIndex + 2; // +2 for header and 0-based index
    
    const now = new Date().toISOString();
    const rawValue = String(value).replace(/[^0-9]/g, '');

    const updatedEntry = [
      id,
      type_balance,
      rawValue,
      notes || '',
      update_by,
      entry.created_at, // Keep original created_at
      now // Update the update_at
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_BALANCE,
      range: `petty_cash_balance!A${rowIndex}:G${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [updatedEntry] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating balance entry:', error);
    return NextResponse.json(
      { error: 'Failed to update balance entry' },
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

    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Get all balance data
    const balanceData = await getBalanceSheetData();
    const entryIndex = balanceData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const rowIndex = entryIndex + 2;
    
    // Clear the row by updating with empty values
    const emptyRow = Array(7).fill(''); // 7 columns (id, type_balance, value, notes, update_by, created_at, update_at)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_BALANCE,
      range: `petty_cash_balance!A${rowIndex}:G${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [emptyRow] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting balance entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete balance entry' },
      { status: 500 }
    );
  }
}