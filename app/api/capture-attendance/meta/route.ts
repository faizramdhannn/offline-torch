import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'store_list') {
      const stores = await getSheetData('store_list');
      return NextResponse.json(stores || []);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Attendance meta error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}