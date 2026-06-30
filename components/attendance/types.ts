// ─── Shared Attendance Types ────────────────────────────────────────────────
// Extracted from the original app/(main)/attendance/page.tsx without any
// changes to shape/fields — only made `export`-able for reuse across the
// split-out attendance components.

export interface ScheduleRow {
  id: string;
  date_range: string;
  taft_name: string;
  store_name: string;
  monday: string; tuesday: string; wednesday: string;
  thursday: string; friday: string; saturday: string; sunday: string;
}

export interface DateEntry    { id: string; date_range: string; week_start: string; week_end: string; }
export interface TaftEntry    { id: string; store_name: string; taft_name: string; start_date: string; end_date: string; }
export interface TimeCode     { id: string; code_time: string; definition_code: string; }
export interface StoreEntry   { id: string; store_name: string; }
export interface StoreWagesEntry {
  id: string;
  store_name: string;
  type_store?: string;
  open_hours?: string;
  close_hours?: string;
  store_wages?: string; // e.g. "Rp2.878.646"
}
export interface SalesStat {
  month_sales: string;
  store_name: string;
  sales: number;
}
export interface ReportRow {
  date: string; store_name: string; taft_name: string;
  clock_in: string; clock_out: string; code_time: string;
  overtime_hours: string; reason: string;
}

// Used by ReportDashboard / MiniBarChart (FullReport tab)
export interface TaftStat {
  taft_name: string;
  store_name: string;
  masuk: number;
  off: number;
  cuti: number;
  lembur: number;
  sakit: number;
  izin: number;
  alpa: number;
}

export type ChartKey = 'masuk' | 'lembur' | 'cuti' | 'off';

/** rows grouped by `${store_name}__${taft_name}`, used across the Full Report tab */
export type GroupedByTaft = Record<
  string,
  { taft_name: string; store_name: string; rows: ReportRow[] }
>;

/** tafts grouped by store, used by Weekly Schedule / Monthly Report tabs */
export type TaftStoreGroup = { storeName: string; tafts: TaftEntry[] };

export interface PopupState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}
