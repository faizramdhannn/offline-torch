// app/api/attendance/meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

/**
 * Normalise store list rows: the sheet header might be "store_wadges" (typo)
 * or "store_wages" — map both to "store_wages" so the frontend always gets
 * a consistent field name.
 */
function normalizeStoreList(rows: any[]): any[] {
  return rows.map((r) => {
    if ('store_wadges' in r && !('store_wages' in r)) {
      const { store_wadges, ...rest } = r;
      return { ...rest, store_wages: store_wadges };
    }
    return r;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    if (type === 'date_list') {
      const data = await getSheetData('date_list');
      return NextResponse.json(data);
    }

    if (type === 'taft_list') {
      const data = await getSheetData('taft_list');
      const store = searchParams.get('store');
      if (store) {
        return NextResponse.json(
          data.filter((r: any) => r.store_name?.toLowerCase() === store.toLowerCase())
        );
      }
      return NextResponse.json(data);
    }

    if (type === 'time_schedule') {
      const data = await getSheetData('time_schedule');
      return NextResponse.json(data);
    }

    if (type === 'store_list') {
      const data = await getSheetData('store_list');
      return NextResponse.json(normalizeStoreList(data));
    }

    // type === 'all'
    const [dateList, taftList, timeSchedule, storeList] = await Promise.all([
      getSheetData('date_list'),
      getSheetData('taft_list'),
      getSheetData('time_schedule'),
      getSheetData('store_list'),
    ]);

    return NextResponse.json({
      dateList,
      taftList,
      timeSchedule,
      storeList: normalizeStoreList(storeList),
    });
  } catch (error) {
    console.error('Error fetching attendance meta:', error);
    return NextResponse.json({ error: 'Failed to fetch meta' }, { status: 500 });
  }
}