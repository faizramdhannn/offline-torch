import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, withCache } from '@/lib/sheets';
import { sessionUser } from '@/lib/authz';
import { jsonWithEtag } from '@/lib/etag';
import { sql } from '@/lib/neon';
import { isStoreScoped, scopeStockRows } from '@/lib/stockScope';

// Hanya sheet stok yang memang dipakai klien (sebelumnya nama sheet apa pun bisa dibaca).
const ALLOWED_TYPES = new Set([
  'result_stock', 'pca_stock', 'master_item', 'result_stock_yesterday', 'pca_stock_yesterday',
]);

// Memo hasil olahan per array sumber (WeakMap: otomatis hilang saat cache Sheets diganti).
const variantCache = new WeakMap<any[], Map<string, any[]>>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'result_stock';
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Tipe stok tidak dikenal' }, { status: 400 });
    }

    let data: any[] = await getSheetData(type);

    const user = await sessionUser(request);

    // Store/Merchant melihat stok semua toko & merchant, tapi bukan gudang partner (Neka/Gramedia/Vega/Metro).
    const scoped = !!user && isStoreScoped(user.role) && (type === 'result_stock' || type === 'result_stock_yesterday');
    // HPP/HPT hanya untuk yang berhak (HPJ tetap — dipakai tampilan nilai stok).
    const hideHpp = user?.stock_view_hpp !== 'TRUE';
    const hideHpt = user?.stock_view_hpt !== 'TRUE';

    // Hasil olahan (scope toko + buang HPP/HPT) di-memo per array sumber: selama cache Sheets (5 mnt) belum
    // berganti, array sumbernya sama → tidak disalin/di-stringify ulang tiap request (hemat CPU).
    const variant = `${scoped ? 1 : 0}${hideHpp ? 1 : 0}${hideHpt ? 1 : 0}`;
    let perSource = variantCache.get(data);
    if (!perSource) { perSource = new Map(); variantCache.set(data, perSource); }
    let out = perSource.get(variant);
    if (!out) {
      let rows = data;
      if (scoped) {
        // Daftar akun store/merchant jarang berubah → cache 5 menit (bukan query Neon tiap request).
        const accounts = await withCache('stock_scope_accounts', 300_000, async () =>
          (await sql`SELECT name, user_name FROM app_users WHERE role IN ('store','merchant')`) as { name: string; user_name: string }[]);
        rows = scopeStockRows(rows, accounts);
      }
      if (hideHpp || hideHpt) {
        rows = rows.map((r: any) => {
          const c = { ...r };
          if (hideHpp) { delete c.hpp; delete c.HPP; }
          if (hideHpt) { delete c.hpt; delete c.HPT; }
          return c;
        });
      }
      out = rows;
      perSource.set(variant, out);
    }
    data = out;

    // Respons berbeda per user → private + ETag (304 bila tidak berubah).
    return jsonWithEtag(request, data, 200, true);
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