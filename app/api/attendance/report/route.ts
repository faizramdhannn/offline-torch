import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetDataWithHeader } from '@/lib/sheets';

const SHEET = 'schedule_report';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store_name');
    const taftName = searchParams.get('taft_name');
    const month = searchParams.get('month'); // format: YYYY-MM

    const data = await getSheetData(SHEET);
    const filtered = data.filter((r: any) => r.date);

    let result = filtered;
    if (storeName) result = result.filter((r: any) => r.store_name?.toLowerCase() === storeName.toLowerCase());
    if (taftName) result = result.filter((r: any) => r.taft_name === taftName);
    if (month) {
      result = result.filter((r: any) => {
        const d = new Date(r.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === month;
      });
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
      const key = `${r.date}__${r.store_name}__${r.taft_name}`;
      const dataRow = [r.date, r.store_name, r.taft_name, r.clock_in || '', r.clock_out || '', r.code_time || '', r.overtime_hours || '', r.reason || ''];
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