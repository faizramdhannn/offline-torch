import { getUsersData } from "@/lib/users";
import { NextRequest, NextResponse } from "next/server";
import { sql, ensureCustomerSchema, ensureJastiperSchema, ensureAnnouncementSchema } from "@/lib/neon";
import { getSheetData } from "@/lib/sheets";

// ─────────────────────────────────────────────────────────────────────────────
// Export tabel-tabel Neon Postgres (data yang TIDAK ada di Google Sheets)
// sebagai CSV, supaya bisa ditarik langsung ke Google Sheets pakai
// =IMPORTDATA("https://.../api/admin/db-export?table=xxx&username=yyy") —
// makanya responsnya CSV, bukan JSON, dan otentikasinya lewat query param
// (IMPORTDATA tidak bisa kirim header/cookie custom), sama seperti pola
// soft-auth yang sudah dipakai di endpoint lain aplikasi ini.
//
// Akses dibatasi: username yang dikirim HARUS punya registration_request DAN
// user_setting = TRUE di sheet users.
//
// shopify_orders SENGAJA TIDAK dimasukkan ke daftar tabel di sini — datanya
// besar (90rb+ baris) dan sudah punya export khusus (dengan filter tanggal)
// di /api/customer/export. logo_url di customer_badges juga dibuang dari
// export karena isinya bisa berupa base64 data-url yang sangat panjang.
// ─────────────────────────────────────────────────────────────────────────────

interface TableConfig {
  label: string;
  ensureSchema: () => Promise<void>;
  query: () => Promise<Record<string, unknown>[]>;
}

const TABLES: Record<string, TableConfig> = {
  jastiper_master: {
    label: "Jastiper (Master)",
    ensureSchema: ensureJastiperSchema,
    query: () =>
      sql`
        SELECT
          jastiper_name, jastiper_phone_number, jastiper_store, jastiper_code,
          jastiper_status, jastiper_respond, social_media, social_media_username,
          notes, created_at, update_at, date_exist::text AS date_exist
        FROM jastiper_master
        ORDER BY jastiper_store ASC, jastiper_name ASC
      ` as Promise<Record<string, unknown>[]>,
  },
  customer_crm: {
    label: "Customer CRM (Follow-up)",
    ensureSchema: ensureCustomerSchema,
    query: () =>
      sql`
        SELECT store_name, phone_number, followup, result, ket, link_url, update_by, update_at
        FROM customer_crm
        ORDER BY update_at DESC NULLS LAST
      ` as Promise<Record<string, unknown>[]>,
  },
  customer_badges: {
    label: "Customer Badges",
    ensureSchema: ensureCustomerSchema,
    query: async () => {
      const rows = (await sql`
        SELECT label, sku_list
        FROM customer_badges
        WHERE badge_type = 'collection'
        ORDER BY sort_order ASC
      `) as { label: string; sku_list: string[] }[];
      // 1 baris per SKU (label diulang) — newline-dalam-sel sebelumnya
      // berantakan di IMPORTDATA (tiap newline malah jadi baris sheet baru
      // dengan kolom label kosong), jadi di-flatten literal di sini supaya
      // hasilnya predictable: tiap baris = 1 pasangan label+sku.
      const flat: { label: string; sku: string }[] = [];
      for (const r of rows) {
        const skus = Array.isArray(r.sku_list) ? r.sku_list : [];
        for (const sku of skus) flat.push({ label: r.label, sku });
      }
      return flat;
    },
  },
  customer_wa_followups: {
    label: "Customer WA Follow-up (Log)",
    ensureSchema: ensureCustomerSchema,
    query: () =>
      sql`
        SELECT id, phone_number, store_name, analysis, message, created_by, created_at, sent_at
        FROM customer_wa_followups
        ORDER BY created_at DESC
      ` as Promise<Record<string, unknown>[]>,
  },
  app_announcement: {
    label: "Announcement Bar",
    ensureSchema: ensureAnnouncementSchema,
    query: () =>
      sql`
        SELECT message, active, image_url, link_text, update_by, update_at
        FROM app_announcement
      ` as Promise<Record<string, unknown>[]>,
  },
};

export const TABLE_LIST = Object.entries(TABLES).map(([key, t]) => ({ key, label: t.label }));

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    // ?list=1 → daftar tabel yang tersedia (JSON, tanpa data/auth) — dipakai
    // frontend Settings untuk merender daftar link, bukan untuk tarik data.
    if (request.nextUrl.searchParams.get("list") === "1") {
      return NextResponse.json({ tables: TABLE_LIST });
    }

    const username = request.nextUrl.searchParams.get("username") || "";
    const table = request.nextUrl.searchParams.get("table") || "";

    if (!username) return new NextResponse("username wajib diisi", { status: 400 });
    const config = TABLES[table];
    if (!config) {
      return new NextResponse(
        `table tidak dikenal. Pilihan: ${Object.keys(TABLES).join(", ")}`,
        { status: 400 }
      );
    }

    const users = await getUsersData();
    const user = (users as any[]).find((u) => u.user_name === username);
    const hasAccess = !!user && user.registration_request === "TRUE" && user.user_setting === "TRUE";
    if (!hasAccess) {
      return new NextResponse("Akses ditolak: butuh permission registration_request dan user_setting", { status: 403 });
    }

    await config.ensureSchema();
    const rows = await config.query();

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error exporting DB table:", error);
    return new NextResponse("Failed to export table", { status: 500 });
  }
}
