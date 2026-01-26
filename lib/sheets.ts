import { google } from 'googleapis';

const SPREADSHEET_MAP: Record<string, string> = {
  users: process.env.SPREADSHEET_USERS || '',
  registration_request: process.env.SPREADSHEET_REGISTRATION || '',
  order_report: process.env.SPREADSHEET_ORDER_REPORT || '',
  powerbiz_salesorder: process.env.SPREADSHEET_ORDER_REPORT || '',
  delivery_note: process.env.SPREADSHEET_ORDER_REPORT || '',
  sales_invoice: process.env.SPREADSHEET_ORDER_REPORT || '',
  petty_cash: process.env.SPREADSHEET_PETTY_CASH || '',
  master_dropdown: process.env.SPREADSHEET_MASTER || '',
  master_item: process.env.SPREADSHEET_STOCK || '',
  erp_stock_balance: process.env.SPREADSHEET_STOCK || '',
  javelin: process.env.SPREADSHEET_STOCK || '',
  result_stock: process.env.SPREADSHEET_STOCK || '',
  pca_stock: process.env.SPREADSHEET_STOCK || '',
  last_update: process.env.SPREADSHEET_STOCK || '',
  'Torch Cirebon': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Jogja': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Karawaci': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Karawang': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Lampung': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Lembong': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Makassar': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Malang': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Margonda': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Medan': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Pekalongan': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Purwokerto': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Surabaya': process.env.SPREADSHEET_CUSTOMER || '',
  'Torch Tambun': process.env.SPREADSHEET_CUSTOMER || '',
  voucher_list: process.env.SPREADSHEET_VOUCHER || '',
  master_bundling: process.env.SPREADSHEET_BUNDLING || '',
};

function getSpreadsheetId(sheetName: string): string {
  return SPREADSHEET_MAP[sheetName] || '';
}

export async function getSheetData(sheetName: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: `${sheetName}!A1:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

export async function updateSheetDataWithHeader(sheetName: string, data: any[][]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: `${sheetName}!A1:Z`,
    });

    if (data.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(sheetName),
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: data,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating sheet data:', error);
    throw error;
  }
}

export async function appendSheetData(sheetName: string, data: any[][]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: data,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error appending sheet data:', error);
    throw error;
  }
}

export async function updateSheetRow(sheetName: string, rowIndex: number, data: any[]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
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