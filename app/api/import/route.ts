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

    await updateSheetData(sheetName, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
