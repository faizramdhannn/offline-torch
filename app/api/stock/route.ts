import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { sessionUser } from '@/lib/authz';
import { jsonWithEtag } from '@/lib/etag';

// Hanya sheet stok yang memang dipakai klien (sebelumnya nama sheet apa pun bisa dibaca).
const ALLOWED_TYPES = new Set([
  'result_stock', 'pca_stock', 'master_item', 'result_stock_yesterday', 'pca_stock_yesterday',
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'result_stock';
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Tipe stok tidak dikenal' }, { status: 400 });
    }

    let data: any[] = await getSheetData(type);

    // Detail satu SKU (halaman /stock/[id]): jangan unduh seluruh sheet.
    const sku = searchParams.get('sku');
    if (sku) data = data.filter((r: any) => String(r.sku || r.SKU) === sku);

    // HPP/HPT hanya untuk yang berhak (HPJ tetap — dipakai tampilan nilai stok).
    const user = await sessionUser(request);
    const hideHpp = user?.stock_view_hpp !== 'TRUE';
    const hideHpt = user?.stock_view_hpt !== 'TRUE';
    if (hideHpp || hideHpt) {
      data = data.map((r: any) => {
        const c = { ...r };
        if (hideHpp) { delete c.hpp; delete c.HPP; }
        if (hideHpt) { delete c.hpt; delete c.HPT; }
        return c;
      });
    }

    // Respons berbeda per user → private + ETag (304 bila tidak berubah).
    return jsonWithEtag(request, data);
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