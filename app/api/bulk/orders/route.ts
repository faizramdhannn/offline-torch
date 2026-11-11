import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, deleteSheetRows } from '@/lib/sheets';
import { sessionUser, isTrue } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { jsonWithEtag } from '@/lib/etag';
import { windowRows, wantsAll } from '@/lib/rowWindow';
import { parseIdDateTime } from '@/lib/idDate';
import { buildBulkRows, canSeeBulkRow, masterFromRows, toBulkRow, validateBulkInput } from '@/lib/bulkOrder';

export const dynamic = 'force-dynamic';

// Sheet raw_data (A–P): id, source_store, item_code, item_name, item_category, item_qty, item_price, customer_name,
// customer_institution, customer_phone_number, reason_buy, reason_not_buy, sales_order, note, created_at, created_by, update_at, update_by.
// Satu input = beberapa baris ber-id (uuid) sama. Store/Merchant: hanya data tokonya sendiri. Bulk All: semua + edit + hapus.

const SHEET = 'raw_data';

function jakartaNow(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

const idRowNumbers = (data: any[], id: string) =>
  data.map((r: any, i: number) => (String(r.id ?? '').trim() === id ? i + 2 : 0)).filter(Boolean); // +2 = header + indeks 1-based

export async function GET(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const all = isTrue(user.bulk_order_all);

    let rows = ((await getSheetData(SHEET)) as any[]).filter((r) => r.id).map(toBulkRow);
    if (!all) {
      // Akun toko: semua input untuk tokonya (termasuk yang diinput admin dengan memilih toko ini).
      rows = rows.filter((r) => canSeeBulkRow(r.source_store, user));
    }
    // Hemat CPU/transfer: 120 hari terakhir; ?all=1 = semua riwayat.
    rows = windowRows(rows, wantsAll(request), { dateOf: (r) => r.created_at });
    rows = rows
      .map((r, i) => ({ r, i, t: parseIdDateTime(r.created_at) }))
      .sort((a, b) => b.t - a.t || a.i - b.i)
      .map((x) => x.r);
    return jsonWithEtag(request, rows);
  } catch (error) {
    console.error('Bulk orders GET error:', error);
    return NextResponse.json({ error: 'Gagal memuat data Bulk' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const all = isTrue(user.bulk_order_all);
    const body = await request.json();

    // Toko sumber: akun toko dikunci ke tokonya sendiri; Bulk All boleh memilih.
    const source_store = all ? String(body.source_store || '').trim() : String(user.name || user.user_name || '').trim();
    const master = masterFromRows((await getSheetData('master_bulk')) as any[]);
    const v = validateBulkInput({ ...body, source_store }, master);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const id = crypto.randomUUID();
    await appendSheetData(SHEET, buildBulkRows(id, v.value, jakartaNow(), user.user_name));
    audit(request, 'POST', `Bulk order baru (${v.value.items.length} item) — ${v.value.customer_name}`, 'bulk', id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Bulk orders POST error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan data Bulk' }, { status: 500 });
  }
}

// Edit satu input (semua item ber-id sama) — hanya Bulk All. Baris baru ditambahkan DULU, baru baris lama dihapus
// (kalau penambahan gagal, data lama tetap utuh). created_at & created_by asli dipertahankan.
export async function PUT(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user || !isTrue(user.bulk_order_all)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

    const data = (await getSheetData(SHEET, { skipCache: true })) as any[];
    const oldRows = idRowNumbers(data, id);
    if (oldRows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    const first = data[oldRows[0] - 2];

    const master = masterFromRows((await getSheetData('master_bulk')) as any[]);
    const v = validateBulkInput(body, master);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const createdAt = String(first.created_at || '') || jakartaNow();
    const createdBy = String(first.created_by || '') || user.user_name;
    await appendSheetData(SHEET, buildBulkRows(id, v.value, createdAt, createdBy, jakartaNow(), user.user_name)); // update_at/update_by = saat diedit
    await deleteSheetRows(SHEET, oldRows);
    audit(request, 'PUT', `Bulk order diubah (${v.value.items.length} item) — ${v.value.customer_name}`, 'bulk', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bulk orders PUT error:', error);
    return NextResponse.json({ error: 'Gagal mengubah data Bulk' }, { status: 500 });
  }
}

// Hapus satu input (semua item ber-id sama) — hanya Bulk All.
export async function DELETE(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user || !isTrue(user.bulk_order_all)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    const id = (new URL(request.url).searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

    const data = (await getSheetData(SHEET, { skipCache: true })) as any[];
    const rows = idRowNumbers(data, id);
    if (rows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    await deleteSheetRows(SHEET, rows);
    audit(request, 'DELETE', `Bulk order dihapus (${rows.length} baris)`, 'bulk', id);
    return NextResponse.json({ success: true, deleted: rows.length });
  } catch (error) {
    console.error('Bulk orders DELETE error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data Bulk' }, { status: 500 });
  }
}
