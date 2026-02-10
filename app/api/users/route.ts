import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { google } from 'googleapis';

const SPREADSHEET_MAP: Record<string, string> = {
  users: process.env.SPREADSHEET_USERS || '',
};

function getSpreadsheetId(sheetName: string): string {
  return SPREADSHEET_MAP[sheetName] || '';
}

async function updateSheetRow(sheetName: string, rowIndex: number, data: any[]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Calculate the end column based on data length
    // A=1, B=2, ..., Z=26, AA=27, AB=28, etc.
    const numColumns = data.length;
    let endColumn = '';
    
    if (numColumns <= 26) {
      endColumn = String.fromCharCode(64 + numColumns); // A-Z
    } else {
      const firstChar = String.fromCharCode(64 + Math.floor((numColumns - 1) / 26));
      const secondChar = String.fromCharCode(65 + ((numColumns - 1) % 26));
      endColumn = firstChar + secondChar;
    }

    const range = `${sheetName}!A${rowIndex}:${endColumn}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [data],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating sheet row:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('users');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, permissions } = await request.json();

    // Get all users to find the row index
    const users = await getSheetData('users');
    const userIndex = users.findIndex((u: any) => u.id === id);
    
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[userIndex];
    
    // Update row (rowIndex is userIndex + 2 because of 1-based index and header row)
    const rowIndex = userIndex + 2;
    
    // Format timestamp with correct timezone
    const now = new Date();
    const timestamp = now.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });
    
    const updatedRow = [
      user.id,
      user.name,
      user.user_name,
      user.password,
      permissions.dashboard ? 'TRUE' : 'FALSE',
      permissions.order_report ? 'TRUE' : 'FALSE',
      permissions.stock ? 'TRUE' : 'FALSE',
      permissions.registration_request ? 'TRUE' : 'FALSE',
      permissions.user_setting ? 'TRUE' : 'FALSE',
      permissions.petty_cash ? 'TRUE' : 'FALSE',
      permissions.petty_cash_add ? 'TRUE' : 'FALSE',
      permissions.petty_cash_export ? 'TRUE' : 'FALSE',
      permissions.order_report_import ? 'TRUE' : 'FALSE',
      permissions.order_report_export ? 'TRUE' : 'FALSE',
      permissions.customer ? 'TRUE' : 'FALSE',
      permissions.voucher ? 'TRUE' : 'FALSE',
      permissions.bundling ? 'TRUE' : 'FALSE',
      // Stock permissions
      permissions.stock_import ? 'TRUE' : 'FALSE',
      permissions.stock_export ? 'TRUE' : 'FALSE',
      permissions.stock_view_store ? 'TRUE' : 'FALSE',
      permissions.stock_view_pca ? 'TRUE' : 'FALSE',
      permissions.stock_view_master ? 'TRUE' : 'FALSE',
      permissions.stock_view_hpp ? 'TRUE' : 'FALSE',
      permissions.stock_view_hpt ? 'TRUE' : 'FALSE',
      permissions.stock_view_hpj ? 'TRUE' : 'FALSE',
      permissions.stock_refresh_javelin ? 'TRUE' : 'FALSE',
      permissions.canvasing_export ? 'TRUE' : 'FALSE',
      permissions.canvasing ? 'TRUE' : 'FALSE',
      timestamp
    ];

    console.log(`Updating row ${rowIndex} with ${updatedRow.length} columns`);

    await updateSheetRow('users', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}