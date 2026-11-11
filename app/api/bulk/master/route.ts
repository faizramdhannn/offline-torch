import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { jsonWithEtag } from '@/lib/etag';
import { masterFromRows } from '@/lib/bulkOrder';

export const dynamic = 'force-dynamic';

// Master Bulk (tab "master_bulk" di SPREADSHEET_BULK): daftar SKU (nama, kategori, HPJ) + pilihan Reason Buy / Reason Not Buy.
// Cache sheet 5 menit di server; ETag untuk balasan (hemat transfer).
export async function GET(request: Request) {
  try {
    const rows = (await getSheetData('master_bulk')) as any[];
    return jsonWithEtag(request, masterFromRows(rows));
  } catch (error) {
    console.error('Bulk master error:', error);
    return NextResponse.json({ error: 'Gagal memuat master Bulk' }, { status: 500 });
  }
}
