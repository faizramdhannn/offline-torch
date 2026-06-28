import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'result_stock';
    
    const data = await getSheetData(type);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Stock fetch error:', error);
    const message = error instanceof Error ? error.message : String(error);
    // Kalau ini timeout/quota dari Google Sheets, kasih pesan yang lebih jelas
    // ke user daripada generic "Failed to fetch stock data".
    const isQuotaOrTimeout = /timeout|quota/i.test(message);
    return NextResponse.json(
      {
        error: isQuotaOrTimeout
          ? 'Server sedang sibuk (limit Google Sheets API tercapai). Coba lagi dalam beberapa saat.'
          : 'Failed to fetch stock data',
        details: message,
      },
      { status: 500 }
    );
  }
}