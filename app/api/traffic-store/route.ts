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

// Appends the core row (A–P, 16 cols) and, if provided, the extra "revisi survey"
// fields (S–Y, 7 cols) on the SAME newly-created row. Columns Q (value_order) and
// R (discount_code) contain sheet formulas and are always skipped/untouched.
// Returns the 1-based sheet row number that was written, so callers (or later
// updates) can reference it if needed.
async function appendTrafficRow(sheetName: string, row: any[], extraRow?: any[]): Promise<number> {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_TRAFFIC,
    range: `${sheetName}!A2`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  // Parse the row number Google Sheets actually used, e.g. "traffic_source!A5:P5" -> 5
  const updatedRange = appendRes.data.updates?.updatedRange || '';
  const match = updatedRange.match(/![A-Z]+(\d+)/);
  const rowIndex = match ? parseInt(match[1], 10) : -1;

  if (extraRow && rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_TRAFFIC,
      range: `${sheetName}!S${rowIndex}:Y${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [extraRow] },
    });
  }

  return rowIndex;
}

// Updates the core row (A–P, 16 cols) and, if provided, the extra "revisi survey"
// fields (S–Y, 7 cols) for the same row. Columns Q (value_order) and R (discount_code)
// contain sheet formulas and are always skipped/untouched.
async function updateTrafficRow(sheetName: string, rowIndex: number, row: any[], extraRow?: any[]) {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  // row has 16 columns (A–P); columns Q+ (value_order, discount_code) are formula columns — skip.
  const numCols = row.length; // should be 16
  const endCol = numCols <= 26
    ? String.fromCharCode(64 + numCols)
    : String.fromCharCode(64 + Math.floor((numCols - 1) / 26)) + String.fromCharCode(65 + ((numCols - 1) % 26));
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_TRAFFIC,
    range: `${sheetName}!A${rowIndex}:${endCol}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  if (extraRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_TRAFFIC,
      range: `${sheetName}!S${rowIndex}:Y${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [extraRow] },
    });
  }
}

// GET: fetch traffic_source data + master_traffic dropdowns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'data';

    if (type === 'master') {
      const master = await getTrafficSheetData('master_traffic');
      return NextResponse.json(master);
    }

    // Fetch traffic data
    const data = await getTrafficSheetData('traffic_source');

    // Sort newest first by date (fallback to created_at if date is missing)
    const sorted = data.sort((a: any, b: any) => {
      const aTime = new Date(a.date || a.created_at || 0).getTime();
      const bTime = new Date(b.date || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching traffic store:', error);
    return NextResponse.json({ error: 'Failed to fetch traffic data' }, { status: 500 });
  }
}

// Reasons in reason_not_buy that relate to price — only these unlock budget_range
const PRICE_REASONS = ['Harga Di Atas Budget', 'Harga Lebih Murah Online', 'Menunggu Promo Lebih Besar'];

// POST: add new traffic entry
// Sheet columns (A–P, 16 cols):
//   id | date | store_location | taft_name | customer_convert | traffic_source
//   | wag_addition | eiger_addition | organic_addition | brand_competitor
//   | intention | case | notes | sales_order | created_at | update_at
// Column Q, R (value_order, discount_code) contain sheet formulas — never written here.
// Sheet columns (S–Y, 7 cols — REVISI SURVEY):
//   customer_segment | product_category | product_detail | reason_not_buy
//   | budget_range | alt_purchase_channel | reason_buy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date, store_location, taft_name, customer_convert, traffic_source,
      wag_addition, eiger_addition, organic_addition, brand_competitor,
      intention, case: caseVal, notes, sales_order, created_by,
      customer_segment, product_category, product_detail, reason_not_buy,
      budget_range, alt_purchase_channel, reason_buy,
    } = body;

    if (!date || !store_location || !taft_name || !traffic_source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (customer_convert === 'Tidak Beli' && !reason_not_buy) {
      return NextResponse.json({ error: 'Alasan tidak beli wajib diisi' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Conditional additions — only fill if relevant traffic_source
    const wagVal = traffic_source === 'Whatsapp Group' ? (wag_addition || '') : '';
    const eigerVal = traffic_source === 'Dari Eiger' ? (eiger_addition || '') : '';
    const organicVal = traffic_source === 'Traffic Organic/Walk In' ? (organic_addition || '') : '';

    // sales_order only relevant when customer_convert === 'Beli'
    const salesOrderVal = customer_convert === 'Beli' ? (sales_order || '') : '';

    // 16 columns — A through P
    const newRow = [
      id,               // A: id
      date,             // B: date
      store_location,   // C: store_location
      taft_name,        // D: taft_name
      customer_convert || '', // E: customer_convert
      traffic_source,   // F: traffic_source
      wagVal,           // G: wag_addition
      eigerVal,         // H: eiger_addition
      organicVal,       // I: organic_addition
      brand_competitor || '', // J: brand_competitor
      intention || '',  // K: intention
      caseVal || '',    // L: case
      notes || '',      // M: notes
      salesOrderVal,    // N: sales_order
      now,              // O: created_at
      now,              // P: update_at
    ];

    // Conditional logic for revisi survey fields
    const reasonNotBuyVal = customer_convert === 'Tidak Beli' ? (reason_not_buy || '') : '';
    const budgetRangeVal = reasonNotBuyVal && PRICE_REASONS.includes(reasonNotBuyVal) ? (budget_range || '') : '';
    const altChannelVal = customer_convert === 'Tidak Beli' ? (alt_purchase_channel || '') : '';
    const reasonBuyVal = customer_convert === 'Beli' ? (reason_buy || '') : '';

    // 7 columns — S through Y
    const extraRow = [
      customer_segment || '',   // S
      product_category || '',   // T
      product_detail || '',     // U
      reasonNotBuyVal,          // V
      budgetRangeVal,           // W
      altChannelVal,            // X
      reasonBuyVal,             // Y
    ];

    await appendTrafficRow('traffic_source', newRow, extraRow);

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
    const {
      id, date, store_location, taft_name, customer_convert, traffic_source,
      wag_addition, eiger_addition, organic_addition, brand_competitor,
      intention, case: caseVal, notes, sales_order,
      customer_segment, product_category, product_detail, reason_not_buy,
      budget_range, alt_purchase_channel, reason_buy,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const data = await getTrafficSheetData('traffic_source');
    const idx = data.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const existing = data[idx];
    const rowIndex = idx + 2;
    const now = new Date().toISOString();

    const newTrafficSource = traffic_source ?? existing.traffic_source;
    const newConvert = customer_convert ?? existing.customer_convert;

    const wagVal = newTrafficSource === 'Whatsapp Group' ? (wag_addition ?? existing.wag_addition ?? '') : '';
    const eigerVal = newTrafficSource === 'Dari Eiger' ? (eiger_addition ?? existing.eiger_addition ?? '') : '';
    const organicVal = newTrafficSource === 'Traffic Organic/Walk In' ? (organic_addition ?? existing.organic_addition ?? '') : '';

    const salesOrderVal = newConvert === 'Beli' ? (sales_order ?? existing.sales_order ?? '') : '';

    // 16 columns — A through P (Q, R formula columns untouched)
    const updatedRow = [
      id,                                                    // A
      date ?? existing.date,                                 // B
      store_location ?? existing.store_location,             // C
      taft_name ?? existing.taft_name,                       // D
      newConvert,                                            // E
      newTrafficSource,                                      // F
      wagVal,                                                // G
      eigerVal,                                              // H
      organicVal,                                            // I
      brand_competitor ?? existing.brand_competitor ?? '',   // J
      intention ?? existing.intention,                       // K
      caseVal ?? existing.case,                              // L
      notes ?? existing.notes,                                // M
      salesOrderVal,                                         // N
      existing.created_at,                                   // O
      now,                                                    // P
    ];

    // Revisi survey fields (S–Y), falling back to existing values when not sent
    const reasonNotBuyVal = newConvert === 'Tidak Beli' ? (reason_not_buy ?? existing.reason_not_buy ?? '') : '';
    const budgetRangeVal = reasonNotBuyVal && PRICE_REASONS.includes(reasonNotBuyVal)
      ? (budget_range ?? existing.budget_range ?? '')
      : '';
    const altChannelVal = newConvert === 'Tidak Beli' ? (alt_purchase_channel ?? existing.alt_purchase_channel ?? '') : '';
    const reasonBuyVal = newConvert === 'Beli' ? (reason_buy ?? existing.reason_buy ?? '') : '';

    const extraRow = [
      customer_segment ?? existing.customer_segment ?? '',   // S
      product_category ?? existing.product_category ?? '',   // T
      product_detail ?? existing.product_detail ?? '',       // U
      reasonNotBuyVal,                                        // V
      budgetRangeVal,                                         // W
      altChannelVal,                                          // X
      reasonBuyVal,                                           // Y
    ];

    await updateTrafficRow('traffic_source', rowIndex, updatedRow, extraRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating traffic entry:', error);
    return NextResponse.json({ error: 'Failed to update traffic entry' }, { status: 500 });
  }
}

// DELETE: clear a traffic row (16 cols only, formula cols preserved)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const data = await getTrafficSheetData('traffic_source');
    const idx = data.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const rowIndex = idx + 2;
    // Clear the 16 writable columns (A–P) and the 7 revisi survey columns (S–Y);
    // formula columns Q, R are untouched.
    await updateTrafficRow('traffic_source', rowIndex, Array(16).fill(''), Array(7).fill(''));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting traffic entry:', error);
    return NextResponse.json({ error: 'Failed to delete traffic entry' }, { status: 500 });
  }
}