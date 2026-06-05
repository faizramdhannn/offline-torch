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

// Safe wrapper — returns [] instead of throwing if sheet doesn't exist yet
async function safeGetSheet(sheetName: string): Promise<Record<string, any>[]> {
  try {
    return await getSalesSheetData(sheetName);
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Sheet not found (400) or similar — log and return empty
    console.warn(`[sales] Sheet "${sheetName}" not available: ${msg}`);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    if (type === 'daily_sales')      return NextResponse.json(await getSalesSheetData('daily_sales'));
    if (type === 'target_sales')     return NextResponse.json(await getSalesSheetData('target_sales'));
    if (type === 'channel_traffic')  return NextResponse.json(await getSalesSheetData('channel_traffic'));
    if (type === 'spreadsheet_sales')return NextResponse.json(await getSalesSheetData('spreadsheet_sales'));
    if (type === 'gross_sales')      return NextResponse.json(await safeGetSheet('gross_sales'));
    if (type === 'daily_order')      return NextResponse.json(await safeGetSheet('daily_order'));
    if (type === 'quantity_order')   return NextResponse.json(await safeGetSheet('quantity_order'));

    // type === 'all' — fetch all 7 in parallel
    // Core sheets use getSalesSheetData (hard fail if missing)
    // New sheets use safeGetSheet (soft fail → [])
    const [
      dailySales,
      targetSales,
      channelTraffic,
      spreadsheetSales,
      grossSales,
      dailyOrder,
      quantityOrder,
    ] = await Promise.all([
      getSalesSheetData('daily_sales'),
      getSalesSheetData('target_sales'),
      getSalesSheetData('channel_traffic'),
      getSalesSheetData('spreadsheet_sales'),
      safeGetSheet('gross_sales'),
      safeGetSheet('daily_order'),
      safeGetSheet('quantity_order'),
    ]);

    return NextResponse.json({
      dailySales,
      targetSales,
      channelTraffic,
      spreadsheetSales,
      grossSales,
      dailyOrder,
      quantityOrder,
    });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}