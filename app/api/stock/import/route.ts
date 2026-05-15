import { NextRequest, NextResponse } from 'next/server';
import { updateSheetDataWithHeader, getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const VALID_SHEETS = ['erp_stock_balance', 'javelin', 'powerbi_threshold'];

async function updateLastUpdate(sheetType: string, dateStr: string) {
  try {
    const existingData = await getSheetData('last_update');

    // Build label map: erp_stock_balance → ERP, javelin → Javelin, powerbi_threshold → Threshold
    const labelMap: Record<string, string> = {
      erp_stock_balance: 'ERP',
      javelin: 'Javelin',
      powerbi_threshold: 'Threshold',
    };

    const currentLabel = labelMap[sheetType] ?? sheetType;
    const allLabels = Object.values(labelMap);

    // Build updated rows
    const updatedData: any[][] = [['type', 'last_update']];

    allLabels.forEach((label) => {
      if (label === currentLabel) {
        updatedData.push([label, dateStr]);
      } else {
        const existing = existingData.find((row: any) => row.type === label);
        updatedData.push([label, existing?.last_update ?? '-']);
      }
    });

    await updateSheetDataWithHeader('last_update', updatedData);
  } catch (err) {
    console.warn('Skipping last_update timestamp, non-critical:', err);
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

    await updateSheetDataWithHeader(sheetName, cleanedData);

    // Update last_update — always runs, failure is non-fatal
    const dateStr = getJakartaDateStr();
    await updateLastUpdate(sheetName, dateStr);

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