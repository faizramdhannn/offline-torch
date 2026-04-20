import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';
    const hasReportAccess = searchParams.get('hasReportAccess') === 'true';

    const data = await getSheetData('sto_store');
    const filtered = data.filter((row: any) => row.id);

    // If has report access, return all stores
    if (hasReportAccess) {
      return NextResponse.json(filtered);
    }

    // Otherwise only return rows where store column matches username (case-insensitive)
    const userStores = filtered.filter(
      (row: any) =>
        row.store &&
        row.store.trim().toLowerCase() === username.trim().toLowerCase()
    );

    return NextResponse.json(userStores);
  } catch (error) {
    console.error('Error fetching sto_store:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}