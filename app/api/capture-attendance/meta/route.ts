import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { getActiveStoreNameSet, normalizeStoreName } from '@/lib/storeAddress';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'store_list') {
      const stores = await getSheetData('store_list');
      // Toko berstatus Draft/Archived di store_address (dicocokkan lewat
      // nama toko) tidak boleh muncul untuk capture attendance.
      try {
        const activeNames = await getActiveStoreNameSet();
        const filtered = (stores || []).filter((s: any) =>
          activeNames.has(normalizeStoreName(s.store_name))
        );
        return NextResponse.json(filtered);
      } catch (err) {
        console.error('Failed to filter store_list by store_address status, showing unfiltered:', err);
        return NextResponse.json(stores || []);
      }
    }

    if (type === 'taft_list') {
      const storeName = searchParams.get('store_name');
      const tafts = await getSheetData('taft_list');
      const filtered = storeName
        ? (tafts || []).filter(
            (t: any) => t.store_name?.toLowerCase() === storeName.toLowerCase()
          )
        : (tafts || []);
      return NextResponse.json(filtered);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Attendance meta error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}