import { NextRequest, NextResponse } from "next/server";
import { sql, ensureJastiperSchema } from "@/lib/neon";

// Endpoint PUBLIK, TIDAK ada gate sama sekali — dipakai oleh
// app/jastiper-report/page.tsx untuk monitoring SEMUA jastiper.
// PENTING (per keputusan eksplisit user): halaman ini SEKARANG menampilkan
// data lengkap per-jastiper (nama, no HP, kode, dll) ke siapa saja yang
// buka link — bukan lagi agregat-only. Kalau kebutuhan privasi berubah
// lagi nanti, ini titik yang harus disesuaikan.
// JANGAN tambahkan auth check di sini — ini disengaja.

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

export async function GET(request: NextRequest) {
  try {
    await ensureJastiperSchema();
    const { searchParams } = new URL(request.url);
    // Multi-select toko & respond: comma-separated, kosong/absen = semua.
    const storesParam = (searchParams.get("stores") || "").trim();
    const storeList = storesParam ? storesParam.split(",").filter(Boolean) : null;
    const respondParam = (searchParams.get("respond") || "").trim();
    const respondList = respondParam ? respondParam.split(",").filter(Boolean) : null;

    const allStoresResult = await sql`
      SELECT DISTINCT jastiper_store FROM jastiper_master WHERE jastiper_store <> ''
    `;
    const allStores = (allStoresResult as any[]).map((r) => r.jastiper_store).filter(Boolean).sort();

    const allRespondsResult = await sql`
      SELECT DISTINCT jastiper_respond FROM jastiper_master WHERE jastiper_respond <> ''
    `;
    const allResponds = (allRespondsResult as any[]).map((r) => r.jastiper_respond).filter(Boolean).sort();

    const params: any[] = [];
    const ph = (v: any, cast: string) => {
      params.push(v);
      return `$${params.length}::${cast}`;
    };
    let where = "j.jastiper_code <> ''";
    if (storeList) where += ` AND j.jastiper_store = ANY(${ph(storeList, "text[]")})`;
    if (respondList) where += ` AND j.jastiper_respond = ANY(${ph(respondList, "text[]")})`;

    // Data lengkap per-jastiper + kontribusinya — dasar untuk tab Data,
    // ringkasan, dan pie chart (semua dihitung dari array ini, bukan query
    // agregat terpisah, supaya angkanya selalu konsisten satu sama lain).
    const query = `
      SELECT
        j.uuid, j.jastiper_name, j.jastiper_phone_number, j.jastiper_store,
        j.jastiper_code, j.jastiper_respond, j.jastiper_status, j.notes,
        j.social_media, j.social_media_username,
        COALESCE(agg.total_order, 0)::int AS total_order,
        COALESCE(agg.total_value, 0)::numeric AS total_value
      FROM jastiper_master j
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT o.sales_order) AS total_order, SUM(o.total) AS total_value
        FROM shopify_orders o
        WHERE o.notes ILIKE ('%' || j.jastiper_code || '%')
      ) agg ON true
      WHERE ${where}
      ORDER BY j.jastiper_store ASC, j.jastiper_name ASC
    `;
    const rows = (await sql(query, params)) as any[];

    // Daftar sales order per kode jastiper — dipakai untuk expand baris di
    // tab Data (klik nama jastiper langsung lihat order-nya, tanpa fetch
    // terpisah per baris). Satu query untuk semua kode dalam scope filter,
    // lalu dikelompokkan per kode di JS.
    const orderRows = (await sql(
      `
        SELECT o.sales_order, o.store_name, o.total, o.created_at, o.paid_at, j.jastiper_code
        FROM shopify_orders o
        JOIN jastiper_master j ON j.jastiper_code <> '' AND o.notes ILIKE ('%' || j.jastiper_code || '%')
        WHERE ${where}
        ORDER BY COALESCE(o.paid_at, o.created_at) DESC NULLS LAST
      `,
      params
    )) as any[];

    const ordersByCode = new Map<string, { sales_order: string; store_name: string; value: number; value_formatted: string; date: string | null }[]>();
    for (const o of orderRows) {
      const code = o.jastiper_code;
      if (!ordersByCode.has(code)) ordersByCode.set(code, []);
      const value = Number(o.total) || 0;
      ordersByCode.get(code)!.push({
        sales_order: o.sales_order || "",
        store_name: o.store_name || "",
        value,
        value_formatted: formatRupiah(value),
        date: o.paid_at || o.created_at || null,
      });
    }

    const data = rows.map((r) => ({
      uuid: r.uuid,
      jastiper_name: r.jastiper_name || "",
      jastiper_phone_number: r.jastiper_phone_number || "",
      jastiper_store: r.jastiper_store || "",
      jastiper_code: r.jastiper_code || "",
      jastiper_respond: r.jastiper_respond || "",
      jastiper_status: r.jastiper_status || "",
      notes: r.notes || "",
      social_media: r.social_media || "",
      social_media_username: r.social_media_username || "",
      total_order: Number(r.total_order) || 0,
      total_value: Number(r.total_value) || 0,
      total_value_formatted: formatRupiah(Number(r.total_value) || 0),
      orders: ordersByCode.get(r.jastiper_code) || [],
    }));

    // Agregasi per toko (untuk bar chart + pie chart mode "Toko").
    const byStore = new Map<string, { jastiper_count: number; total_order: number; total_value: number }>();
    for (const d of data) {
      const key = d.jastiper_store || "Lainnya";
      if (!byStore.has(key)) byStore.set(key, { jastiper_count: 0, total_order: 0, total_value: 0 });
      const e = byStore.get(key)!;
      e.jastiper_count += 1;
      e.total_order += d.total_order;
      e.total_value += d.total_value;
    }
    const chartByStore = Array.from(byStore.entries())
      .map(([store, v]) => ({ store, ...v }))
      .sort((a, b) => b.total_value - a.total_value);

    // Agregasi per status respond (untuk pie chart mode "Respond").
    const byRespond = new Map<string, number>();
    for (const d of data) {
      const key = d.jastiper_respond || "Belum Diisi";
      byRespond.set(key, (byRespond.get(key) || 0) + 1);
    }
    const chartByRespond = Array.from(byRespond.entries())
      .map(([respond, count]) => ({ respond, count }))
      .sort((a, b) => b.count - a.count);

    const summary = {
      jastiper_count: data.length,
      total_order: data.reduce((s, d) => s + d.total_order, 0),
      total_value: data.reduce((s, d) => s + d.total_value, 0),
    };

    // Tren harian (30 hari terakhir) dari order yang match salah satu kode
    // jastiper dalam scope filter — DISTINCT di CTE supaya order yang
    // (jarang) match >1 kode tidak double-count value/order-nya.
    const trendParams: any[] = [];
    const trendPh = (v: any, cast: string) => {
      trendParams.push(v);
      return `$${trendParams.length}::${cast}`;
    };
    let trendJastiperWhere = "j.jastiper_code <> ''";
    if (storeList) trendJastiperWhere += ` AND j.jastiper_store = ANY(${trendPh(storeList, "text[]")})`;
    if (respondList) trendJastiperWhere += ` AND j.jastiper_respond = ANY(${trendPh(respondList, "text[]")})`;
    const trendQuery = `
      WITH matched AS (
        SELECT DISTINCT o.sales_order, COALESCE(o.paid_at, o.created_at) AS d, o.total
        FROM shopify_orders o
        JOIN jastiper_master j ON j.jastiper_code <> '' AND o.notes ILIKE ('%' || j.jastiper_code || '%')
        WHERE ${trendJastiperWhere}
      )
      SELECT
        to_char(date_trunc('day', d), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS total_order,
        SUM(total)::numeric AS total_value
      FROM matched
      WHERE d IS NOT NULL AND d >= now() - interval '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const trendRows = (await sql(trendQuery, trendParams)) as any[];
    const chartTrend = trendRows.map((r) => ({
      date: r.date,
      total_order: Number(r.total_order) || 0,
      total_value: Number(r.total_value) || 0,
    }));

    return NextResponse.json({
      stores: allStores,
      responds: allResponds,
      summary: { ...summary, total_value_formatted: formatRupiah(summary.total_value) },
      chart_by_store: chartByStore,
      chart_by_respond: chartByRespond,
      chart_trend: chartTrend,
      data,
    });
  } catch (error) {
    console.error("Error fetching jastiper public report:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
