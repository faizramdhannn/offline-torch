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
    const { data } = await request.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No valid data to import' }, { status: 400 });
    }

    const cleanedData = data.filter((row: any[]) => {
      return Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    if (cleanedData.length === 0) {
      return NextResponse.json({ error: 'No valid data after cleaning' }, { status: 400 });
    }

    // Get existing data to append (keep old + add new, deduplicate by Name+Lineitem)
    let existingData: any[] = [];
    try {
      existingData = await getSheetData('shopify_import');
    } catch {
      existingData = [];
    }

    const headers = cleanedData[0] as string[];
    const newRows = cleanedData.slice(1);

    // Build set of existing keys (Name + Lineitem name) for deduplication
    const nameIdx = headers.indexOf('Name');
    const lineitemIdx = headers.indexOf('Lineitem name');

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
        message: 'All rows already exist (no duplicates imported)'
      });
    }

    // If sheet is empty, write with header; otherwise append rows only
    if (existingData.length === 0) {
      await updateSheetDataWithHeader('shopify_import', [headers, ...dedupedNewRows]);
    } else {
      await appendSheetData('shopify_import', dedupedNewRows);
    }

    return NextResponse.json({ 
      success: true, 
      rowsImported: dedupedNewRows.length,
      message: `${dedupedNewRows.length} new rows imported`
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}