import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { jakartaDateKeyFromCreatedAt, todayJakartaKey, parseCreatedAtForSort } from '@/lib/dailyJobDate';

// GET /api/daily-job/report?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Aggregation endpoint for the `daily_checklist_all` permission — users with
// this permission see EVERY taft's data (no per-user filtering), used to
// power charts/tables in the follow-up frontend pass. Defaults to ALL
// history (Asia/Jakarta) up to today when `from`/`to` are omitted — the
// frontend's per-tab date filter narrows this by passing both params.
//
// Response shape:
//   {
//     dailyTrend: { date, total_error_delivery_note, total_error_sales_order, total_error_stock_entry }[],
//     completionTrend: { date, completed_count, total_taft_count, completion_rate }[],
//     deliveryNoteTrend: { date, count }[],
//     salesOrderTrend: { date, count }[],
//     stockEntryTrend: { date, count }[],
//     checklistRows/deliveryNoteRows/salesOrderRows/stockEntryRows:
//       [...raw rows within [from, to], newest first],
//   }
//
// KNOWN SIMPLIFICATION (documented for the frontend-building agent):
// `completionTrend[].total_taft_count` is the count of DISTINCT `taft_by`
// values ever seen across ALL daily_checklist rows in the whole dataset
// (i.e. "how many taft have ever filled a checklist at least once"), NOT the
// number of currently-active employees/taft on the roster. A more accurate
// denominator would require importing the HR/store employee roster, which is
// out of scope for this backend pass. Treat `completion_rate` as an
// approximation, not an authoritative HR metric.

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function countByDay(rows: any[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = jakartaDateKeyFromCreatedAt(r.created_at);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || todayJakartaKey();

    const [checklistRowsAll, deliveryNoteRowsAll, salesOrderRowsAll, stockEntryRowsAll] = await Promise.all([
      getSheetData('daily_checklist'),
      getSheetData('delivery_note_report'),
      getSheetData('sales_order_report'),
      getSheetData('stock_entry_report'),
    ]);

    const inRange = (dateKey: string) => !!dateKey && (!from || dateKey >= from) && dateKey <= to;
    const filterByRange = (rows: any[]) => rows.filter((r: any) => inRange(jakartaDateKeyFromCreatedAt(r.created_at)));

    const checklistRows = filterByRange(checklistRowsAll);
    const deliveryNoteRows = filterByRange(deliveryNoteRowsAll);
    const salesOrderRows = filterByRange(salesOrderRowsAll);
    const stockEntryRows = filterByRange(stockEntryRowsAll);

    const checklistInRange = checklistRows;

    // ── dailyTrend: sum of total_error_* per calendar day across all taft ──
    const trendMap = new Map<string, { total_error_delivery_note: number; total_error_sales_order: number; total_error_stock_entry: number }>();
    for (const r of checklistInRange as any[]) {
      const key = jakartaDateKeyFromCreatedAt(r.created_at);
      if (!key) continue;
      const entry = trendMap.get(key) || { total_error_delivery_note: 0, total_error_sales_order: 0, total_error_stock_entry: 0 };
      entry.total_error_delivery_note += num(r.total_error_delivery_note);
      entry.total_error_sales_order += num(r.total_error_sales_order);
      entry.total_error_stock_entry += num(r.total_error_stock_entry);
      trendMap.set(key, entry);
    }
    const dailyTrend = [...trendMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, v]) => ({ date, ...v }));

    // ── completionTrend: distinct taft who filled a checklist that day ─────
    // Denominator: distinct taft_by across ALL daily_checklist rows (full
    // dataset, not just the selected range) — see KNOWN SIMPLIFICATION above.
    const allTaftEver = new Set((checklistRowsAll as any[]).map((r: any) => r.taft_by).filter(Boolean));
    const totalTaftCount = allTaftEver.size;

    const completedByDay = new Map<string, Set<string>>();
    for (const r of checklistInRange as any[]) {
      const key = jakartaDateKeyFromCreatedAt(r.created_at);
      if (!key || !r.taft_by) continue;
      if (!completedByDay.has(key)) completedByDay.set(key, new Set());
      completedByDay.get(key)!.add(r.taft_by);
    }
    const completionTrend = [...completedByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, taftSet]) => {
        const completed_count = taftSet.size;
        const completion_rate = totalTaftCount > 0 ? completed_count / totalTaftCount : 0;
        return { date, completed_count, total_taft_count: totalTaftCount, completion_rate };
      });

    const sortDesc = (rows: any[]) => [...rows].sort((a, b) => parseCreatedAtForSort(b.created_at) - parseCreatedAtForSort(a.created_at));

    return NextResponse.json({
      dailyTrend,
      completionTrend,
      deliveryNoteTrend: countByDay(deliveryNoteRows),
      salesOrderTrend: countByDay(salesOrderRows),
      stockEntryTrend: countByDay(stockEntryRows),
      checklistRows: sortDesc(checklistRows),
      deliveryNoteRows: sortDesc(deliveryNoteRows),
      salesOrderRows: sortDesc(salesOrderRows),
      stockEntryRows: sortDesc(stockEntryRows),
    });
  } catch (error) {
    console.error('GET daily-job report error:', error);
    return NextResponse.json({ error: 'Failed to build daily-job report' }, { status: 500 });
  }
}
