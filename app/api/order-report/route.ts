import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { jsonWithEtag } from '@/lib/etag';

// order_date: "2026-08-17 4:48:32" atau "17-08-2026 ..." → "YYYY-MM-DD"
function isoDay(raw: string): string {
  const d = String(raw || '').trim().split(' ')[0];
  const p = d.split('-');
  if (p.length !== 3) return '';
  return p[0].length === 4 ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}` : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ?sales_order=X → hanya baris itu (halaman detail; tanpa mengunduh seluruh sheet).
// ?from=&to= → rentang tanggal; tanpa keduanya: 60 hari terakhir (sheet terus bertambah).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getSheetData('order_report');

    const so = searchParams.get('sales_order');
    if (so) return jsonWithEtag(request, data.filter((r: any) => r.sales_order === so));

    const toP = DAY.test(searchParams.get('to') || '') ? searchParams.get('to')! : '';
    let fromP = DAY.test(searchParams.get('from') || '') ? searchParams.get('from')! : '';
    if (!fromP) {
      const end = toP ? new Date(toP + 'T00:00:00Z') : new Date();
      fromP = new Date(end.getTime() - 60 * 24 * 3600 * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 10);
    }
    const rows = data.filter((r: any) => {
      const d = isoDay(r.order_date);
      return d >= fromP && (!toP || d <= toP);
    });
    return jsonWithEtag(request, rows);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch order reports' }, { status: 500 });
  }
}
