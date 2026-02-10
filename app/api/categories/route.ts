import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const withDetails = searchParams.get('withDetails') === 'true';
    
    const data = await getSheetData('master_dropdown');
    
    if (withDetails) {
      // Return full details for information popup
      const categoryDetails = data
        .filter((row: any) => row.category_petty_cash && row.category_petty_cash.trim() !== '')
        .map((row: any) => ({
          category: row.category_petty_cash || '',
          description: row.description_petty_cash || '',
          example: row.example || ''
        }));
      
      return NextResponse.json(categoryDetails);
    } else {
      // Extract category_petty_cash column only
      const categories = data
        .map((row: any) => row.category_petty_cash)
        .filter((cat: string) => cat && cat.trim() !== '');
      
      return NextResponse.json(categories);
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}