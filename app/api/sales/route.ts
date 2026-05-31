import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_SALES = process.env.SPREADSHEET_SALES || '';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) throw new Error('GOOGLE_CREDENTIALS not set');
  try {
    return JSON.parse(credsEnv);
  } catch {
    throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
  }
}

async function getSalesSheetData(sheetName: string): Promise<Record<string, any>[]> {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_SALES,
    range: `${sheetName}!A1:ZZ`,
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0] as string[];
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
    .map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    if (type === 'daily_sales') {
      const data = await getSalesSheetData('daily_sales');
      return NextResponse.json(data);
    }

    if (type === 'target_sales') {
      const data = await getSalesSheetData('target_sales');
      return NextResponse.json(data);
    }

    if (type === 'channel_traffic') {
      const data = await getSalesSheetData('channel_traffic');
      return NextResponse.json(data);
    }

    if (type === 'spreadsheet_sales') {
      const data = await getSalesSheetData('spreadsheet_sales');
      return NextResponse.json(data);
    }

    // type === 'all' — fetch all 4 in parallel
    const [dailySales, targetSales, channelTraffic, spreadsheetSales] = await Promise.all([
      getSalesSheetData('daily_sales'),
      getSalesSheetData('target_sales'),
      getSalesSheetData('channel_traffic'),
      getSalesSheetData('spreadsheet_sales'),
    ]);

    return NextResponse.json({ dailySales, targetSales, channelTraffic, spreadsheetSales });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}