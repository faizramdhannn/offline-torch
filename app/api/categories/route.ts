import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('master_dropdown');
    
    // Extract category_petty_cash column
    const categories = data
      .map((row: any) => row.category_petty_cash)
      .filter((cat: string) => cat && cat.trim() !== '');
    
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
