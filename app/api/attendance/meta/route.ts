import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

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
        return NextResponse.json(data.filter((r: any) => r.store_name?.toLowerCase() === store.toLowerCase()));
      }
      return NextResponse.json(data);
    }

    if (type === 'time_schedule') {
      const data = await getSheetData('time_schedule');
      return NextResponse.json(data);
    }

    if (type === 'store_list') {
      const data = await getSheetData('store_list');
      return NextResponse.json(data);
    }

    // all
    const [dateList, taftList, timeSchedule, storeList] = await Promise.all([
      getSheetData('date_list'),
      getSheetData('taft_list'),
      getSheetData('time_schedule'),
      getSheetData('store_list'),
    ]);

    return NextResponse.json({ dateList, taftList, timeSchedule, storeList });
  } catch (error) {
    console.error('Error fetching attendance meta:', error);
    return NextResponse.json({ error: 'Failed to fetch meta' }, { status: 500 });
  }
}