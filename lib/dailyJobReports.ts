import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';
import { uploadDailyJobErrorPhoto, DailyJobReportType } from '@/lib/dailyJobDrive';
import { getEmployeeDiscountTaft } from '@/app/api/employee-discount/lib/taft';

// ─────────────────────────────────────────────────────────────────────────────
// Factory bersama untuk 3 route CRUD yang identik strukturnya:
//   app/api/daily-job/delivery-note/route.ts  → sheet delivery_note_report
//   app/api/daily-job/sales-order/route.ts    → sheet sales_order_report
//   app/api/daily-job/stock-entry/route.ts    → sheet stock_entry_report
//
// Semua 3 sheet punya bentuk 12 kolom yang SAMA persis, cuma beda suffix nama
// kolom (mis. error_category_delivery_note vs error_category_sales_order),
// jadi field mapping di-parametrize lewat `errorField`/`categoryField`/dst.
//
// Kolom (A-L, urutan HARUS persis):
//   id, created_at, update_at, taft_by, role_taft, name,
//   <errorField>, <categoryField>, <notesField>,
//   <imageUrlField>, <solvedField>, solved_at
//
// Kontrak field:
//  - <errorField>      : FREE TEXT (mis. nomor sales order terkait error ini,
//                         BUKAN boolean walau namanya mirip "error_sales_order").
//  - <categoryField>    : dropdown (dari master_dropdown, lihat lib/dropdown.ts).
//  - <notesField>       : free text.
//  - <imageUrlField>    : link foto Google Drive, OPTIONAL saat create, bisa
//                         diisi belakangan lewat PUT (dengan/atau tanpa foto baru).
//  - <solvedField>      : dropdown status/aksi penyelesaian, OPTIONAL saat create.
//  - solved_at          : datetime string, OPTIONAL saat create. Frontend akan
//                         punya tombol "Now" yang isi field ini dgn timestamp
//                         Jakarta client-side. Sebagai convenience tambahan,
//                         route ini JUGA menerima literal string 'NOW' dan akan
//                         menggantinya dengan toJakartaTimestamp() di server —
//                         dua-duanya didukung, dipilih oleh frontend.
//
// Multipart: POST/PUT menerima 'multipart/form-data' kalau ada file foto
// (field 'file'), sama pola dengan app/api/request-tracking/route.ts PUT
// handler. Kalau content-type bukan multipart, dibaca sebagai JSON biasa.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportFieldMap {
  sheetName: 'delivery_note_report' | 'sales_order_report' | 'stock_entry_report';
  reportType: DailyJobReportType;
  errorField: string;     // e.g. 'error_sales_order_delivery_note' | 'error_sales_order' | 'error_stock_entry'
  categoryField: string;  // e.g. 'error_category_delivery_note'
  notesField: string;     // e.g. 'error_notes_delivery_note'
  imageUrlField: string;  // e.g. 'error_image_url_delivery_note'
  solvedField: string;    // e.g. 'error_solved_delivery_note'
}

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

function parseCreatedAt(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(',', '').replace(/\./g, ':');
  const t = new Date(cleaned).getTime();
  return isNaN(t) ? 0 : t;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// Resolve solved_at: literal 'NOW' -> timestamp Jakarta saat ini di server;
// string lain (termasuk sudah-berisi timestamp dari client) dipakai apa adanya;
// undefined/'' -> fallback ke existing (saat update) atau '' (saat create).
function resolveSolvedAt(value: string | undefined, existing?: string): string {
  if (value === 'NOW') return toJakartaTimestamp();
  if (value !== undefined) return value;
  return existing ?? '';
}

export function makeDailyJobReportRoutes(map: ReportFieldMap) {
  const { sheetName, reportType, errorField, categoryField, notesField, imageUrlField, solvedField } = map;
  const idPrefix = sheetName === 'delivery_note_report' ? 'DNR' : sheetName === 'sales_order_report' ? 'SOR' : 'SER';

  function buildRow(existing: any, fields: any, now: string): any[] {
    return [
      existing.id,
      existing.created_at,
      now,
      fields.taft_by ?? existing.taft_by,
      fields.role_taft ?? existing.role_taft ?? '',
      fields.name ?? existing.name,
      fields[errorField] ?? existing[errorField] ?? '',
      fields[categoryField] ?? existing[categoryField] ?? '',
      fields[notesField] ?? existing[notesField] ?? '',
      fields[imageUrlField] ?? existing[imageUrlField] ?? '',
      fields[solvedField] ?? existing[solvedField] ?? '',
      resolveSolvedAt(fields.solved_at, existing.solved_at),
    ];
  }

  async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const userName = (searchParams.get('userName') || '').trim();
      const name = (searchParams.get('name') || '').trim();
      const all = searchParams.get('all') === 'true';

      const rows = await getSheetData(sheetName);

      // "taft_by" adalah nama taft yang DIPILIH dari dropdown (konsep sama
      // seperti request_discount), bukan identitas login persis — jadi tidak
      // bisa exact-match ke userName. Dua jalur pencocokan digabung (OR),
      // sama seperti app/api/daily-job/checklist/route.ts:
      //  1. `name` (kolom `name`, selalu = user.name) — paling andal.
      //  2. taft_by ada di daftar taft valid untuk toko user (resolusi
      //     berdasarkan master_traffic, sama seperti Employee Discount).
      let filtered: any[];
      if (all || (!userName && !name)) {
        filtered = rows;
      } else {
        let validNames = new Set<string>();
        try {
          const { taftsForStore } = await getEmployeeDiscountTaft(userName);
          validNames = new Set((taftsForStore || []).map((t: string) => t.toLowerCase().trim()));
        } catch {
          // ignore — fall through to name-based / exact-match matching below
        }
        filtered = rows.filter((r: any) => {
          if (name && r.name === name) return true;
          if (validNames.size > 0 && validNames.has((r.taft_by || '').toLowerCase().trim())) return true;
          if (validNames.size === 0 && !name && r.taft_by === userName) return true;
          return false;
        });
      }

      const sorted = [...filtered].sort((a: any, b: any) => parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at));
      return NextResponse.json(sorted);
    } catch (error) {
      console.error(`GET ${sheetName} error:`, error);
      return NextResponse.json({ error: `Failed to fetch ${sheetName}` }, { status: 500 });
    }
  }

  async function POST(request: NextRequest) {
    try {
      const contentType = request.headers.get('content-type') || '';
      let fields: any = {};
      let file: File | null = null;

      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          if (key !== 'file') fields[key] = value as string;
        });
        file = formData.get('file') as File | null;
      } else {
        fields = await request.json();
      }

      const now = toJakartaTimestamp();
      const id = fields.id || generateId(idPrefix);

      let imageUrl = fields[imageUrlField] || '';
      if (file && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        const fileName = `${sheetName}_${id}_${Date.now()}`;
        imageUrl = await uploadDailyJobErrorPhoto(buf, fileName, file.type, reportType, fields.name || fields.taft_by || 'unknown');
      }

      const row = [
        id,
        now,
        now,
        fields.taft_by || '',
        fields.role_taft || '',
        fields.name || '',
        fields[errorField] || '',
        fields[categoryField] || '',
        fields[notesField] || '',
        imageUrl,
        fields[solvedField] || '',
        resolveSolvedAt(fields.solved_at),
      ];

      await appendSheetData(sheetName, [row]);
      return NextResponse.json({ success: true, id });
    } catch (error) {
      console.error(`POST ${sheetName} error:`, error);
      return NextResponse.json({ error: `Failed to create ${sheetName}` }, { status: 500 });
    }
  }

  async function PUT(request: NextRequest) {
    try {
      const contentType = request.headers.get('content-type') || '';
      let fields: any = {};
      let file: File | null = null;

      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          if (key !== 'file') fields[key] = value as string;
        });
        file = formData.get('file') as File | null;
      } else {
        fields = await request.json();
      }

      const { id } = fields;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const rows = await getSheetData(sheetName, { skipCache: true });
      const idx = rows.findIndex((r: any) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const existing = rows[idx];
      const now = toJakartaTimestamp();

      if (file && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        const fileName = `${sheetName}_${id}_${Date.now()}`;
        fields[imageUrlField] = await uploadDailyJobErrorPhoto(
          buf, fileName, file.type, reportType, fields.name || existing.name || existing.taft_by || 'unknown'
        );
      }

      const newRow = buildRow(existing, fields, now);
      await updateSheetRow(sheetName, idx + 2, newRow);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`PUT ${sheetName} error:`, error);
      return NextResponse.json({ error: `Failed to update ${sheetName}` }, { status: 500 });
    }
  }

  async function DELETE(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const rows = await getSheetData(sheetName, { skipCache: true });
      const idx = rows.findIndex((r: any) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await deleteSheetRows(sheetName, [idx + 2]);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`DELETE ${sheetName} error:`, error);
      return NextResponse.json({ error: `Failed to delete ${sheetName}` }, { status: 500 });
    }
  }

  return { GET, POST, PUT, DELETE };
}
