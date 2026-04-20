import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

// Build date range for a given month period
// taft_list has start_date (day of month) and end_date (day of month)
// e.g. start=26, end=25 means 26 of prev month to 25 of this month
function buildDateRange(month: string, startDay: number, endDay: number): Date[] {
  const [year, mon] = month.split('-').map(Number);
  // Determine period: from startDay of previous month to endDay of this month
  // E.g. April period: 26 March - 25 April
  const startDate = new Date(year, mon - 2, startDay); // mon-2 because months are 0-indexed and we want prev month
  const endDate = new Date(year, mon - 1, endDay);

  const dates: Date[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store');
    const taftName = searchParams.get('taft');
    const month = searchParams.get('month'); // YYYY-MM

    if (!storeName || !taftName || !month) {
      return NextResponse.json({ error: 'store, taft, and month are required' }, { status: 400 });
    }

    // Get taft info to know start/end day
    const taftList = await getSheetData('taft_list');
    const taftInfo = taftList.find(
      (t: any) => t.store_name?.toLowerCase() === storeName.toLowerCase() && t.taft_name === taftName
    );

    const startDay = taftInfo ? parseInt(taftInfo.start_date) || 26 : 26;
    const endDay = taftInfo ? parseInt(taftInfo.end_date) || 25 : 25;

    const dates = buildDateRange(month, startDay, endDay);

    // Build CSV content
    const lines = ['date,store_name,taft_name,clock_in,clock_out,code_time,overtime_hours,reason'];
    for (const d of dates) {
      lines.push(`${formatDateISO(d)},${storeName},${taftName},,,,, `);
    }

    const csvContent = lines.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_${storeName}_${taftName.replace(/ /g, '_')}_${month}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}