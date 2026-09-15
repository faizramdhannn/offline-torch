import { NextRequest, NextResponse } from "next/server";
import { sql, ensureJastiperSchema } from "@/lib/neon";
import { normalizePhone } from "@/lib/jastiper";

// Endpoint PUBLIK untuk dashboard personal jastiper (no HP + kode sebagai
// kredensial ringan, bukan akun/password sungguhan) — dipakai oleh
// app/jastiper-monitor/page.tsx yang sengaja diletakkan di luar route group
// (main) supaya tidak lewat useSessionGuard/layout otentikasi.
// JANGAN tambahkan auth check di sini — ini disengaja, sama seperti pola
// app/api/affiliate/public/route.ts.

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

export async function POST(request: NextRequest) {
  try {
    await ensureJastiperSchema();
    const body = await request.json();

    const phoneRaw = (body.phone || "").trim();
    const code = (body.jastiper_code || "").trim().toUpperCase();
    if (!phoneRaw || !code) {
      return NextResponse.json({ error: "No HP dan kode jastiper wajib diisi" }, { status: 400 });
    }

    const phoneNormalized = normalizePhone(phoneRaw);

    const rows = await sql`
      SELECT uuid, jastiper_name, jastiper_phone_number, jastiper_store, jastiper_code, jastiper_status
      FROM jastiper_master
      WHERE jastiper_phone_normalized = ${phoneNormalized} AND jastiper_code = ${code}
      LIMIT 1
    `;
    const jastiper = rows[0];
    if (!jastiper) {
      return NextResponse.json(
        { error: "No HP atau kode jastiper tidak ditemukan" },
        { status: 404 }
      );
    }

    // Kontribusi = order yang kolom Notes-nya (Shopify) mengandung kode ini —
    // sama seperti perhitungan di API internal (app/api/jastiper/route.ts).
    const orderRows = await sql`
      SELECT sales_order, store_name, total, created_at, paid_at
      FROM shopify_orders
      WHERE notes ILIKE ('%' || ${code} || '%')
      ORDER BY created_at DESC NULLS LAST
      LIMIT 200
    `;

    const orders = (orderRows as any[]).map((o) => ({
      sales_order: o.sales_order || "",
      store_name: o.store_name || "",
      value: Number(o.total) || 0,
      value_formatted: formatRupiah(Number(o.total) || 0),
      date: o.paid_at || o.created_at || null,
    }));

    const totalOrder = orders.length;
    const totalValue = orders.reduce((sum, o) => sum + o.value, 0);

    return NextResponse.json({
      jastiper: {
        jastiper_name: jastiper.jastiper_name || "",
        jastiper_phone_number: jastiper.jastiper_phone_number || "",
        jastiper_store: jastiper.jastiper_store || "",
        jastiper_code: jastiper.jastiper_code || "",
        jastiper_status: jastiper.jastiper_status || "",
      },
      orders,
      summary: {
        total_order: totalOrder,
        total_value: totalValue,
        total_value_formatted: formatRupiah(totalValue),
      },
    });
  } catch (error) {
    console.error("Error fetching jastiper public dashboard:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
