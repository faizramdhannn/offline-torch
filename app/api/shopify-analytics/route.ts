import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetDataWithHeader, appendSheetData } from '@/lib/sheets';

const REQUIRED_COLUMNS = [
  'Name', 'Created at', 'Paid at', 'Financial Status', 'Subtotal',
  'Notes', 'Discount Code', 'Discount Amount', 'Lineitem name',
  'Lineitem quantity', 'Lineitem price', 'Lineitem sku', 'Employee', 'Location',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const data = await getSheetData('shopify_import') as Record<string, any>[];

    const filtered = data.filter((row) => {
      const date = (row['Created at'] || '').split(' ')[0];
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching shopify analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch shopify analytics data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, mode = 'append' } = await request.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No valid data to import' }, { status: 400 });
    }

    const cleanedData = data.filter((row: any[]) =>
      Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    if (cleanedData.length === 0) {
      return NextResponse.json({ error: 'No valid data after cleaning' }, { status: 400 });
    }

    const originalHeaders = cleanedData[0] as string[];
    const originalRows = cleanedData.slice(1);

    // Index kolom yang dipakai dari CSV asli
    const colIndexes = REQUIRED_COLUMNS.map(col => originalHeaders.indexOf(col));

    // Strip ke 14 kolom saja
    const filteredRows = originalRows.map((row: any[]) =>
      colIndexes.map(i => (i === -1 ? '' : row[i] ?? ''))
    );

    const nameIdx = REQUIRED_COLUMNS.indexOf('Name');
    const lineitemIdx = REQUIRED_COLUMNS.indexOf('Lineitem name');

    if (mode === 'refresh') {
      await updateSheetDataWithHeader('shopify_import', [REQUIRED_COLUMNS, ...filteredRows]);
      return NextResponse.json({
        success: true,
        rowsImported: filteredRows.length,
        message: `Data direset. ${filteredRows.length} baris diimport.`,
      });
    }

    // Append mode
    let existingData: any[] = [];
    try { existingData = await getSheetData('shopify_import'); } catch { existingData = []; }

    const existingKeys = new Set(
      existingData.map((row: any) => `${row['Name']}__${row['Lineitem name']}`)
    );

    const dedupedNewRows = filteredRows.filter((row: any[]) => {
      const key = `${row[nameIdx]}__${row[lineitemIdx]}`;
      return !existingKeys.has(key);
    });

    if (dedupedNewRows.length === 0) {
      return NextResponse.json({
        success: true,
        rowsImported: 0,
        message: 'Semua data sudah ada, tidak ada yang ditambahkan.',
      });
    }

    if (existingData.length === 0) {
      await updateSheetDataWithHeader('shopify_import', [REQUIRED_COLUMNS, ...dedupedNewRows]);
    } else {
      await appendSheetData('shopify_import', dedupedNewRows);
    }

    return NextResponse.json({
      success: true,
      rowsImported: dedupedNewRows.length,
      message: `${dedupedNewRows.length} baris baru ditambahkan.`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}