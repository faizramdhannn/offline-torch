import { NextRequest, NextResponse } from 'next/server';
import { updateSheetDataWithHeader, updateSheetRow } from '@/lib/sheets';

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

    await updateSheetDataWithHeader(sheetName, cleanedData);

    console.log(`[import] Sheet updated: ${sheetName}`);

    const dateStr = getJakartaDateStr();
    await updateLastUpdate(sheetName, dateStr);

    console.log(`[import] Done: ${sheetName}`);

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