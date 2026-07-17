import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';

// ─────────────────────────────────────────────────────────────────────────────
// daily_checklist — SATU baris per taft PER HARI (Asia/Jakarta), mirip pola
// attendance. Sheet tidak punya kolom `date` eksplisit — "hari ini" diturunkan
// dari `created_at` (format id-ID locale, contoh: "24 Jul 2026, 14.54.19").
//
// Kolom (A-X, 24 kolom, urutan HARUS persis seperti ini):
//   id, created_at, update_at, taft_by, role_taft, name,
//   cleaning_store_checklist, vm_report_checklist, whatsapp_group_checklis, delivery_note_checklist,
//   status_delivery_note, total_delivery_note, total_error_delivery_note, notes_delivery_note,
//   sales_order_checklist, status_sales_order, total_sales_order, total_error_sales_order, notes_sales_order,
//   stock_entry_checklist, status_stock_entry, total_stock_entry, total_error_stock_entry, stock_entry_notes
//
// NB: "whatsapp_group_checklis" dan "stock_entry_notes" (bukan
// "notes_stock_entry") adalah nama kolom ASLI di sheet — sengaja tidak
// diperbaiki typonya supaya tetap sinkron dengan header sheet.
//
// Kontrak untuk frontend (dipakai juga oleh hooks/useAttendanceGate.ts di
// pass berikutnya):
//   GET /api/daily-job/checklist?userName=xxx
//     → 200 dengan body `null` kalau taft ini BELUM isi checklist hari ini,
//       atau object row kalau SUDAH ada.
//   GET /api/daily-job/checklist?userName=xxx&all=true
//     → array semua riwayat checklist milik taft ini (bukan cuma hari ini).
//   GET /api/daily-job/checklist?scope=all
//     → array SEMUA baris dari SEMUA taft (dipakai oleh /api/daily-job/report
//       untuk agregasi lintas-taft, akses `daily_checklist_all`).
// ─────────────────────────────────────────────────────────────────────────────

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

// Sama pola normalisasi dengan app/api/notifications/route.ts parseCreatedAt:
// format "24 Jul 2026, 14.54.19" tidak bisa langsung di-parse `new Date()`
// (koma + titik sebagai pemisah jam bikin Invalid Date). Ganti koma & titik
// jam jadi format yang bisa di-parse.
function parseCreatedAt(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(',', '').replace(/\./g, ':');
  const t = new Date(cleaned).getTime();
  return isNaN(t) ? 0 : t;
}

// Ambil bagian tanggal (YYYY-MM-DD, berdasar Asia/Jakarta) dari timestamp
// created_at, untuk dibandingkan dengan "hari ini" di Asia/Jakarta.
function jakartaDateKey(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // 'en-CA' -> YYYY-MM-DD
}

function todayJakartaKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function generateId(): string {
  return `DC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function buildRow(existing: any, fields: any, now: string): any[] {
  return [
    existing.id,
    existing.created_at,
    now,
    fields.taft_by ?? existing.taft_by,
    fields.role_taft ?? existing.role_taft ?? '',
    fields.name ?? existing.name,
    fields.cleaning_store_checklist ?? existing.cleaning_store_checklist ?? 'FALSE',
    fields.vm_report_checklist ?? existing.vm_report_checklist ?? 'FALSE',
    fields.whatsapp_group_checklis ?? existing.whatsapp_group_checklis ?? 'FALSE',
    fields.delivery_note_checklist ?? existing.delivery_note_checklist ?? 'FALSE',
    fields.status_delivery_note ?? existing.status_delivery_note ?? '',
    fields.total_delivery_note ?? existing.total_delivery_note ?? '',
    fields.total_error_delivery_note ?? existing.total_error_delivery_note ?? '',
    fields.notes_delivery_note ?? existing.notes_delivery_note ?? '',
    fields.sales_order_checklist ?? existing.sales_order_checklist ?? 'FALSE',
    fields.status_sales_order ?? existing.status_sales_order ?? '',
    fields.total_sales_order ?? existing.total_sales_order ?? '',
    fields.total_error_sales_order ?? existing.total_error_sales_order ?? '',
    fields.notes_sales_order ?? existing.notes_sales_order ?? '',
    fields.stock_entry_checklist ?? existing.stock_entry_checklist ?? 'FALSE',
    fields.status_stock_entry ?? existing.status_stock_entry ?? '',
    fields.total_stock_entry ?? existing.total_stock_entry ?? '',
    fields.total_error_stock_entry ?? existing.total_error_stock_entry ?? '',
    fields.stock_entry_notes ?? existing.stock_entry_notes ?? '',
  ];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = (searchParams.get('userName') || '').trim();
    const all = searchParams.get('all') === 'true';
    const scope = searchParams.get('scope');

    const rows = await getSheetData('daily_checklist');

    // scope=all — semua taft, semua tanggal (dipakai oleh report/route.ts).
    if (scope === 'all') {
      return NextResponse.json(rows);
    }

    if (!userName) {
      return NextResponse.json({ error: 'Missing userName' }, { status: 400 });
    }

    const mine = rows.filter((r: any) => r.taft_by === userName);

    // ?all=true — seluruh riwayat checklist taft ini (bukan hanya hari ini).
    if (all) {
      const sorted = [...mine].sort((a: any, b: any) => parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at));
      return NextResponse.json(sorted);
    }

    // Default — cari baris "hari ini" (Asia/Jakarta) untuk taft ini.
    // Kontrak: null kalau belum ada, object row kalau sudah ada. Dipakai oleh
    // gate absensi (useAttendanceGate) untuk cek apakah checklist hari ini
    // sudah diisi.
    const todayKey = todayJakartaKey();
    const todayRow = mine.find((r: any) => jakartaDateKey(parseCreatedAt(r.created_at)) === todayKey);

    return NextResponse.json(todayRow || null);
  } catch (error) {
    console.error('GET daily_checklist error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily checklist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = toJakartaTimestamp();
    const id = body.id || generateId();

    const row = [
      id,
      now,
      now,
      body.taft_by || '',
      body.role_taft || '',
      body.name || '',
      body.cleaning_store_checklist || 'FALSE',
      body.vm_report_checklist || 'FALSE',
      body.whatsapp_group_checklis || 'FALSE',
      body.delivery_note_checklist || 'FALSE',
      body.status_delivery_note || '',
      body.total_delivery_note ?? '',
      body.total_error_delivery_note ?? '0',
      body.notes_delivery_note || '',
      body.sales_order_checklist || 'FALSE',
      body.status_sales_order || '',
      body.total_sales_order ?? '',
      body.total_error_sales_order ?? '0',
      body.notes_sales_order || '',
      body.stock_entry_checklist || 'FALSE',
      body.status_stock_entry || '',
      body.total_stock_entry ?? '',
      body.total_error_stock_entry ?? '0',
      body.stock_entry_notes || '',
    ];

    await appendSheetData('daily_checklist', [row]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST daily_checklist error:', error);
    return NextResponse.json({ error: 'Failed to create daily checklist' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('daily_checklist', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = toJakartaTimestamp();
    const newRow = buildRow(rows[idx], fields, now);
    await updateSheetRow('daily_checklist', idx + 2, newRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT daily_checklist error:', error);
    return NextResponse.json({ error: 'Failed to update daily checklist' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('daily_checklist', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteSheetRows('daily_checklist', [idx + 2]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE daily_checklist error:', error);
    return NextResponse.json({ error: 'Failed to delete daily checklist' }, { status: 500 });
  }
}
