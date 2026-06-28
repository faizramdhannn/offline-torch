import { NextRequest, NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

// ✅ Sheet-sheet yang di-refresh oleh cron ini adalah yang paling sering
// kena timeout — semuanya berbagi SPREADSHEET_STOCK yang sama.
// Urutan fetch dibuat sequential (bukan paralel) supaya tidak memborbardir
// Google Sheets API sekaligus dan malah kena rate limit.
const SHEETS_TO_REFRESH = [
  "result_stock",
  "last_update",
  "pca_stock",
  "erp_stock_balance",
  "master_item",
  "powerbi_threshold",
] as const;

export async function GET(request: NextRequest) {
  // ✅ Proteksi sederhana: cron Vercel mengirim header Authorization
  // dengan nilai Bearer + CRON_SECRET. Tanpa ini, endpoint bisa dipanggil
  // siapa saja dan menghabiskan kuota Google Sheets API.
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { ok: boolean; rows?: number; error?: string }> = {};

  for (const sheetName of SHEETS_TO_REFRESH) {
    try {
      // skipCache: true → paksa ambil data baru dari Google Sheets,
      // setelah selesai cache otomatis diisi ulang oleh getSheetData.
      const data = await getSheetData(sheetName, { skipCache: true });
      results[sheetName] = { ok: true, rows: Array.isArray(data) ? data.length : 0 };
      console.log(`[cron/refresh-stock] ${sheetName}: ${results[sheetName].rows} rows refreshed`);
    } catch (err: any) {
      results[sheetName] = { ok: false, error: err?.message ?? String(err) };
      console.error(`[cron/refresh-stock] ${sheetName} failed:`, err?.message);
      // Lanjutkan ke sheet berikutnya meski satu gagal
    }
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    {
      refreshedAt: new Date().toISOString(),
      results,
    },
    { status: allOk ? 200 : 207 } // 207 Multi-Status jika ada yang gagal
  );
}