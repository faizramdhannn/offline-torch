import { NextResponse } from 'next/server';
import { getDailyJobDropdowns } from '../lib/dropdown';

// GET /api/daily-job/dropdown
// Thin wrapper — returns { role_taft, checklist_opening,
// checklist_operational, checklist_closing } for the Daily Job checklist
// form. The checklist_* lists drive which items render per category — add
// or remove rows in master_dropdown to change them, no code change needed.
export async function GET() {
  try {
    const data = await getDailyJobDropdowns();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET daily-job dropdown error:', error);
    return NextResponse.json({
      role_taft: [],
      checklist_opening: [],
      checklist_operational: [],
      checklist_closing: [],
    }, { status: 500 });
  }
}
