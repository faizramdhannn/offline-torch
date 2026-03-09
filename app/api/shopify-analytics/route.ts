import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetDataWithHeader, appendSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('shopify_import');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching shopify analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch shopify analytics data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // mode: "refresh" = replace all, "append" = add new only (default)
    const { data, mode = 'append' } = await request.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No valid data to import' }, { status: 400 });
    }

    const cleanedData = data.filter((row: any[]) => {
      return Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    if (cleanedData.length === 0) {
      return NextResponse.json({ error: 'No valid data after cleaning' }, { status: 400 });
    }

    const headers = cleanedData[0] as string[];
    const newRows = cleanedData.slice(1);
    const nameIdx = headers.indexOf('Name');
    const lineitemIdx = headers.indexOf('Lineitem name');

    // ── REFRESH MODE: replace all data ──────────────────────────────────────
    if (mode === 'refresh') {
      await updateSheetDataWithHeader('shopify_import', [headers, ...newRows]);
      return NextResponse.json({
        success: true,
        rowsImported: newRows.length,
        message: `Data direset. ${newRows.length} baris diimport.`,
      });
    }

    // ── APPEND MODE: deduplicate by Name + Lineitem name, add only new ───────
    let existingData: any[] = [];
    try {
      existingData = await getSheetData('shopify_import');
    } catch {
      existingData = [];
    }

    // Dedup key: Name + Lineitem name
    const existingKeys = new Set(
      existingData.map((row: any) => `${row['Name']}__${row['Lineitem name']}`)
    );

    const dedupedNewRows = newRows.filter((row: any[]) => {
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
      await updateSheetDataWithHeader('shopify_import', [headers, ...dedupedNewRows]);
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