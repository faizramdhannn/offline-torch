import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

// Read-only endpoint untuk 3 sheet master di spreadsheet Affiliate:
// - master_affiliate: diisi otomatis lewat Google Form eksternal (tab "List Affiliate")
// - master_data: diisi otomatis (tab "Master")
// - affiliate_store_list: sumber dropdown store_name di form Order Affiliate
// Tidak ada POST/PUT/DELETE — ketiga sheet ini tidak pernah ditulis dari app ini.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'affiliate';

    const sheetName =
      type === 'data' ? 'master_data' :
      type === 'stores' ? 'affiliate_store_list' :
      'master_affiliate';

    const data = await getSheetData(sheetName);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching affiliate master data:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliate master data' }, { status: 500 });
  }
}
