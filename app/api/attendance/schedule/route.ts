import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

const SHEET = 'schedule_taft';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store_name');
    const dateRange = searchParams.get('date_range');

    const data = await getSheetData(SHEET);
    const filtered = data.filter((row: any) => row.id);

    let result = filtered;
    if (storeName) {
      result = result.filter((r: any) => r.store_name?.toLowerCase() === storeName.toLowerCase());
    }
    if (dateRange) {
      result = result.filter((r: any) => r.date_range === dateRange);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date_range, taft_name, store_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, created_by } = body;

    if (!date_range || !taft_name || !store_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if entry exists
    const existing = await getSheetData(SHEET);
    const existingIdx = existing.findIndex(
      (r: any) => r.date_range === date_range && r.taft_name === taft_name && r.store_name === store_name
    );

    const now = new Date().toISOString();
    const id = Date.now().toString();

    const row = [
      existingIdx === -1 ? id : existing[existingIdx].id,
      date_range,
      taft_name,
      store_name,
      monday || '',
      tuesday || '',
      wednesday || '',
      thursday || '',
      friday || '',
      saturday || '',
      sunday || '',
      existingIdx === -1 ? now : existing[existingIdx].created_at,
      existingIdx === -1 ? created_by : existing[existingIdx].created_by,
      now,
      created_by,
    ];

    if (existingIdx === -1) {
      await appendSheetData(SHEET, [row]);
    } else {
      await updateSheetRow(SHEET, existingIdx + 2, row);
    }

    return NextResponse.json({ success: true, id: row[0] });
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}