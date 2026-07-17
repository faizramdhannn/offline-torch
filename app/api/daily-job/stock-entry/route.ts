import { makeDailyJobReportRoutes } from '@/lib/dailyJobReports';

// stock_entry_report — 12 kolom:
//   id, created_at, update_at, taft_by, role_taft, name,
//   error_stock_entry, error_category_stock_entry, error_notes_stock_entry,
//   error_image_url_stock_entry, error_solved_stock_entry, solved_at
const routes = makeDailyJobReportRoutes({
  sheetName: 'stock_entry_report',
  reportType: 'stock_entry_report',
  errorField: 'error_stock_entry',
  categoryField: 'error_category_stock_entry',
  notesField: 'error_notes_stock_entry',
  imageUrlField: 'error_image_url_stock_entry',
  solvedField: 'error_solved_stock_entry',
});

export const { GET, POST, PUT, DELETE } = routes;
