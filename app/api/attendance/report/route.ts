import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetDataWithHeader } from '@/lib/sheets';

const SHEET = 'schedule_report';

/**
 * Build the date range boundaries for a given month + taft period config.
 *
 * Rules (same as template/page logic):
 *   - If startDay < endDay  → startDay..endDay of the SAME month
 *     e.g. start=1, end=31, month=April  → 1 Apr – 31 Apr
 *   - If startDay >= endDay → startDay of PREV month .. endDay of CURRENT month
 *     e.g. start=26, end=25, month=April → 26 Mar – 25 Apr
 *     e.g. start=25, end=25, month=April → 25 Mar – 25 Apr
 *
 * Returns { from: Date, to: Date } (both at midnight, inclusive).
 */
function buildDateRangeBounds(
  month: string,
  startDay: number,
  endDay: number
): { from: Date; to: Date } {
  const [year, mon] = month.split('-').map(Number); // mon is 1-indexed

  let from: Date;
  let to: Date;

  if (startDay < endDay) {
    // Same-month range
    from = new Date(year, mon - 1, startDay);
    to   = new Date(year, mon - 1, endDay);
  } else {
    // Cross-month range: startDay of previous month → endDay of current month
    from = new Date(year, mon - 2, startDay); // mon-2 because 0-indexed and prev month
    to   = new Date(year, mon - 1, endDay);
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Parse YYYY-MM-DD (the stored date format) into a Date at midnight. */
function parseStoredDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store_name');
    const taftName  = searchParams.get('taft_name');
    const month     = searchParams.get('month'); // format: YYYY-MM

    // Optional per-taft date range config (sent by the client when it knows them)
    const startDay = parseInt(searchParams.get('start_day') || '0') || null;
    const endDay   = parseInt(searchParams.get('end_day')   || '0') || null;

    const data     = await getSheetData(SHEET);
    const filtered = data.filter((r: any) => r.date);

    let result = filtered;
    if (storeName) result = result.filter((r: any) => r.store_name?.toLowerCase() === storeName.toLowerCase());
    if (taftName)  result = result.filter((r: any) => r.taft_name === taftName);

    if (month) {
      if (startDay && endDay) {
        // Specific taft date range provided — use it exactly
        const { from, to } = buildDateRangeBounds(month, startDay, endDay);
        result = result.filter((r: any) => {
          const d = parseStoredDate(r.date);
          return d && d >= from && d <= to;
        });
      } else {
        // No specific start/end day — fetch a WIDE window covering:
        // day 1 of previous month → last day of current month.
        // This ensures cross-month periods (e.g. 25 Mar – 25 Apr) are fully included.
        // The client is responsible for per-taft precision filtering using buildTaftDateRange.
        const [year, mon] = month.split('-').map(Number);
        const from = new Date(year, mon - 2, 1);          // 1st of previous month
        const to   = new Date(year, mon, 0);               // last day of current month
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        result = result.filter((r: any) => {
          const d = parseStoredDate(r.date);
          return d && d >= from && d <= to;
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data' }, { status: 400 });
    }

    // rows: array of { date, store_name, taft_name, clock_in, clock_out, code_time, overtime_hours, reason }
    // Upsert by date+store_name+taft_name
    const existing = await getSheetData(SHEET);
    const keyMap = new Map<string, number>();
    existing.forEach((r: any, i: number) => {
      if (r.date) keyMap.set(`${r.date}__${r.store_name}__${r.taft_name}`, i);
    });

    const toAppend: any[][] = [];
    const toUpdate: { idx: number; row: any[] }[] = [];

    for (const r of rows) {
      const key     = `${r.date}__${r.store_name}__${r.taft_name}`;
      const dataRow = [
        r.date,
        r.store_name,
        r.taft_name,
        r.clock_in        || '',
        r.clock_out       || '',
        r.code_time       || '',
        r.overtime_hours  || '',
        r.reason          || '',
      ];
      if (keyMap.has(key)) {
        toUpdate.push({ idx: keyMap.get(key)!, row: dataRow });
      } else {
        toAppend.push(dataRow);
      }
    }

    // Rebuild entire sheet for updates
    if (toUpdate.length > 0) {
      const headers = ['date', 'store_name', 'taft_name', 'clock_in', 'clock_out', 'code_time', 'overtime_hours', 'reason'];
      const allRows = existing.map((r: any, i: number) => {
        const updated = toUpdate.find(u => u.idx === i);
        if (updated) return updated.row;
        return [r.date, r.store_name, r.taft_name, r.clock_in || '', r.clock_out || '', r.code_time || '', r.overtime_hours || '', r.reason || ''];
      });
      await updateSheetDataWithHeader(SHEET, [headers, ...allRows]);
    }

    if (toAppend.length > 0) {
      await appendSheetData(SHEET, toAppend);
    }

    return NextResponse.json({ success: true, imported: rows.length });
  } catch (error) {
    console.error('Error importing report:', error);
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 });
  }
}