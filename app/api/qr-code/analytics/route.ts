import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { jakartaDateKeyFromCreatedAt } from '@/lib/dailyJobDate';

// Ringkasan analitik scan untuk 1 QR (?qr_uuid=...) — dihitung client-agnostic
// di server dari qr_code_analytic (dicatat oleh app/r/[uuid]/route.ts).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qrUuid = searchParams.get('qr_uuid');
    if (!qrUuid) return NextResponse.json({ error: 'Missing qr_uuid' }, { status: 400 });

    const rows = await getSheetData('qr_code_analytic');
    const scans = rows.filter((r: any) => r.qr_uuid === qrUuid);

    const byDevice: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const s of scans) {
      const device = s.device_type || 'Unknown';
      byDevice[device] = (byDevice[device] || 0) + 1;

      const country = s.country || 'Unknown';
      byCountry[country] = (byCountry[country] || 0) + 1;

      const browser = s.browser || 'Unknown';
      byBrowser[browser] = (byBrowser[browser] || 0) + 1;

      const dayKey = jakartaDateKeyFromCreatedAt(s.scanned_at) || s.scanned_at || 'Unknown';
      byDay[dayKey] = (byDay[dayKey] || 0) + 1;
    }

    return NextResponse.json({
      total_scans: scans.length,
      by_device: byDevice,
      by_country: byCountry,
      by_browser: byBrowser,
      by_day: byDay,
      recent: scans.slice(-20).reverse(),
    });
  } catch (error) {
    console.error('Error fetching qr_code analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
