import { google } from 'googleapis';

interface JavelinAuthResponse {
  p_user_id: string;
  p_session_key: string;
  p_session_token: string;
}

interface JavelinInventoryRecord {
  warehouse_id?: string;
  location_type?: string;
  location_id?: string;
  client_id?: string;
  product_id?: string;
  description_1?: string;
  pack_id?: string;
  batch?: string;
  expired_date?: string;
  base_qty?: string;
  base_uom?: string;
  stock_type?: string;
}

/**
 * Clean cookie string - extract only the sess= part
 */
function cleanCookie(cookie: string): string {
  if (!cookie) return cookie;

  if (cookie.includes(';')) {
    const parts = cookie.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('sess=')) {
        return trimmed;
      }
    }
    return parts[0].trim();
  }

  return cookie.trim();
}

/**
 * Get authentication tokens from Javelin
 */
async function getJavelinAuthentication(cookie: string): Promise<JavelinAuthResponse> {
  try {
    const cleanedCookie = cleanCookie(cookie);

    const codeUrl = `https://torch.javelin-apps.com/sess/code?c=${Date.now()}`;

    const codeResponse = await fetch(codeUrl, {
      headers: {
        accept: 'application/json',
        cookie: cleanedCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!codeResponse.ok) {
      throw new Error(`Failed to get code: ${codeResponse.status}`);
    }

    const codeData = await codeResponse.json();
    const { code, verifier } = codeData;

    const loginUrl = 'https://torch.javelin-apps.com/v2/login';

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: '982394jlksjdfjkh340884lsdfjsldkfisuerwjfds823498234xpudfs',
        'content-type': 'application/json',
        cookie: cleanedCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        p_session_key: '',
        p_user_id: '',
        code,
        verifier,
        user_id: 'STOCK_ADMIN',
        password: 'Welcome1',
        app_version: 'JAVELIN Web',
        os_version: 'Windows 10',
        device_model: 'Chrome 126.0.0.0',
        device_id: '1210110504',
        wsade: '0',
        wsade_code: '',
        utc_offset: '420',
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();

    if (!loginData.p_user_id) {
      throw new Error('Login response missing p_user_id');
    }

    return {
      p_user_id: loginData.p_user_id,
      p_session_key: loginData.p_session_key,
      p_session_token: loginData.p_session_token,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Fetch inventory data from Javelin API
 */
async function getJavelinInventory(cookie: string): Promise<JavelinInventoryRecord[]> {
  try {
    const auth = await getJavelinAuthentication(cookie);

    const inventoryUrl = 'https://torch.javelin-apps.com/v2/inventory_list';

    const response = await fetch(inventoryUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: auth.p_session_token,
        'content-type': 'application/json',
        cookie: cleanCookie(cookie),
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        p_session_key: auth.p_session_key,
        p_user_id: auth.p_user_id,
        p_param: {
          client_id: 'TORCH-ONLINE',
          warehouse_id: 'DP01',
          utc_offset: 420,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Fetch inventory failed: ${response.status}`);
    }

    const data = await response.json();
    const rawData = data.out_record;
    const parsedData = JSON.parse(rawData);

    console.log(`   Retrieved ${parsedData.length} records from Javelin API`);
    return parsedData;
  } catch (error) {
    console.error('Fetch inventory error:', error);
    throw error;
  }
}

/**
 * Convert Unix timestamp to datetime string
 */
function convertTimestamp(timestamp: string | undefined): string {
  if (!timestamp || timestamp === '' || timestamp === '0') {
    return '';
  }

  try {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return '';
  }
}

/**
 * Format data for Google Sheets (only up to stock_type)
 */
function formatForSheets(data: JavelinInventoryRecord[]): any[][] {
  const headers = [
    'Warehouse ID',
    'Location Type',
    'Location ID',
    'Client ID',
    'Product ID',
    'Description',
    'Pack ID',
    'Batch',
    'Expired Date',
    'Base Qty',
    'Base Uom',
    'Stock Type',
  ];

  const rows = data.map(item => [
    item.warehouse_id || '',
    item.location_type || '',
    item.location_id || '',
    item.client_id || '',
    item.product_id || '',
    item.description_1 || '',
    item.pack_id || '',
    item.batch || '',
    convertTimestamp(item.expired_date),
    item.base_qty || '',
    item.base_uom || '',
    item.stock_type || '',
  ]);

  return [headers, ...rows];
}

/**
 * Get sheet ID by name
 */
async function getSheetId(
  sheets: any,
  spreadsheetId: string,
  sheetName: string
): Promise<number> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(
    (s: any) => s.properties?.title === sheetName
  );

  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  return sheet.properties.sheetId;
}

/**
 * Ensure sheet has enough rows, extend if needed
 */
async function ensureSheetCapacity(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  requiredRows: number
): Promise<void> {
  const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: 'ROWS',
            length: requiredRows + 1000, // tambah buffer 1000
          },
        },
      ],
    },
  });

  console.log(`   Ensured sheet capacity: ${requiredRows + 1000} rows`);
}

/**
 * Update Google Sheet with new data
 */
async function updateGoogleSheet(
  data: any[][],
  sheetName: string = 'javelin'
): Promise<number> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_STOCK;

    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_STOCK not set');
    }

    // Pastikan sheet punya cukup baris sebelum update
    await ensureSheetCapacity(sheets, spreadsheetId, sheetName, data.length);

    // Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ`,
    });

    // Upload semua data sekaligus (aman karena hanya 12 kolom)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: data,
      },
    });

    console.log(`Successfully updated ${data.length - 1} rows to sheet '${sheetName}'`);
    return data.length - 1;
  } catch (error) {
    console.error('Error updating Google Sheet:', error);
    throw error;
  }
}

/**
 * Update last_update sheet with current timestamp
 */
async function updateLastUpdateSheet(): Promise<void> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_STOCK;

    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_STOCK not set');
    }

    let existingData: Record<string, string> = {};
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'last_update!A1:B',
      });

      const rows = response.data.values || [];
      if (rows.length > 1) {
        rows.slice(1).forEach(row => {
          if (row.length >= 2) {
            existingData[row[0]] = row[1];
          }
        });
      }
    } catch {
      // Sheet doesn't exist or is empty
    }

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = jakartaTime.getDate().toString().padStart(2, '0');
    const month = months[jakartaTime.getMonth()];
    const year = jakartaTime.getFullYear();
    const hours = jakartaTime.getHours().toString().padStart(2, '0');
    const minutes = jakartaTime.getMinutes().toString().padStart(2, '0');

    const dateStr = `${day} ${month} ${year}, ${hours}:${minutes}`;

    existingData['Javelin'] = dateStr;

    if (!existingData['ERP']) {
      existingData['ERP'] = '-';
    }

    const values = [
      ['type', 'last_update'],
      ['ERP', existingData['ERP']],
      ['Javelin', existingData['Javelin']],
    ];

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'last_update!A1:B',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'last_update!A1',
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    console.log(`Updated last_update sheet with timestamp: ${dateStr}`);
  } catch (error) {
    console.error('Error updating last_update sheet:', error);
  }
}

/**
 * Main function to refresh Javelin inventory
 */
export async function refreshJavelinInventory(
  cookie: string
): Promise<{ success: boolean; message: string; rows: number }> {
  try {
    console.log('Starting Javelin inventory refresh...');

    console.log('1. Fetching data from Javelin API...');
    const rawData = await getJavelinInventory(cookie);

    if (rawData.length === 0) {
      return { success: false, message: 'No data returned from Javelin API', rows: 0 };
    }

    console.log('2. Formatting data for Google Sheets...');
    const formattedData = formatForSheets(rawData);
    console.log(`   Formatted ${formattedData.length - 1} rows with ${formattedData[0].length} columns`);

    console.log('3. Updating Google Sheet...');
    const rowsUpdated = await updateGoogleSheet(formattedData, 'javelin');

    console.log('4. Updating last_update sheet...');
    await updateLastUpdateSheet();

    console.log('✅ SUCCESS!');
    console.log(`   Total rows imported: ${rowsUpdated}`);

    return {
      success: true,
      message: 'Javelin inventory refreshed successfully',
      rows: rowsUpdated,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ ERROR:', errorMsg);
    return {
      success: false,
      message: errorMsg,
      rows: 0,
    };
  }
}