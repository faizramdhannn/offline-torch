import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

// ── helpers ──────────────────────────────────────────────────────────────────
function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName') || '';
    const isAll = searchParams.get('isAll') === 'true';

    const rows = await getSheetData('material_issue');

    const filtered = isAll
      ? rows
      : rows.filter((r: any) => r.created_by === userName);

    const sorted = [...filtered].sort((a: any, b: any) => {
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      return tB - tA;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('GET material_issue error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Kolom spreadsheet: id, name, assigned_to, user_name, item_sku, item_name,
// item_qty, item_hpj, request_by, request_number, issue_number, type_reason,
// reason, has_processed, created_by, update_by, created_at, update_at
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: any[] = Array.isArray(body) ? body : [body];

    const now = toJakartaTimestamp();
    const rows = items.map((item) => [
      item.id,
      item.name,
      item.assigned_to || '',
      item.user_name,
      item.item_sku,
      item.item_name,
      item.item_qty,
      item.item_hpj,
      item.request_by,
      item.request_number,
      item.issue_number,
      item.type_reason,
      item.reason,
      'FALSE',
      item.created_by,
      '',
      now,
      now,
    ]);

    await appendSheetData('material_issue', rows);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST material_issue error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, update_by, ...fields } = body;

    const rows = await getSheetData('material_issue');
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = rows[idx];
    const now = toJakartaTimestamp();
    const rowIndex = idx + 2;

    const updatedRow = [
      existing.id,
      fields.name ?? existing.name,
      fields.assigned_to ?? existing.assigned_to ?? '',
      fields.user_name ?? existing.user_name,
      fields.item_sku ?? existing.item_sku,
      fields.item_name ?? existing.item_name,
      fields.item_qty ?? existing.item_qty,
      fields.item_hpj ?? existing.item_hpj,
      fields.request_by ?? existing.request_by,
      fields.request_number ?? existing.request_number,
      fields.issue_number ?? existing.issue_number,
      fields.type_reason ?? existing.type_reason,
      fields.reason ?? existing.reason,
      fields.has_processed ?? existing.has_processed,
      existing.created_by,
      update_by,
      existing.created_at,
      now,
    ];

    await updateSheetRow('material_issue', rowIndex, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT material_issue error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('material_issue');
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rowIndex = idx + 2;
    const emptyRow = Array(18).fill('');
    await updateSheetRow('material_issue', rowIndex, emptyRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE material_issue error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}