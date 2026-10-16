import { NextResponse } from 'next/server';
import { withCache } from '@/lib/sheets';
import { getTrafficSheetData } from '@/lib/trafficSheet';

export const dynamic = 'force-dynamic';

// Daftar Nama PIC per toko untuk dropdown tanda tangan Invoice — sumbernya master Survey Store (master_traffic:
// store_location + taft_name). Cache sama dengan halaman Survey Store (5 menit), jadi tidak menambah panggilan Sheets.
// Bentuk: { pics: { lembong: ["Nama A", "Nama B"], cirebon: [...] } } (kunci = store_location huruf kecil)
export async function GET() {
  try {
    const rows = await withCache('traffic_store_master_traffic', 300_000, () => getTrafficSheetData('master_traffic'));
    const pics: Record<string, string[]> = {};
    for (const r of rows as any[]) {
      const store = String(r.store_location || '').trim().toLowerCase();
      const name = String(r.taft_name || '').trim();
      if (!store || !name) continue;
      (pics[store] ||= []);
      if (!pics[store].includes(name)) pics[store].push(name);
    }
    for (const k of Object.keys(pics)) pics[k].sort((a, b) => a.localeCompare(b, 'id'));
    return NextResponse.json({ pics }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('Error fetching PIC list:', error);
    return NextResponse.json({ pics: {} });
  }
}
