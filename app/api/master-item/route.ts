import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('master_item');

    // Ambil unique Artikel beserta HPJ-nya, sort A-Z
    const seen = new Set<string>();
    const unique = data
      .filter((item: any) => {
        if (!item.Artikel || seen.has(item.Artikel)) return false;
        seen.add(item.Artikel);
        return true;
      })
      .map((item: any) => ({
        Artikel: item.Artikel,
        HPJ: item.HPJ,
      }))
      .sort((a: any, b: any) => a.Artikel.localeCompare(b.Artikel));

    return NextResponse.json(unique);
  } catch (error) {
    console.error('Error fetching master item data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch master item data' },
      { status: 500 }
    );
  }
}