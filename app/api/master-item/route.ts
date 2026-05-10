import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'invoice' | null

    const data = await getSheetData('master_item');

    if (mode === 'invoice') {
      // ── Mode Invoice ──────────────────────────────────────────────────────
      // Hanya butuh SKU, Product_name, HPJ
      // Dedup berdasarkan Product_name + HPJ (abaikan Artikel, Grade, dll)
      const seen = new Set<string>();
      const deduped = data
        .filter((item: any) => item.Product_name || item.SKU)
        .filter((item: any) => {
          const key = `${(item.Product_name || '').trim()}|||${(item.HPJ || '').trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item: any) => ({
          SKU:          item.SKU || '',
          Product_name: item.Product_name || '',
          HPJ:          item.HPJ || '',
        }));

      return NextResponse.json(deduped);
    }

    // ── Mode Default (Bundling & lainnya) ──────────────────────────────────
    // Return semua kolom asli tanpa dedup — Bundling butuh Artikel untuk getHPJ
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching master items:', error);
    return NextResponse.json({ error: 'Failed to fetch master items' }, { status: 500 });
  }
}