// app/api/attendance/meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { getActiveStoreNameSet, normalizeStoreName } from '@/lib/storeAddress';

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

// Baik `store_list` (daftar toko) MAUPUN `taft_list` (roster staff per toko)
// sama-sama punya kolom `store_name` tapi TIDAK punya status sendiri —
// statusnya ditentukan lewat store_address (kolom status: Active/Draft/
// Archived), dicocokkan lewat nama toko. Toko Draft/Archived harus difilter
// keluar dari KEDUANYA, karena `taft_list` yang menggerakkan widget "Jadwal
// Shift Hari Ini" di dashboard dan berbagai tampilan laporan attendance —
// kalau cuma store_list yang difilter, toko Draft tetap muncul lewat jalur
// taft_list ini.
async function filterActiveByStoreName(rows: any[]): Promise<any[]> {
  try {
    const activeNames = await getActiveStoreNameSet();
    return rows.filter((s: any) => activeNames.has(normalizeStoreName(s.store_name)));
  } catch (err) {
    console.error('Failed to filter by store_address status, showing unfiltered:', err);
    return rows; // gagal ambil status → jangan sampai daftar toko malah kosong semua
  }
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
      const activeOnly = await filterActiveByStoreName(data);
      const store = searchParams.get('store');
      if (store) {
        return NextResponse.json(
          activeOnly.filter((r: any) => r.store_name?.toLowerCase() === store.toLowerCase())
        );
      }
      return NextResponse.json(activeOnly);
    }

    if (type === 'time_schedule') {
      const data = await getSheetData('time_schedule');
      return NextResponse.json(data);
    }

    if (type === 'store_list') {
      const data = await getSheetData('store_list');
      return NextResponse.json(await filterActiveByStoreName(normalizeStoreList(data)));
    }

    // type === 'all'
    const [dateList, taftList, timeSchedule, storeList] = await Promise.all([
      getSheetData('date_list'),
      getSheetData('taft_list'),
      getSheetData('time_schedule'),
      getSheetData('store_list'),
    ]);

    const [filteredTaftList, filteredStoreList] = await Promise.all([
      filterActiveByStoreName(taftList),
      filterActiveByStoreName(normalizeStoreList(storeList)),
    ]);

    return NextResponse.json({
      dateList,
      taftList: filteredTaftList,
      timeSchedule,
      storeList: filteredStoreList,
    });
  } catch (error) {
    console.error('Error fetching attendance meta:', error);
    return NextResponse.json({ error: 'Failed to fetch meta' }, { status: 500 });
  }
}