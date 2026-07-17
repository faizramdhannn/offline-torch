import { makeDailyJobReportRoutes } from '@/lib/dailyJobReports';

// sales_order_report — 12 kolom:
//   id, created_at, update_at, taft_by, role_taft, name,
//   error_sales_order, error_category_sales_order, error_notes_sales_order,
//   error_image_url_sales_order, error_solved_sales_order, solved_at
const routes = makeDailyJobReportRoutes({
  sheetName: 'sales_order_report',
  reportType: 'sales_order_report',
  errorField: 'error_sales_order',
  categoryField: 'error_category_sales_order',
  notesField: 'error_notes_sales_order',
  imageUrlField: 'error_image_url_sales_order',
  solvedField: 'error_solved_sales_order',
});

export const { GET, POST, PUT, DELETE } = routes;
