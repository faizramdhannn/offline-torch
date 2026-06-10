import { google } from "googleapis";

const SPREADSHEET_MAP: Record<string, string> = {
  users: process.env.SPREADSHEET_USERS || "",
  registration_request: process.env.SPREADSHEET_REGISTRATION || "",
  order_report: process.env.SPREADSHEET_ORDER_REPORT || "",
  powerbiz_salesorder: process.env.SPREADSHEET_ORDER_REPORT || "",
  delivery_note: process.env.SPREADSHEET_ORDER_REPORT || "",
  sales_invoice: process.env.SPREADSHEET_ORDER_REPORT || "",
  petty_cash: process.env.SPREADSHEET_PETTY_CASH || "",
  petty_cash_balance: process.env.SPREADSHEET_BALANCE || "",
  master_dropdown: process.env.SPREADSHEET_MASTER || "",
  master_item: process.env.SPREADSHEET_STOCK || "",
  erp_stock_balance: process.env.SPREADSHEET_STOCK || "",
  request_store: process.env.SPREADSHEET_STORE || "",
  javelin: process.env.SPREADSHEET_STOCK || "",
  result_stock: process.env.SPREADSHEET_STOCK || "",
  pca_stock: process.env.SPREADSHEET_STOCK || "",
  powerbi_threshold: process.env.SPREADSHEET_STOCK || "",
  last_update: process.env.SPREADSHEET_STOCK || "",
  // ✅ system_config pakai spreadsheet terpisah agar tidak kena beban SPREADSHEET_STOCK
  system_config: process.env.SPREADSHEET_SYSTEM || process.env.SPREADSHEET_STOCK || "",
  invoices: process.env.SPREADSHEET_STOCK || "",
  invoice_items: process.env.SPREADSHEET_STOCK || "",
  master_invoice: process.env.SPREADSHEET_STOCK || "",
  activity_log: process.env.SPREADSHEET_STORE || "",
  shopify_import: process.env.SPREADSHEET_ORDER || "",
  master_traffic: process.env.SPREADSHEET_ORDER || "",
  request_tracking: process.env.SPREADSHEET_STORE || "",
  sto_store: process.env.SPREADSHEET_STORE || "",
  sto_store_report: process.env.SPREADSHEET_STORE || "",
  schedule_taft: process.env.SPREADSHEET_ATTENDANCE || "",
  date_list: process.env.SPREADSHEET_ATTENDANCE || "",
  taft_list: process.env.SPREADSHEET_ATTENDANCE || "",
  store_list: process.env.SPREADSHEET_ATTENDANCE || "",
  time_schedule: process.env.SPREADSHEET_ATTENDANCE || "",
  schedule_report: process.env.SPREADSHEET_ATTENDANCE || "",
  sales_store: process.env.SPREADSHEET_ATTENDANCE || "",
  daily_sales: process.env.SPREADSHEET_SALES || "",
  target_sales: process.env.SPREADSHEET_SALES || "",
  channel_traffic: process.env.SPREADSHEET_SALES || "",
  attendance_store: process.env.SPREADSHEET_ATTENDANCE || "",
  attendance_store_all: process.env.SPREADSHEET_ATTENDANCE || "",
  material_issue: process.env.SPREADSHEET_MATERIAL_ISSUE || "",
  material_issue_all: process.env.SPREADSHEET_MATERIAL_ISSUE || "",
  "Torch Cirebon": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Jogja": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Karawaci": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Karawang": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Lampung": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Lembong": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Makassar": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Malang": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Margonda": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Medan": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Pekalongan": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Purwokerto": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Surabaya": process.env.SPREADSHEET_CUSTOMER || "",
  "Torch Tambun": process.env.SPREADSHEET_CUSTOMER || "",
  voucher_list: process.env.SPREADSHEET_VOUCHER || "",
  master_bundling: process.env.SPREADSHEET_BUNDLING || "",
  canvasing_store: process.env.SPREADSHEET_STORE || "",
  catalog_product: process.env.SPREADSHEET_CATALOG || "",
};

function getSpreadsheetId(sheetName: string): string {
  return SPREADSHEET_MAP[sheetName] || "";
}

function getColumnLetter(columnNumber: number): string {
  let letter = "";
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

// ✅ Cached sheets client — auth hanya dibuat sekali, tidak ulang setiap request
let _sheetsClient: any = null;

function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

// ✅ Timeout helper — mencegah hang sampai 300 detik
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
        ms
      )
    ),
  ]);
}

// ✅ Retry helper — coba ulang jika gagal karena timeout/network
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  label: string
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.message?.includes("Timeout") ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.status === 429 || // rate limit
        err?.status === 503;   // service unavailable
      if (!isRetryable || attempt === retries) break;
      const delay = attempt * 1500; // 1.5s, 3s, 4.5s
      console.warn(`[${label}] attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function getSheetData(sheetName: string) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  return withRetry(
    async () => {
      const sheets = getSheetsClient();
      const response = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:CZ`,
        }),
        // ✅ system_config kecil, timeout lebih pendek tapi tetap reasonable
        sheetName === "system_config" ? 20000 : 15000,
        `getSheetData(${sheetName})`
      ) as { data: { values?: any[][] } };
      const rows = response.data.values || [];
      if (rows.length === 0) return [];
      const headers = rows[0];
      return rows.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || null;
        });
        return obj;
      });
    },
    3, // ✅ coba maksimal 3x
    `getSheetData(${sheetName})`
  );
}

export async function updateSheetDataWithHeader(sheetName: string, data: any[][]) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  return withRetry(
    async () => {
      const sheets = getSheetsClient();
      await withTimeout(
        sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A1:CZ`,
        }),
        15000,
        `clear(${sheetName})`
      );
      if (data.length > 0) {
        await withTimeout(
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: data },
          }),
          30000,
          `update(${sheetName})`
        );
      }
      return { success: true };
    },
    3,
    `updateSheetDataWithHeader(${sheetName})`
  );
}

export async function appendSheetData(sheetName: string, data: any[][]) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  return withRetry(
    async () => {
      const sheets = getSheetsClient();
      await withTimeout(
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A2`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: data },
        }),
        15000,
        `appendSheetData(${sheetName})`
      );
      return { success: true };
    },
    3,
    `appendSheetData(${sheetName})`
  );
}

export async function updateSheetRow(
  sheetName: string,
  rowIndex: number,
  data: any[]
) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  return withRetry(
    async () => {
      const sheets = getSheetsClient();
      const numColumns = data.length;
      const endColumn = getColumnLetter(numColumns);
      const range = `${sheetName}!A${rowIndex}:${endColumn}${rowIndex}`;
      console.log(`Updating sheet row: ${range} with ${numColumns} columns`);
      await withTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values: [data] },
        }),
        15000,
        `updateSheetRow(${sheetName}, row=${rowIndex})`
      );
      return { success: true };
    },
    3,
    `updateSheetRow(${sheetName})`
  );
}

export async function updateSheetRowSkipColumns(
  sheetName: string,
  rowIndex: number,
  beforeData: any[],
  afterData: any[],
  skipCount: number
) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  return withRetry(
    async () => {
      const sheets = getSheetsClient();

      const beforeEndCol = getColumnLetter(beforeData.length);
      const range1 = `${sheetName}!A${rowIndex}:${beforeEndCol}${rowIndex}`;

      const afterStartColNum = beforeData.length + skipCount + 1;
      const afterEndColNum = afterStartColNum + afterData.length - 1;
      const afterStartCol = getColumnLetter(afterStartColNum);
      const afterEndCol = getColumnLetter(afterEndColNum);
      const range2 = `${sheetName}!${afterStartCol}${rowIndex}:${afterEndCol}${rowIndex}`;

      console.log(`Updating range1: ${range1}, range2: ${range2}`);

      await withTimeout(
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              { range: range1, values: [beforeData] },
              { range: range2, values: [afterData] },
            ],
          },
        }),
        15000,
        `updateSheetRowSkipColumns(${sheetName}, row=${rowIndex})`
      );

      return { success: true };
    },
    3,
    `updateSheetRowSkipColumns(${sheetName})`
  );
}