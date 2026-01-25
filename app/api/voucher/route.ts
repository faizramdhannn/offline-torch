import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('voucher_list');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching voucher data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voucher data' },
      { status: 500 }
    );
  }
}