import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { sql, ensureJastiperSchema } from "@/lib/neon";
import { normalizePhone, generateJastiperCode, resolveCodeCollision, toTitleCase } from "@/lib/jastiper";

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

    const parsedRows = parsed.data
      .map((row) => {
        const jastiper_name = toTitleCase((row["jastiper_name"] || "").trim());
        const jastiper_store = (row["jastiper_store"] || "").trim();
        if (!jastiper_name || !jastiper_store) return null;
        const rawPhone = (row["jastiper_phone_number"] || "").trim();
        // Simpan dalam format "+62..." yang konsisten dengan shopify_orders.phone,
        // bukan format mentah apa adanya dari CSV.
        const jastiper_phone_number = normalizePhone(rawPhone);
        const jastiper_respond = toTitleCase((row["jastiper_respond"] || "").trim());
        const baseCode = (row["jastiper_code"] || "").trim() || generateJastiperCode(jastiper_store, rawPhone);
        const jastiper_status = (row["jastiper_status"] || "Active").trim();
        return {
          jastiper_name,
          jastiper_phone_number,
          jastiper_respond,
          jastiper_store,
          baseCode,
          jastiper_status,
          created_by: (row["created_by"] || created_by || "import").trim(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris valid di file ini" }, { status: 400 });
    }

    // Resolve tabrakan jastiper_code (2 jastiper di toko yang sama nomor
    // HP-nya berakhiran sama) baik terhadap data yang sudah ada di DB maupun
    // antar baris dalam file yang sama — supaya semua baris tetap bisa masuk.
    const storesInFile = [...new Set(parsedRows.map((r) => r.jastiper_store))];
    const existingRows = storesInFile.length
      ? await sql`SELECT jastiper_store, jastiper_code FROM jastiper_master WHERE jastiper_store = ANY(${storesInFile}) AND jastiper_code <> ''`
      : [];
    const codesByStore = new Map<string, Set<string>>();
    for (const r of existingRows as any[]) {
      if (!codesByStore.has(r.jastiper_store)) codesByStore.set(r.jastiper_store, new Set());
      codesByStore.get(r.jastiper_store)!.add(r.jastiper_code);
    }

    const rows = parsedRows.map(({ baseCode, ...rest }) => {
      let jastiper_code = baseCode;
      if (baseCode) {
        if (!codesByStore.has(rest.jastiper_store)) codesByStore.set(rest.jastiper_store, new Set());
        const set = codesByStore.get(rest.jastiper_store)!;
        jastiper_code = resolveCodeCollision(baseCode, set);
        set.add(jastiper_code);
      }
      return { ...rest, jastiper_phone_normalized: rest.jastiper_phone_number, jastiper_code };
    });

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
