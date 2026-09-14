import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { sql, ensureJastiperSchema } from "@/lib/neon";
import { normalizePhone, generateJastiperCode } from "@/lib/jastiper";

interface JastiperCsvRow {
  [key: string]: string;
}

export async function POST(request: NextRequest) {
  try {
    await ensureJastiperSchema();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const created_by = (formData.get("created_by") as string) || "";
    if (!file) {
      return NextResponse.json({ error: "File wajib diupload" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<JastiperCsvRow>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      const fatal = parsed.errors.filter((e) => e.type !== "FieldMismatch");
      if (fatal.length > 0) {
        return NextResponse.json({ error: "Gagal parse CSV: " + fatal[0].message }, { status: 400 });
      }
    }

    const rows = parsed.data
      .map((row) => {
        const jastiper_name = (row["jastiper_name"] || "").trim();
        const jastiper_store = (row["jastiper_store"] || "").trim();
        if (!jastiper_name || !jastiper_store) return null;
        const jastiper_phone_number = (row["jastiper_phone_number"] || "").trim();
        const jastiper_phone_normalized = normalizePhone(jastiper_phone_number);
        const jastiper_respond = (row["jastiper_respond"] || "").trim();
        const jastiper_code =
          (row["jastiper_code"] || "").trim() || generateJastiperCode(jastiper_store, jastiper_phone_number);
        const jastiper_status = (row["jastiper_status"] || "Active").trim();
        return {
          jastiper_name,
          jastiper_phone_number,
          jastiper_phone_normalized,
          jastiper_respond,
          jastiper_store,
          jastiper_code,
          jastiper_status,
          created_by: (row["created_by"] || created_by || "import").trim(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris valid di file ini" }, { status: 400 });
    }

    // Baris dengan HP sama di toko yang sama (partial unique index) dilewati
    // (DO NOTHING) supaya CSV yang sama bisa aman di-import ulang tanpa
    // duplikasi; baris tanpa HP selalu masuk (tidak ikut constraint itu).
    const result = await sql`
      INSERT INTO jastiper_master (
        jastiper_name, jastiper_phone_number, jastiper_phone_normalized,
        jastiper_respond, jastiper_store, jastiper_code, jastiper_status,
        created_by, update_by
      )
      SELECT
        t.jastiper_name, t.jastiper_phone_number, t.jastiper_phone_normalized,
        t.jastiper_respond, t.jastiper_store, t.jastiper_code, t.jastiper_status,
        t.created_by, t.created_by
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(
        jastiper_name TEXT, jastiper_phone_number TEXT, jastiper_phone_normalized TEXT,
        jastiper_respond TEXT, jastiper_store TEXT, jastiper_code TEXT, jastiper_status TEXT,
        created_by TEXT
      )
      ON CONFLICT (jastiper_store, jastiper_phone_normalized) WHERE jastiper_phone_normalized <> ''
      DO NOTHING
      RETURNING uuid
    `;

    return NextResponse.json({
      success: true,
      total_rows_in_file: parsed.data.length,
      inserted: result.length,
      skipped: rows.length - result.length,
    });
  } catch (error) {
    console.error("Error importing Jastiper CSV:", error);
    return NextResponse.json({ error: "Gagal import data" }, { status: 500 });
  }
}
