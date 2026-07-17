import { makeDailyJobReportRoutes } from '@/lib/dailyJobReports';

// delivery_note_report — 12 kolom:
//   id, created_at, update_at, taft_by, role_taft, name,
//   error_sales_order_delivery_note, error_category_delivery_note, error_notes_delivery_note,
//   error_image_url_delivery_note, error_solved_delivery_note, solved_at
const routes = makeDailyJobReportRoutes({
  sheetName: 'delivery_note_report',
  reportType: 'delivery_note_report',
  errorField: 'error_sales_order_delivery_note',
  categoryField: 'error_category_delivery_note',
  notesField: 'error_notes_delivery_note',
  imageUrlField: 'error_image_url_delivery_note',
  solvedField: 'error_solved_delivery_note',
});

export const { GET, POST, PUT, DELETE } = routes;
