import { NextRequest, NextResponse } from 'next/server';
import { updateSheetData } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const { sheetName, data } = await request.json();

    if (!['powerbiz_salesorder', 'delivery_note', 'sales_invoice'].includes(sheetName)) {
      return NextResponse.json(
        { error: 'Invalid sheet name' },
        { status: 400 }
      );
    }

    // Filter out empty rows
    const cleanedData = data.filter((row: any[]) => {
      return row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    if (cleanedData.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to import' },
        { status: 400 }
      );
    }

    await updateSheetData(sheetName, cleanedData);

    return NextResponse.json({ 
      success: true, 
      rowsImported: cleanedData.length 
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}