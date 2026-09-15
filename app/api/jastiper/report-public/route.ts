import { NextRequest, NextResponse } from "next/server";
import { sql, ensureJastiperSchema } from "@/lib/neon";

// Endpoint PUBLIK, TIDAK ada gate sama sekali — dipakai oleh
// app/jastiper-report/page.tsx untuk monitoring agregat SEMUA jastiper per
// toko. Sengaja HANYA menampilkan angka agregat per toko (bukan per-jastiper)
// supaya tidak membocorkan nama/no HP personal jastiper ke publik.
// JANGAN tambahkan auth check atau data personal (nama/no HP) di sini.

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

export async function GET(request: NextRequest) {
  try {
    await ensureJastiperSchema();
    const { searchParams } = new URL(request.url);
    const storeFilter = (searchParams.get("store") || "all").trim();

    // Per-jastiper contribution (code -> store, total_order, total_value),
    // lalu di-agregasi ke level toko di sini — tidak ada nama/kode yang
    // dikembalikan ke client.
    const rows = await sql`
      SELECT
        j.jastiper_store AS store,
        COALESCE(agg.total_order, 0)::int AS total_order,
        COALESCE(agg.total_value, 0)::numeric AS total_value
      FROM jastiper_master j
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT o.sales_order) AS total_order, SUM(o.total) AS total_value
        FROM shopify_orders o
        WHERE j.jastiper_code <> '' AND o.notes ILIKE ('%' || j.jastiper_code || '%')
      ) agg ON true
      WHERE j.jastiper_code <> ''
    `;

    const byStore = new Map<string, { total_order: number; total_value: number; jastiper_count: number }>();
    for (const r of rows as any[]) {
      const store = r.store || "Lainnya";
      if (!byStore.has(store)) byStore.set(store, { total_order: 0, total_value: 0, jastiper_count: 0 });
      const entry = byStore.get(store)!;
      entry.total_order += Number(r.total_order) || 0;
      entry.total_value += Number(r.total_value) || 0;
      entry.jastiper_count += 1;
    }

    const stores = Array.from(byStore.keys()).sort();

    const chartByStore = Array.from(byStore.entries())
      .map(([store, v]) => ({
        store,
        total_order: v.total_order,
        total_value: v.total_value,
        jastiper_count: v.jastiper_count,
      }))
      .sort((a, b) => b.total_value - a.total_value);

    const scoped = storeFilter === "all" ? chartByStore : chartByStore.filter((s) => s.store === storeFilter);

    const summary = scoped.reduce(
      (acc, s) => ({
        total_order: acc.total_order + s.total_order,
        total_value: acc.total_value + s.total_value,
        jastiper_count: acc.jastiper_count + s.jastiper_count,
      }),
      { total_order: 0, total_value: 0, jastiper_count: 0 }
    );

    return NextResponse.json({
      stores,
      summary: {
        ...summary,
        total_value_formatted: formatRupiah(summary.total_value),
      },
      chart_by_store: chartByStore,
    });
  } catch (error) {
    console.error("Error fetching jastiper public report:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
