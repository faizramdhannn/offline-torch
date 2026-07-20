import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';
import { getEmployeeDiscountTaft } from '@/app/api/employee-discount/lib/taft';
import { jakartaDateKeyFromCreatedAt, todayJakartaKey, parseCreatedAtForSort } from '@/lib/dailyJobDate';

// ─────────────────────────────────────────────────────────────────────────────
// daily_checklist — SATU baris per taft PER HARI (Asia/Jakarta), mirip pola
// attendance. Sheet tidak punya kolom `date` eksplisit — "hari ini" diturunkan
// dari `created_at` (format id-ID locale, contoh: "24 Jul 2026, 14.54.19").
//
// Kolom (A-I, 9 kolom, urutan HARUS persis seperti ini):
//   id, created_at, update_at, taft_by, role_taft, name,
//   checklist_opening, checklist_operational, checklist_closing
//
// checklist_opening/checklist_operational/checklist_closing masing-masing
// berisi STRING dipisah koma dari nama-nama item yang SUDAH dicentang, mis.
// "Cleaning Store,VM Report,WhatsApp Group" — BUKAN kolom boolean per item.
// Daftar item per kategori itu sendiri dinamis, datang dari master_dropdown
// (kolom checklist_opening/checklist_operational/checklist_closing, lihat
// app/api/daily-job/lib/dropdown.ts) — supaya user bisa tambah/hapus item
// checklist kapan saja tanpa perlu ubah skema sheet/kode. "n selesai dari m"
// dihitung di frontend: m = jumlah item di master_dropdown SAAT INI, n =
// irisan antara item tersimpan di baris ini dengan daftar item saat ini
// (item yang sudah dihapus dari master_dropdown otomatis tidak ikut dihitung
// lagi, walau masih tersimpan sebagai teks lama di baris historis).
//
// Fitur delivery-note/sales-order/stock-entry report (sheet & menu terpisah)
// sudah DIHAPUS — checklist ini sekarang satu-satunya isi menu Daily Job.
//
// Kontrak untuk frontend (dipakai juga oleh hooks/useAttendanceGate.ts /
// hooks/useDailyChecklistGate.ts):
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

function generateId(): string {
  return `DC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

const CHECKLIST_FIELDS = [
  'checklist_opening',
  'checklist_operational',
  'checklist_closing',
] as const;

function buildRow(existing: any, fields: any, now: string): any[] {
  return [
    existing.id,
    existing.created_at,
    now,
    fields.taft_by ?? existing.taft_by,
    fields.role_taft ?? existing.role_taft ?? '',
    fields.name ?? existing.name,
    ...CHECKLIST_FIELDS.map((f) => fields[f] ?? existing[f] ?? ''),
  ];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = (searchParams.get('userName') || '').trim();
    const name = (searchParams.get('name') || '').trim();
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

    // "taft_by" adalah nama taft yang DIPILIH dari dropdown (konsep sama
    // seperti request_discount/Employee Discount), BUKAN identitas login
    // persis — jadi tidak bisa exact-match ke userName. Checklist ini
    // logically "per TOKO per hari" (siapa pun taft di toko itu yang mengisi
    // dianggap tugas toko selesai).
    //
    // Dua jalur pencocokan, digabung (OR) supaya lebih tahan terhadap
    // kegagalan salah satu:
    //  1. `name` (kolom `name`, selalu = user.name, sama persis konsisten
    //     seperti fitur lain di app ini) — paling andal, tidak tergantung
    //     resolusi toko lain berhasil atau tidak.
    //  2. taft_by ada di daftar taft valid untuk toko user (resolusi sama
    //     seperti Employee Discount, berdasarkan master_traffic) — fallback
    //     kalau `name` tidak dikirim oleh caller lama.
    let validNames = new Set<string>();
    try {
      const { taftsForStore } = await getEmployeeDiscountTaft(userName);
      validNames = new Set((taftsForStore || []).map((t: string) => t.toLowerCase().trim()));
    } catch {
      // ignore — fall through to name-based / exact-match matching below
    }

    const nameKey = name.toLowerCase().trim();
    const mine = rows.filter((r: any) => {
      if (nameKey && (r.name || '').toLowerCase().trim() === nameKey) return true;
      if (validNames.size > 0 && validNames.has((r.taft_by || '').toLowerCase().trim())) return true;
      if (validNames.size === 0 && !nameKey && (r.taft_by || '').toLowerCase().trim() === userName.toLowerCase().trim()) return true;
      return false;
    });

    // ?all=true — seluruh riwayat checklist taft ini (bukan hanya hari ini).
    if (all) {
      const sorted = [...mine].sort((a: any, b: any) => parseCreatedAtForSort(b.created_at) - parseCreatedAtForSort(a.created_at));
      return NextResponse.json(sorted);
    }

    // Default — cari baris "hari ini" (Asia/Jakarta) untuk taft ini.
    // Kontrak: null kalau belum ada, object row kalau sudah ada. Dipakai oleh
    // gate absensi (useAttendanceGate) untuk cek apakah checklist hari ini
    // sudah diisi.
    const todayKey = todayJakartaKey();
    const todayRow = mine.find((r: any) => jakartaDateKeyFromCreatedAt(r.created_at) === todayKey);

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
      ...CHECKLIST_FIELDS.map((f) => body[f] || ''),
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
