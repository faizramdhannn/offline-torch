import { NextResponse } from 'next/server';
import { getDailyJobDropdowns } from '../lib/dropdown';

// GET /api/daily-job/dropdown
// Thin wrapper — returns { role_taft, error_category_delivery_note,
// error_solved_delivery_note, error_category_sales_order,
// error_solved_sales_order, error_category_stock_entry,
// error_solved_stock_entry } for populating all Daily Job form dropdowns.
export async function GET() {
  try {
    const data = await getDailyJobDropdowns();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET daily-job dropdown error:', error);
    return NextResponse.json({
      role_taft: [],
      error_category_delivery_note: [],
      error_solved_delivery_note: [],
      error_category_sales_order: [],
      error_solved_sales_order: [],
      error_category_stock_entry: [],
      error_solved_stock_entry: [],
    }, { status: 500 });
  }
}
