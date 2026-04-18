import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetDataWithHeader, appendSheetData } from '@/lib/sheets';

const SHEET = 'master_traffic';

// GET – return as Record<code, notes>
export async function GET() {
  try {
    const data = await getSheetData(SHEET);
    const map: Record<string, string> = {};
    data.forEach((row: any) => {
      const code = row['code_traffic']?.trim();
      const label = row['notes']?.trim();
      if (code && label) map[code] = label;
    });
    return NextResponse.json(map);
  } catch (error) {
    console.error('Error fetching master traffic:', error);
    return NextResponse.json({ error: 'Failed to fetch master traffic' }, { status: 500 });
  }
}

// POST – add new entry
export async function POST(request: NextRequest) {
  try {
    const { code_traffic, notes } = await request.json();
    if (!code_traffic?.trim() || !notes?.trim()) {
      return NextResponse.json({ error: 'code_traffic and notes are required' }, { status: 400 });
    }

    // Check duplicate
    const existing = await getSheetData(SHEET);
    const isDuplicate = existing.some(
      (row: any) => row['code_traffic']?.trim().toUpperCase() === code_traffic.trim().toUpperCase()
    );
    if (isDuplicate) {
      return NextResponse.json({ error: `Kode "${code_traffic.trim().toUpperCase()}" sudah ada` }, { status: 409 });
    }

    if (existing.length === 0) {
      await updateSheetDataWithHeader(SHEET, [
        ['code_traffic', 'notes'],
        [code_traffic.trim().toUpperCase(), notes.trim()],
      ]);
    } else {
      await appendSheetData(SHEET, [[code_traffic.trim().toUpperCase(), notes.trim()]]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding master traffic:', error);
    return NextResponse.json({ error: 'Failed to add entry' }, { status: 500 });
  }
}

// PUT – update existing entry by code
export async function PUT(request: NextRequest) {
  try {
    const { original_code, code_traffic, notes } = await request.json();
    if (!original_code?.trim() || !code_traffic?.trim() || !notes?.trim()) {
      return NextResponse.json({ error: 'original_code, code_traffic, and notes are required' }, { status: 400 });
    }

    const existing = await getSheetData(SHEET);

    // Check duplicate code (excluding self)
    const isDuplicate = existing.some(
      (row: any) =>
        row['code_traffic']?.trim().toUpperCase() === code_traffic.trim().toUpperCase() &&
        row['code_traffic']?.trim().toUpperCase() !== original_code.trim().toUpperCase()
    );
    if (isDuplicate) {
      return NextResponse.json({ error: `Kode "${code_traffic.trim().toUpperCase()}" sudah ada` }, { status: 409 });
    }

    const updated = existing.map((row: any) => {
      if (row['code_traffic']?.trim().toUpperCase() === original_code.trim().toUpperCase()) {
        return { ...row, code_traffic: code_traffic.trim().toUpperCase(), notes: notes.trim() };
      }
      return row;
    });

    const rows = updated.map((row: any) => [row['code_traffic'], row['notes']]);
    await updateSheetDataWithHeader(SHEET, [['code_traffic', 'notes'], ...rows]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating master traffic:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

// DELETE – remove entry by code
export async function DELETE(request: NextRequest) {
  try {
    const { code_traffic } = await request.json();
    if (!code_traffic?.trim()) {
      return NextResponse.json({ error: 'code_traffic is required' }, { status: 400 });
    }

    const existing = await getSheetData(SHEET);
    const filtered = existing.filter(
      (row: any) => row['code_traffic']?.trim().toUpperCase() !== code_traffic.trim().toUpperCase()
    );

    const rows = filtered.map((row: any) => [row['code_traffic'], row['notes']]);
    await updateSheetDataWithHeader(SHEET, [['code_traffic', 'notes'], ...rows]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting master traffic:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}