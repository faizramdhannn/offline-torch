import { NextRequest, NextResponse } from "next/server";
import { sql, ensureJastiperSchema } from "@/lib/neon";
import { normalizePhone, generateJastiperCode } from "@/lib/jastiper";

// Sama persis dengan STORE_LIST/EXTRA_STORE_ACCESS/findMatchingStore di
// app/api/customer/route.ts — dipakai untuk pembatasan akses per toko:
// kalau username yang login cocok dengan nama toko, dia hanya boleh lihat
// data jastiper toko itu; kalau tidak cocok (HQ/admin), bisa lihat semua.
const STORE_LIST = [
  "Cirebon",
  "Jogja",
  "Karawaci",
  "Karawang",
  "Lampung",
  "Lembong",
  "Makassar",
  "Malang",
  "Margonda",
  "Medan",
  "Pekalongan",
  "Purwokerto",
  "Surabaya",
  "Tambun",
];

const EXTRA_STORE_ACCESS: Record<string, string[]> = {
  Margonda: ["Karawaci"],
  Surabaya: ["Malang"],
  Karawang: ["Tambun"],
};

function findMatchingStore(username: string): string | undefined {
  return STORE_LIST.find((store) => {
    const storeKey = store.toLowerCase().replace(/\s+/g, "");
    const usernameKey = username.toLowerCase().replace(/\s+/g, "").replace("torch", "");
    return storeKey === usernameKey;
  });
}

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

export async function GET(request: NextRequest) {
  try {
    await ensureJastiperSchema();

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const matchingStore = findMatchingStore(username);
    const accessibleStores = matchingStore
      ? [matchingStore, ...(EXTRA_STORE_ACCESS[matchingStore] || [])]
      : undefined;

    const q = (searchParams.get("q") || "").trim();
    const storeFilter = (searchParams.get("store") || "").trim();
    const respondFilter = (searchParams.get("respond") || "").trim();
    const statusFilter = (searchParams.get("status") || "").trim();

    const storesResult = accessibleStores
      ? await sql`SELECT DISTINCT jastiper_store FROM jastiper_master WHERE jastiper_store = ANY(${accessibleStores})`
      : await sql`SELECT DISTINCT jastiper_store FROM jastiper_master`;
    const availableStores = (storesResult as any[])
      .map((r) => r.jastiper_store)
      .filter(Boolean)
      .sort();

    const params: any[] = [];
    const ph = (v: any, cast: string) => {
      params.push(v);
      return `$${params.length}::${cast}`;
    };

    let where = "1=1";
    if (accessibleStores) {
      where += ` AND j.jastiper_store = ANY(${ph(accessibleStores, "text[]")})`;
    } else if (storeFilter) {
      where += ` AND j.jastiper_store = ${ph(storeFilter, "text")}`;
    }
    if (q) {
      const likePh = ph(`%${q}%`, "text");
      where += ` AND (j.jastiper_name ILIKE ${likePh} OR j.jastiper_phone_number ILIKE ${likePh} OR j.jastiper_code ILIKE ${likePh})`;
    }
    if (respondFilter) where += ` AND j.jastiper_respond = ${ph(respondFilter, "text")}`;
    if (statusFilter) where += ` AND j.jastiper_status = ${ph(statusFilter, "text")}`;

    // Kontribusi = total order & value shopify_orders yang kolom Notes-nya
    // mengandung jastiper_code milik baris ini — dihitung per baris via
    // LATERAL join (jastiper_master kecil, aman untuk pola ini).
    const query = `
      SELECT
        j.uuid, j.jastiper_name, j.jastiper_phone_number, j.jastiper_respond,
        j.jastiper_store, j.jastiper_code, j.jastiper_status,
        j.created_by, j.created_at, j.update_by, j.update_at,
        COALESCE(agg.total_order, 0)::int AS total_order,
        COALESCE(agg.total_value, 0)::numeric AS total_value
      FROM jastiper_master j
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT o.sales_order) AS total_order, SUM(o.total) AS total_value
        FROM shopify_orders o
        WHERE j.jastiper_code <> '' AND o.notes ILIKE ('%' || j.jastiper_code || '%')
      ) agg ON true
      WHERE ${where}
      ORDER BY j.jastiper_store ASC, j.jastiper_name ASC
    `;
    const rows = await sql(query, params);

    const data = (rows as any[]).map((r) => ({
      uuid: r.uuid,
      jastiper_name: r.jastiper_name || "",
      jastiper_phone_number: r.jastiper_phone_number || "",
      jastiper_respond: r.jastiper_respond || "",
      jastiper_store: r.jastiper_store || "",
      jastiper_code: r.jastiper_code || "",
      jastiper_status: r.jastiper_status || "",
      created_by: r.created_by || "",
      created_at: r.created_at || "",
      update_by: r.update_by || "",
      update_at: r.update_at || "",
      total_order: Number(r.total_order) || 0,
      total_value: Number(r.total_value) || 0,
      total_value_formatted: formatRupiah(Number(r.total_value) || 0),
    }));

    return NextResponse.json({
      isOwner: !!matchingStore,
      storeName: matchingStore || "",
      data,
      stores: availableStores,
    });
  } catch (error) {
    console.error("Error fetching jastiper data:", error);
    return NextResponse.json({ error: "Failed to fetch jastiper data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureJastiperSchema();
    const body = await request.json();

    const jastiper_name = (body.jastiper_name || "").trim();
    const jastiper_phone_number = (body.jastiper_phone_number || "").trim();
    const jastiper_respond = (body.jastiper_respond || "").trim();
    const jastiper_store = (body.jastiper_store || "").trim();
    const jastiper_status = (body.jastiper_status || "Active").trim();
    const created_by = (body.created_by || "").trim();

    if (!jastiper_name || !jastiper_store) {
      return NextResponse.json({ error: "Nama jastiper dan toko wajib diisi" }, { status: 400 });
    }

    const jastiper_phone_normalized = normalizePhone(jastiper_phone_number);
    const jastiper_code =
      (body.jastiper_code || "").trim() || generateJastiperCode(jastiper_store, jastiper_phone_number);

    const result = await sql`
      INSERT INTO jastiper_master (
        jastiper_name, jastiper_phone_number, jastiper_phone_normalized,
        jastiper_respond, jastiper_store, jastiper_code, jastiper_status,
        created_by, update_by
      ) VALUES (
        ${jastiper_name}, ${jastiper_phone_number}, ${jastiper_phone_normalized},
        ${jastiper_respond}, ${jastiper_store}, ${jastiper_code}, ${jastiper_status},
        ${created_by}, ${created_by}
      )
      RETURNING uuid
    `;

    return NextResponse.json({ success: true, uuid: result[0]?.uuid, jastiper_code });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Jastiper dengan nomor HP dan toko yang sama sudah ada" },
        { status: 409 }
      );
    }
    console.error("Error creating jastiper:", error);
    return NextResponse.json({ error: "Gagal menambah jastiper" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureJastiperSchema();
    const body = await request.json();

    const uuid = (body.uuid || "").trim();
    if (!uuid) {
      return NextResponse.json({ error: "uuid wajib diisi" }, { status: 400 });
    }

    const jastiper_name = (body.jastiper_name || "").trim();
    const jastiper_phone_number = (body.jastiper_phone_number || "").trim();
    const jastiper_respond = (body.jastiper_respond || "").trim();
    const jastiper_store = (body.jastiper_store || "").trim();
    const jastiper_status = (body.jastiper_status || "Active").trim();
    const update_by = (body.update_by || "").trim();

    const jastiper_phone_normalized = normalizePhone(jastiper_phone_number);
    const jastiper_code =
      (body.jastiper_code || "").trim() || generateJastiperCode(jastiper_store, jastiper_phone_number);

    await sql`
      UPDATE jastiper_master SET
        jastiper_name = ${jastiper_name},
        jastiper_phone_number = ${jastiper_phone_number},
        jastiper_phone_normalized = ${jastiper_phone_normalized},
        jastiper_respond = ${jastiper_respond},
        jastiper_store = ${jastiper_store},
        jastiper_code = ${jastiper_code},
        jastiper_status = ${jastiper_status},
        update_by = ${update_by},
        update_at = now()
      WHERE uuid = ${uuid}
    `;

    return NextResponse.json({ success: true, jastiper_code });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Jastiper dengan nomor HP dan toko yang sama sudah ada" },
        { status: 409 }
      );
    }
    console.error("Error updating jastiper:", error);
    return NextResponse.json({ error: "Gagal update jastiper" }, { status: 500 });
  }
}
