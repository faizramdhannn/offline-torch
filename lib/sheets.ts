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
  asset_store: process.env.SPREADSHEET_STORE || "",
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

// ✅ Batasi range kolom per sheet — hindari fetch sampai kolom CZ (104 kolom)
// untuk sheet yang hanya punya sedikit kolom. Ini mempercepat response time
// secara signifikan, terutama untuk sheet besar seperti result_stock.
// Sesuaikan nilai ini jika kolom aktual bertambah.
const SHEET_RANGE: Record<string, string> = {
  result_stock: "A1:AJ",       // ~36 kolom — sheet stok besar, batasi
  pca_stock: "A1:Z",           // ~26 kolom
  erp_stock_balance: "A1:Z",
  master_item: "A1:Z",
  javelin: "A1:Z",
  last_update: "A1:D",         // biasanya cuma timestamp + beberapa kolom
  powerbi_threshold: "A1:J",
  invoices: "A1:AJ",
  invoice_items: "A1:AJ",
  master_invoice: "A1:AJ",
  system_config: "A1:D",       // key-value config, kolom sedikit
  attendance_store: "A1:AJ",
  attendance_store_all: "A1:AJ",
  material_issue: "A1:AJ",
  material_issue_all: "A1:AJ",
  schedule_report: "A1:AJ",
  daily_sales: "A1:AJ",
  target_sales: "A1:AJ",
};

// ✅ Timeout per sheet — sheet besar / lambat dapat alokasi lebih lama
const SHEET_TIMEOUT: Record<string, number> = {
  result_stock: 30000,   // sheet terbesar, butuh waktu paling lama
  pca_stock: 25000,
  erp_stock_balance: 25000,
  master_item: 25000,
  invoices: 25000,
  invoice_items: 25000,
  master_invoice: 25000,
  system_config: 20000,
  attendance_store_all: 25000,
  material_issue_all: 25000,
};
const DEFAULT_TIMEOUT = 15000;

function getSheetTimeout(sheetName: string): number {
  return SHEET_TIMEOUT[sheetName] ?? DEFAULT_TIMEOUT;
}

function getSheetRange(sheetName: string): string {
  return SHEET_RANGE[sheetName] ?? "A1:CZ";
}

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

// ✅ Cache in-memory untuk hasil read (getSheetData).
// Semua fitur (stock, attendance, dashboard, dll) berbagi SATU service account
// Google yang sama, jadi kuota "read requests per minute per user" gampang
// habis kalau setiap page load/navigasi langsung nembak Sheets API tanpa cache.
// Cache ini per-instance (hilang saat cold start baru), tapi cukup efektif
// menahan request berulang dalam jangka pendek — termasuk saat beberapa
// user/tab membuka sheet yang sama hampir bersamaan.
const CACHE_TTL_MS = 120_000; // 2 menit

// ✅ Sheet-sheet heavy di SPREADSHEET_STOCK dapat TTL lebih panjang
// karena data stok tidak berubah detik-ke-detik, dan spreadsheet ini
// paling sering kena rate limit akibat banyaknya sheet yang berbagi.
const CACHE_TTL_OVERRIDES: Record<string, number> = {
  result_stock: 300_000,     // 5 menit
  pca_stock: 300_000,
  erp_stock_balance: 300_000,
  master_item: 300_000,
  javelin: 300_000,
  powerbi_threshold: 300_000,
  last_update: 60_000,       // 1 menit — ini sering di-poll, tapi tetap cache
};

function getCacheTTL(sheetName: string): number {
  return CACHE_TTL_OVERRIDES[sheetName] ?? CACHE_TTL_MS;
}

const _sheetCache = new Map<string, { data: any; expiresAt: number }>();

// ✅ In-flight de-duplication ("single-flight"): kalau ada beberapa request
// masuk hampir bersamaan untuk SHEET YANG SAMA sebelum cache terisi (misal 2
// tab dibuka bareng, atau beberapa user buka halaman yang sama persis dalam
// hitungan detik), jangan masing-masing bikin call baru ke Sheets API.
// Request kedua dst cukup "numpang" ke Promise yang sama dari request
// pertama yang masih berjalan.
const _inFlight = new Map<string, Promise<any>>();

function getCachedSheetData(sheetName: string): any | null {
  const entry = _sheetCache.get(sheetName);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    _sheetCache.delete(sheetName);
    return null;
  }
  return entry.data;
}

function setCachedSheetData(sheetName: string, data: any) {
  _sheetCache.set(sheetName, {
    data,
    expiresAt: Date.now() + getCacheTTL(sheetName),
  });
}

// Dipanggil setiap kali ada write (update/append/delete) supaya read
// berikutnya tidak menyajikan data basi dari cache.
function invalidateSheetCache(sheetName: string) {
  _sheetCache.delete(sheetName);
}

export async function getSheetData(
  sheetName: string,
  opts?: { skipCache?: boolean }
) {
  if (!opts?.skipCache) {
    const cached = getCachedSheetData(sheetName);
    if (cached !== null) return cached;

    const pending = _inFlight.get(sheetName);
    if (pending) return pending;
  }

  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }

  const timeout = getSheetTimeout(sheetName);
  const range = getSheetRange(sheetName);

  const fetchPromise = withRetry(
    async () => {
      const sheets = getSheetsClient();
      const response = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!${range}`,
        }),
        timeout,
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
    3,
    `getSheetData(${sheetName})`
  )
    .then((result) => {
      setCachedSheetData(sheetName, result);
      _inFlight.delete(sheetName);
      return result;
    })
    .catch((err) => {
      _inFlight.delete(sheetName);
      throw err;
    });

  if (!opts?.skipCache) {
    _inFlight.set(sheetName, fetchPromise);
  }

  return fetchPromise;
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
      invalidateSheetCache(sheetName);
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
      invalidateSheetCache(sheetName);
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
      invalidateSheetCache(sheetName);
      return { success: true };
    },
    3,
    `updateSheetRow(${sheetName})`
  );
}

// ✅ Update banyak baris dalam SATU request batchUpdate, bukan banyak request
// values.update paralel. Dipakai ketika satu "group" (id sama) berisi banyak
// baris (misal puluhan item dalam satu material issue).
export async function updateMultipleSheetRows(
  sheetName: string,
  updates: { rowIndex: number; data: any[] }[]
) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  if (updates.length === 0) return { success: true, updated: 0 };

  return withRetry(
    async () => {
      const sheets = getSheetsClient();
      const data = updates.map(({ rowIndex, data: rowData }) => {
        const endColumn = getColumnLetter(rowData.length);
        return {
          range: `${sheetName}!A${rowIndex}:${endColumn}${rowIndex}`,
          values: [rowData],
        };
      });
      console.log(`Batch updating ${data.length} row(s) on sheet ${sheetName}`);
      await withTimeout(
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: "RAW", data },
        }),
        20000,
        `updateMultipleSheetRows(${sheetName}, rows=${updates.length})`
      );
      invalidateSheetCache(sheetName);
      return { success: true, updated: updates.length };
    },
    3,
    `updateMultipleSheetRows(${sheetName})`
  );
}

// ✅ Menghapus baris secara nyata (shift-up), bukan sekadar mengosongkan nilainya.
export async function deleteSheetRows(sheetName: string, rowIndexes: number[]) {
  const spreadsheetId = getSpreadsheetId(sheetName);
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for sheet: ${sheetName}`);
  }
  if (rowIndexes.length === 0) return { success: true, deleted: 0 };

  return withRetry(
    async () => {
      const sheets = getSheetsClient();

      const meta = await withTimeout(
        sheets.spreadsheets.get({ spreadsheetId }),
        15000,
        `getSheetId(${sheetName})`
      ) as { data: { sheets?: any[] } };
      const sheetMeta = (meta.data.sheets || []).find(
        (s: any) => s.properties?.title === sheetName
      );
      if (!sheetMeta) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }
      const sheetId = sheetMeta.properties.sheetId;

      const sortedDesc = [...rowIndexes].sort((a, b) => b - a);
      const requests = sortedDesc.map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }));

      await withTimeout(
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        }),
        20000,
        `deleteSheetRows(${sheetName}, rows=${rowIndexes.length})`
      );

      invalidateSheetCache(sheetName);
      return { success: true, deleted: rowIndexes.length };
    },
    3,
    `deleteSheetRows(${sheetName})`
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

      invalidateSheetCache(sheetName);
      return { success: true };
    },
    3,
    `updateSheetRowSkipColumns(${sheetName})`
  );
}