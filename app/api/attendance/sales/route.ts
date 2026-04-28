// app/api/attendance/sales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

/**
 * GET /api/attendance/sales?month=YYYY-MM
 *
 * Membaca sheet `sales_store` yang formatnya WIDE:
 *   month_sales | lembong | margonda | karawaci | ...
 *   April       | Rp119.. | Rp143..  | Rp52...  | ...
 *
 * Lalu mengubahnya ke format LONG yang dipakai SalesWagesChart:
 *   [{ month_sales: "April", store_name: "lembong", sales: 119844400 }, ...]
 *
 * Parameter month (YYYY-MM) digunakan untuk mencocokkan baris berdasarkan
 * nama bulan Indonesia (Jan, Feb, ..., Desember) atau angka bulan.
 */

const MONTH_MAP: Record<string, string[]> = {
  '01': ['januari',  'jan', '1',  'january'],
  '02': ['februari', 'feb', '2',  'february'],
  '03': ['maret',    'mar', '3',  'march'],
  '04': ['april',    'apr', '4'],
  '05': ['mei',      'may', '5'],
  '06': ['juni',     'jun', '6',  'june'],
  '07': ['juli',     'jul', '7',  'july'],
  '08': ['agustus',  'agu', '8',  'august'],
  '09': ['september','sep', '9'],
  '10': ['oktober',  'okt', '10', 'october'],
  '11': ['november', 'nov', '11'],
  '12': ['desember', 'des', '12', 'december'],
};

function parseCurrency(val: string | number | undefined | null): number {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val)
    .replace(/Rp\s?/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Return true if the cell value matches the given YYYY-MM month string */
function matchesMonth(cellValue: string, month: string): boolean {
  const [, mm] = month.split('-');
  const aliases = MONTH_MAP[mm] || [];
  const normalized = String(cellValue).toLowerCase().trim();
  return aliases.includes(normalized);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    const rows: Record<string, any>[] = await getSheetData('sales_store');

    if (!rows || rows.length === 0) {
      return NextResponse.json([]);
    }

    // If no month filter, return all rows converted to long format
    const targetRows = month
      ? rows.filter((r) => matchesMonth(r.month_sales ?? '', month))
      : rows;

    const result: { month_sales: string; store_name: string; sales: number }[] = [];

    for (const row of targetRows) {
      const monthLabel = String(row.month_sales ?? '');
      // Every key except month_sales is a store column
      for (const [key, value] of Object.entries(row)) {
        if (key === 'month_sales') continue;
        const sales = parseCurrency(value as string);
        if (sales > 0 || value !== '') {
          result.push({
            month_sales: monthLabel,
            store_name: key,
            sales,
          });
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
  }
}