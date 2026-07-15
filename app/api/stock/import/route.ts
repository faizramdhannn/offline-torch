import { NextRequest, NextResponse, after } from 'next/server';
import { updateSheetDataWithHeader, updateSheetRow, getSheetData, appendSheetData, getRawSheetValues } from '@/lib/sheets';

const VALID_SHEETS = ['erp_stock_balance', 'javelin', 'powerbi_threshold'];

const LABEL_MAP: Record<string, string> = {
  erp_stock_balance: 'ERP',
  javelin: 'Javelin',
  powerbi_threshold: 'Threshold',
};

// ✅ Row index di sheet last_update (1-based, header = baris 1).
// Sesuaikan jika urutan baris di sheet berubah.
// Dengan hardcode ini, kita skip getSheetData('last_update') sama sekali —
// yang jadi penyebab timeout karena dipanggil tepat setelah write ribuan baris
// ke SPREADSHEET_STOCK yang sama, sehingga Google Sheets API throttle.
const LAST_UPDATE_ROW: Record<string, number> = {
  erp_stock_balance: 2,  // baris 2 = ERP
  javelin: 3,            // baris 3 = Javelin
  powerbi_threshold: 4,  // baris 4 = Threshold
};

function getJakartaDateStr(): string {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const day = jakartaTime.getDate().toString().padStart(2, '0');
  const month = months[jakartaTime.getMonth()];
  const year = jakartaTime.getFullYear();
  const hours = jakartaTime.getHours().toString().padStart(2, '0');
  const minutes = jakartaTime.getMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function getJakartaDateOnlyStr(): string {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return jakartaTime.toISOString().slice(0, 10); // "YYYY-MM-DD", cukup untuk dedupe harian
}

const SNAPSHOT_DATE_KEY = 'stock_yesterday_snapshot_date';

// result_stock/pca_stock adalah sheet RUMUS yang recalculate otomatis begitu
// erp_stock_balance/javelin/powerbi_threshold berubah — begitu import jalan,
// nilai lamanya langsung hilang tanpa jejak. Supaya "data lama" tetap bisa
// dilihat sebagai result_stock_yesterday/pca_stock_yesterday, snapshot nilai
// yang ADA SEKARANG (sebelum overwrite apa pun) ke sheet *_yesterday — tapi
// HANYA SEKALI PER HARI (ditandai via system_config), supaya kalau user
// import 3 file berurutan (erp → javelin → threshold) dalam satu sesi,
// snapshot ke-2/ke-3 tidak menimpa snapshot pertama dengan data yang sudah
// setengah diperbarui.
//
// PENTING soal performa: hanya bagian BACA (getRawSheetValues) yang harus
// selesai SEBELUM overwrite sumber data (karena setelah itu result_stock/
// pca_stock sudah berubah, snapshot jadi telat). Bagian TULIS ke sheet
// *_yesterday tidak perlu ditunggu user — makanya di-defer lewat after()
// di POST handler, supaya tidak menambah waktu loading import yang terlihat.
// Return null kalau tidak perlu snapshot (sudah dilakukan hari ini).
async function prepareStockSnapshot(): Promise<{ resultRaw: any[][]; pcaRaw: any[][]; today: string } | null> {
  const today = getJakartaDateOnlyStr();
  const configRows = await getSheetData('system_config');
  const existing = configRows.find((r: any) => r.config_key === SNAPSHOT_DATE_KEY);
  if (existing?.config_value === today) {
    return null; // sudah di-snapshot hari ini, skip
  }

  const [resultRaw, pcaRaw] = await Promise.all([
    getRawSheetValues('result_stock'),
    getRawSheetValues('pca_stock'),
  ]);
  return { resultRaw, pcaRaw, today };
}

// Bagian tulis — dipanggil dari dalam after(), TIDAK di-await oleh response.
async function writeStockSnapshot(resultRaw: any[][], pcaRaw: any[][], today: string) {
  try {
    await Promise.all([
      updateSheetDataWithHeader('result_stock_yesterday', resultRaw),
      updateSheetDataWithHeader('pca_stock_yesterday', pcaRaw),
    ]);

    const configRows = await getSheetData('system_config', { skipCache: true });
    const idx = configRows.findIndex((r: any) => r.config_key === SNAPSHOT_DATE_KEY);
    if (idx === -1) {
      await appendSheetData('system_config', [[SNAPSHOT_DATE_KEY, today, '', '']]);
    } else {
      await updateSheetRow('system_config', idx + 2, [SNAPSHOT_DATE_KEY, today, '', '']);
    }

    console.log(`[import] Snapshot result_stock/pca_stock → *_yesterday done for ${today}`);
  } catch (err) {
    // Snapshot gagal TIDAK boleh menggagalkan import utama — data
    // erp_stock_balance/javelin/threshold sudah lebih dulu berhasil ditulis.
    console.error('[import] Failed to write stock yesterday snapshot:', err);
  }
}

async function updateLastUpdate(sheetType: string, dateStr: string) {
  const label = LABEL_MAP[sheetType] ?? sheetType;
  const rowIndex = LAST_UPDATE_ROW[sheetType];

  if (!rowIndex) {
    console.warn(`⚠️ No row index configured for last_update: ${label}. Skipping.`);
    return;
  }

  // ✅ Langsung update row — tanpa read getSheetData dulu.
  // Ini menghilangkan 1 round-trip ke Google Sheets API yang selalu timeout
  // karena dipanggil saat API sedang throttle akibat write besar sebelumnya.
  try {
    await updateSheetRow('last_update', rowIndex, [label, dateStr]);
    console.log(`✅ last_update updated: ${label} at row ${rowIndex}`);
  } catch (err) {
    // ✅ Gagal update last_update tidak boleh gagalkan seluruh import.
    // Data utama (erp_stock_balance / javelin / powerbi_threshold) sudah
    // berhasil ditulis — hanya timestamp-nya yang belum update.
    // Cron refresh-stock akan membaca ulang last_update dalam 5 menit.
    console.error(`❌ Failed to update last_update for "${label}":`, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sheetName, data } = await request.json();

    if (!VALID_SHEETS.includes(sheetName)) {
      return NextResponse.json(
        { error: 'Invalid sheet name' },
        { status: 400 }
      );
    }

    const cleanedData = data.filter((row: any[]) => {
      return row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    if (cleanedData.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to import' },
        { status: 400 }
      );
    }

    console.log(`[import] Starting: ${sheetName}, rows: ${cleanedData.length}`);

    // Baca snapshot result_stock/pca_stock SEBELUM sumbernya di-overwrite
    // (harus ditunggu — kalau tidak, datanya sudah keburu berubah). Bagian
    // tulis ke *_yesterday di-defer lewat after() di bawah, tidak menambah
    // waktu tunggu user.
    const snapshot = await prepareStockSnapshot().catch((err) => {
      console.error('[import] Failed to read stock snapshot (skipped):', err);
      return null;
    });

    await updateSheetDataWithHeader(sheetName, cleanedData);

    console.log(`[import] Sheet updated: ${sheetName}`);

    const dateStr = getJakartaDateStr();
    await updateLastUpdate(sheetName, dateStr);

    console.log(`[import] Done: ${sheetName}`);

    if (snapshot) {
      after(() => writeStockSnapshot(snapshot.resultRaw, snapshot.pcaRaw, snapshot.today));
    }

    return NextResponse.json({
      success: true,
      rowsImported: cleanedData.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}