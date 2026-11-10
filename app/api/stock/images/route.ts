import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// Foto katalog satu SKU (kolom catalog_images di master_item: link CDN dipisah ";", maks 9) untuk baris stock yang diperluas.
// Hemat Vercel: sheet dibaca lewat cache server 5 menit, balasan hanya daftar link (± 1 KB) dan di-cache browser 30 menit;
// gambar sendiri diambil browser langsung dari CDN Shopify (tidak lewat Vercel).
const MAX = 9;

export async function GET(request: NextRequest) {
  try {
    const sku = (new URL(request.url).searchParams.get('sku') || '').trim();
    if (!sku) return NextResponse.json({ images: [] });
    const data = (await getSheetData('master_item_images')) as any[];
    const row = data.find((r) => String(r.SKU ?? r.sku ?? '').trim() === sku);
    const seen = new Set<string>();
    const images: string[] = [];
    for (const u of String(row?.catalog_images ?? '').split(';').map((x) => x.trim())) {
      const key = u.split('?')[0];
      if (!/^https?:\/\//i.test(u) || seen.has(key)) continue;
      seen.add(key);
      images.push(u);
      if (images.length >= MAX) break;
    }
    return NextResponse.json({ images }, { headers: { 'Cache-Control': 'private, max-age=1800' } });
  } catch (error) {
    console.error('Stock images error:', error);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
