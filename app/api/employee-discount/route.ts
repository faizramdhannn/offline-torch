import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, updateMultipleSheetRows, deleteSheetRows } from '@/lib/sheets';
import { getEmployeeDiscountDropdown } from './lib/dropdown';
import { getEmployeeDiscountTaft } from './lib/taft';

// Fitur Employee Discount: SATU "group" (id sama) bisa berisi BANYAK item
// (item_sku/item_name/item_qty berbeda per baris), sama seperti pola Material
// Issue. Field lain (assigned_to, taft_by, discount_code, status_request,
// type_reason, sales_order, dll) adalah metadata group yang diduplikasi di
// setiap baris dalam group yang sama.

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

function findGroupIndexes(rows: any[], id: string): number[] {
  return rows
    .map((r: any, i: number) => (r.id === id ? i : -1))
    .filter((i: number) => i !== -1);
}

function buildRow(existing: any, fields: any, update_by: string | undefined, now: string): any[] {
  return [
    existing.id,
    fields.name ?? existing.name,
    fields.assigned_to ?? existing.assigned_to ?? '',
    fields.user_name ?? existing.user_name,
    fields.taft_by ?? existing.taft_by ?? '',
    fields.item_sku ?? existing.item_sku,
    fields.item_name ?? existing.item_name,
    fields.item_qty ?? existing.item_qty,
    fields.discount_code ?? existing.discount_code ?? '',
    fields.status_request ?? existing.status_request ?? 'Need Approval',
    fields.type_reason ?? existing.type_reason ?? '',
    fields.sales_order ?? existing.sales_order ?? '',
    existing.created_by,
    update_by ?? existing.update_by ?? '',
    existing.created_at,
    now,
  ];
}

// ── GET ───────────────────────────────────────────────────────────────────────
// Satu endpoint untuk semua kebutuhan GET fitur ini, dibedakan lewat
// `?resource=`:
//  - (default / tidak diisi) → daftar request_discount (data utama)
//  - `resource=dropdown`     → { discount_code, assigned_to } untuk form
//  - `resource=taft`         → { userStore, taftsForStore } untuk field taft_by
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    if (resource === 'dropdown') {
      try {
        const data = await getEmployeeDiscountDropdown();
        return NextResponse.json(data);
      } catch (error) {
        console.error('GET employee-discount?resource=dropdown error:', error);
        return NextResponse.json({ discount_code: [], assigned_to: [] }, { status: 500 });
      }
    }

    if (resource === 'taft') {
      try {
        const userName = searchParams.get('userName') || '';
        const data = await getEmployeeDiscountTaft(userName);
        return NextResponse.json(data);
      } catch (error) {
        console.error('GET employee-discount?resource=taft error:', error);
        return NextResponse.json({ userStore: null, taftsForStore: [] }, { status: 500 });
      }
    }

    const userName = searchParams.get('userName') || '';
    const isAll = searchParams.get('isAll') === 'true';

    const rows = await getSheetData('request_discount');

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
    console.error('GET request_discount error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Body: satu item atau array item, semua item dengan `id` yang sama akan
// membentuk satu "group" (satu request dengan banyak item), persis seperti
// Material Issue.
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
      item.taft_by || '',
      item.item_sku,
      item.item_name,
      item.item_qty,
      item.discount_code || '',
      item.status_request || 'Need Approval',
      item.type_reason || '',
      item.sales_order || '',
      item.created_by,
      item.update_by || '',
      item.created_at || now,
      now,
    ]);

    await appendSheetData('request_discount', rows);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST request_discount error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
// Tiga mode, dibedakan lewat field `mode` di body:
//
// 1) mode: "group-meta"
//    Body: { id, update_by, mode: 'group-meta', assigned_to?, taft_by?,
//            discount_code?, type_reason?, sales_order? }
//    Update field metadata yang sama di semua baris group, TANPA menyentuh
//    item_sku/item_name/item_qty maupun status_request.
//
// 2) mode: "group-items"
//    Body: { id, update_by, mode: 'group-items',
//            items: [{ item_sku, item_name, item_qty }], ...metaFields }
//    Update susunan item dalam group (tambah/kurang/ganti SKU) IN-PLACE —
//    baris yang masih kepakai ditulis ulang di posisi yang sama (created_at
//    dipertahankan), kelebihan slot lama dihapus beneran, item baru yang
//    lebih banyak di-append di akhir sheet.
//
// 3) mode: "approve"
//    Body: { id, update_by, mode: 'approve', status_request: 'Approved'|'Rejected' }
//    Set status_request yang sama untuk SEMUA baris dalam group.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, update_by, mode, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const rows = await getSheetData('request_discount', { skipCache: true });
    const now = toJakartaTimestamp();

    const groupIndexes = findGroupIndexes(rows, id);
    if (groupIndexes.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Mode: approve/reject — set status_request untuk seluruh group ──────
    if (mode === 'approve') {
      if (!fields.status_request || !['Approved', 'Rejected'].includes(fields.status_request)) {
        return NextResponse.json({ error: 'Invalid status_request' }, { status: 400 });
      }
      const updates = groupIndexes.map((idx) => ({
        rowIndex: idx + 2,
        data: buildRow(rows[idx], { status_request: fields.status_request }, update_by, now),
      }));
      await updateMultipleSheetRows('request_discount', updates);
      return NextResponse.json({ success: true, updated: groupIndexes.length });
    }

    // ── Mode: update metadata group (tidak menyentuh item per-baris) ───────
    if (mode === 'group-meta') {
      const metaFields = {
        assigned_to: fields.assigned_to,
        taft_by: fields.taft_by,
        discount_code: fields.discount_code,
        type_reason: fields.type_reason,
        sales_order: fields.sales_order,
      };
      const updates = groupIndexes.map((idx) => ({
        rowIndex: idx + 2,
        data: buildRow(rows[idx], metaFields, update_by, now),
      }));
      await updateMultipleSheetRows('request_discount', updates);
      return NextResponse.json({ success: true, updated: groupIndexes.length });
    }

    // ── Mode: replace seluruh item dalam group, in-place ────────────────────
    if (mode === 'group-items') {
      const items: any[] = Array.isArray(fields.items) ? fields.items : [];
      if (items.length === 0) {
        return NextResponse.json({ error: 'Missing items' }, { status: 400 });
      }

      const metaFields = {
        assigned_to: fields.assigned_to,
        taft_by: fields.taft_by,
        discount_code: fields.discount_code,
        type_reason: fields.type_reason,
        sales_order: fields.sales_order,
      };

      const existingRows = groupIndexes.map((idx) => ({ idx, row: rows[idx] }));

      const updates: { rowIndex: number; data: any[] }[] = [];
      const toAppend: any[][] = [];
      const reused = Math.min(existingRows.length, items.length);

      for (let i = 0; i < reused; i++) {
        const { idx, row: existingRow } = existingRows[i];
        const itemFields = { ...metaFields, ...items[i] };
        updates.push({
          rowIndex: idx + 2,
          data: buildRow(existingRow, itemFields, update_by, now),
        });
      }

      if (items.length > existingRows.length) {
        const base = existingRows[0]?.row ?? {};
        for (let i = existingRows.length; i < items.length; i++) {
          const itemFields = { ...metaFields, ...items[i] };
          const newRow = buildRow(
            { ...base, id, created_at: now, created_by: base.created_by ?? update_by },
            itemFields,
            update_by,
            now
          );
          toAppend.push(newRow);
        }
      } else if (existingRows.length > items.length) {
        const toDelete = existingRows.slice(reused).map(({ idx }) => idx + 2);
        await deleteSheetRows('request_discount', toDelete);
      }

      if (updates.length > 0) {
        await updateMultipleSheetRows('request_discount', updates);
      }
      if (toAppend.length > 0) {
        await appendSheetData('request_discount', toAppend);
      }

      return NextResponse.json({
        success: true,
        updated: updates.length,
        appended: toAppend.length,
        deleted: Math.max(0, existingRows.length - items.length),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (error) {
    console.error('PUT request_discount error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// DELETE ?id=xxx → hapus SEMUA baris dalam group itu (satu request = satu id,
// bisa berisi banyak item/baris).
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('request_discount', { skipCache: true });
    const groupIndexes = findGroupIndexes(rows, id);
    if (groupIndexes.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteSheetRows('request_discount', groupIndexes.map((idx) => idx + 2));
    return NextResponse.json({ success: true, deleted: groupIndexes.length });
  } catch (error) {
    console.error('DELETE request_discount error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
