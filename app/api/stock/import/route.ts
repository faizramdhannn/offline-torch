import { NextRequest, NextResponse } from 'next/server';
import { updateSheetDataWithHeader, getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const VALID_SHEETS = ['erp_stock_balance', 'javelin', 'powerbi_threshold'];

async function updateLastUpdate(sheetType: string, dateStr: string) {
  const maxRetries = 3;

  const labelMap: Record<string, string> = {
    erp_stock_balance: 'ERP',
    javelin: 'Javelin',
    powerbi_threshold: 'Threshold',
  };

  const currentLabel = labelMap[sheetType] ?? sheetType;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const existingData = await getSheetData('last_update');

      const rowIndex = existingData.findIndex((row: any) => {
        const typeVal =
          row.type ?? row.Type ?? row.TYPE ??
          String(Object.values(row)[0] ?? '');
        return String(typeVal).trim().toLowerCase() === currentLabel.toLowerCase();
      });

      if (rowIndex !== -1) {
        await updateSheetRow('last_update', rowIndex + 2, [currentLabel, dateStr]);
        console.log(`✅ last_update updated: ${currentLabel} at row ${rowIndex + 2}`);
      } else {
        await appendSheetData('last_update', [[currentLabel, dateStr]]);
        console.log(`✅ last_update appended: ${currentLabel} (row not found, new entry)`);
      }

      return; // sukses, keluar dari loop
    } catch (err) {
      console.error(`❌ last_update attempt ${attempt}/${maxRetries} failed for "${currentLabel}":`, err);
      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // 1s, 2s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error(`❌ All ${maxRetries} attempts failed for "${currentLabel}". Skipping.`);
      }
    }
  }
}

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