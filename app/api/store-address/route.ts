import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  }
  try {
    return JSON.parse(credsEnv);
  } catch (error) {
    throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
  }
}

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.SPREADSHEET_STORE;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'SPREADSHEET_STORE environment variable is not set' },
        { status: 500 }
      );
    }

    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'store_address!A:D',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json([]);
    }

    // Skip header row, map to objects
    const headers = rows[0];
    const data = rows.slice(1)
      .filter((row: string[]) => row.some(cell => cell && cell.trim() !== ''))
      .map((row: string[]) => ({
        id: row[0] || '',
        store_location: row[1] || '',
        phone_number: row[2] || '',
        address: row[3] || '',
      }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching store addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store addresses' },
      { status: 500 }
    );
  }
}