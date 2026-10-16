import { google } from '@/lib/google';

// Pembaca spreadsheet Survey Store (SPREADSHEET_TRAFFIC) — dipakai /api/traffic-store dan daftar PIC di Invoice.
export const SPREADSHEET_TRAFFIC = process.env.SPREADSHEET_TRAFFIC || '';

export function getGoogleCredentials() {
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

export async function getTrafficSheetData(sheetName: string) {
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
  // Keep the TRUE 1-based sheet row number on each object (as __rowIndex),
  // computed BEFORE filtering out blank rows — callers that edit/delete by
  // id must use this instead of recomputing from the filtered array's
  // position, otherwise any leftover blank row above the target silently
  // shifts every index below it and edits/deletes land on the wrong row.
  return rows
    .map((row, i) => ({ row, sheetRowNumber: i + 1 }))
    .slice(1)
    .filter(({ row }) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
    .map(({ row, sheetRowNumber }) => {
      const obj: any = { __rowIndex: sheetRowNumber };
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
}

