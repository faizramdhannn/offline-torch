import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, updateMultipleSheetRows } from '@/lib/sheets';

// ── helpers ──────────────────────────────────────────────────────────────────
function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

// Baris di sheet diidentifikasi secara unik oleh kombinasi (id, item_sku),
// karena satu "group" (id sama) bisa berisi banyak item_sku berbeda.
function findRowIndex(rows: any[], id: string, sku?: string | null): number {
  if (sku) {
    return rows.findIndex((r: any) => r.id === id && r.item_sku === sku);
  }
  return rows.findIndex((r: any) => r.id === id);
}

function findGroupIndexes(rows: any[], id: string): number[] {
  return rows
    .map((r: any, i: number) => (r.id === id ? i : -1))
    .filter((i: number) => i !== -1);
}

// Kolom spreadsheet (urutan tetap, dipakai di semua operasi):
// 0  id
// 1  name
// 2  assigned_to
// 3  user_name
// 4  item_sku
// 5  item_name
// 6  item_qty
// 7  item_hpj
// 8  request_by
// 9  request_number
// 10 issue_number
// 11 type_reason
// 12 reason
// 13 has_processed
// 14 created_by
// 15 update_by
// 16 created_at
// 17 update_at
function buildRow(existing: any, fields: any, update_by: string | undefined, now: string): any[] {
  return [
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
    update_by ?? existing.update_by ?? '',
    existing.created_at,
    now,
  ];
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
// POST selalu berarti "buat baris baru" (insert), baik untuk create issue baru
// maupun untuk re-create baris saat proses edit (setelah baris lama dihapus
// lewat DELETE whole-group). Endpoint ini TIDAK melakukan upsert/update sama
// sekali — tanggung jawab memastikan tidak ada duplikat ada di pemanggil
// (client), yaitu dengan memanggil DELETE dulu untuk seluruh baris lama
// sebelum POST.
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
      item.has_processed || 'FALSE',
      item.created_by,
      item.update_by || '',
      item.created_at || now,
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
// Tiga mode, dibedakan lewat field `mode` di body:
//
// 1) mode: "row" (default kalau item_sku diisi)
//    Body: { id, item_sku, update_by, ...fields }
//    Update SATU baris spesifik (id + item_sku). Dipakai untuk kasus yang
//    benar-benar perlu menyentuh satu baris saja.
//
// 2) mode: "group-status"
//    Body: { id, update_by, has_processed }
//    Set has_processed yang SAMA untuk SEMUA baris dalam group (TRUE semua
//    atau FALSE semua). Dipakai oleh toggle status di tabel utama.
//
// 3) mode: "group-meta"
//    Body: { id, update_by, request_by?, request_number?, issue_number?,
//            type_reason?, reason?, assigned_to? }
//    Update field METADATA yang sama di semua baris group (request_by,
//    request_number, issue_number, type_reason, reason, assigned_to) TANPA
//    menyentuh item_sku / item_name / item_qty / item_hpj / has_processed
//    per baris. Dipakai ketika hanya field-field ini yang berubah, tanpa
//    perlu delete+recreate seluruh item.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, item_sku, update_by, mode, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const rows = await getSheetData('material_issue');
    const now = toJakartaTimestamp();

    const resolvedMode: string = mode || (item_sku ? 'row' : 'group-status');

    // ── Mode 1: update satu baris spesifik ──────────────────────────────────
    if (resolvedMode === 'row') {
      const idx = findRowIndex(rows, id, item_sku);
      if (idx === -1) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const updatedRow = buildRow(rows[idx], fields, update_by, now);
      await updateSheetRow('material_issue', idx + 2, updatedRow);
      return NextResponse.json({ success: true, updated: 1 });
    }

    // ── Mode 2 & 3 butuh seluruh baris dalam group ──────────────────────────
    const groupIndexes = findGroupIndexes(rows, id);
    if (groupIndexes.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Mode 2: toggle status untuk seluruh group ───────────────────────────
    if (resolvedMode === 'group-status') {
      if (fields.has_processed === undefined) {
        return NextResponse.json({ error: 'Missing has_processed' }, { status: 400 });
      }
      // Satu request batchUpdate untuk semua baris dalam group, bukan banyak
      // request paralel — supaya tidak kena rate limit Sheets API saat
      // group berisi banyak baris (puluhan item).
      const updates = groupIndexes.map((idx) => ({
        rowIndex: idx + 2,
        data: buildRow(rows[idx], { has_processed: fields.has_processed }, update_by, now),
      }));
      await updateMultipleSheetRows('material_issue', updates);
      return NextResponse.json({ success: true, updated: groupIndexes.length });
    }

    // ── Mode 3: update metadata group (tidak menyentuh data per-item) ──────
    if (resolvedMode === 'group-meta') {
      const metaFields = {
        request_by: fields.request_by,
        request_number: fields.request_number,
        issue_number: fields.issue_number,
        type_reason: fields.type_reason,
        reason: fields.reason,
        assigned_to: fields.assigned_to,
      };
      const updates = groupIndexes.map((idx) => ({
        rowIndex: idx + 2,
        data: buildRow(rows[idx], metaFields, update_by, now),
      }));
      await updateMultipleSheetRows('material_issue', updates);
      return NextResponse.json({ success: true, updated: groupIndexes.length });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (error) {
    console.error('PUT material_issue error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Dua mode:
// 1) DELETE ?id=xxx&sku=yyy   → hapus SATU baris spesifik (id + item_sku).
// 2) DELETE ?id=xxx           → hapus SEMUA baris dalam group itu (clear whole
//    group). Mode ini dipakai saat proses edit / delete group, supaya tidak
//    perlu loop per item dari sisi client dan tidak bergantung pada SKU lama
//    yang mungkin sudah stale di state browser.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sku = searchParams.get('sku');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('material_issue');
    const emptyRow = Array(18).fill('');

    if (sku) {
      const idx = findRowIndex(rows, id, sku);
      if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await updateSheetRow('material_issue', idx + 2, emptyRow);
      return NextResponse.json({ success: true, deleted: 1 });
    }

    const groupIndexes = findGroupIndexes(rows, id);
    if (groupIndexes.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await updateMultipleSheetRows(
      'material_issue',
      groupIndexes.map((idx) => ({ rowIndex: idx + 2, data: emptyRow }))
    );

    return NextResponse.json({ success: true, deleted: groupIndexes.length });
  } catch (error) {
    console.error('DELETE material_issue error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}