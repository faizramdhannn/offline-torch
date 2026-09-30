import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

// ─────────────────────────────────────────────────────────────────────────────
// "Sales by Badge" — Analytics Order: berapa order/qty/value yang datang dari
// customer yang punya badge tertentu (Champion, Bulk Order, Gundam, dst),
// dalam rentang tanggal/store yang dipilih di halaman.
//
// Badge customer (tier, bulk, collection) dihitung dari LIFETIME order
// customer tsb (paid, semua tanggal) — sama seperti logic di /api/customer —
// supaya konsisten dengan badge yang tampil di Customer Segmentation. Yang
// dibatasi rentang tanggal/store HANYA metrik penjualannya (orders/qty/value),
// bukan status badge-nya sendiri.
//
// Satu order bisa masuk ke beberapa badge sekaligus (mis. customer itu
// Champion DAN punya badge Gundam) — makanya total semua baris badge di
// sini BISA melebihi total order asli, ini "distribusi", bukan partisi.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const storeParam = searchParams.get('store');
    const storeScope = storeParam ? storeParam.split(',').filter(Boolean) : null;

    const key = (store: string, phone: string) => `${store}||${phone}`;

    // ── 1. Klasifikasi tier per customer — LIFETIME (semua order paid, semua
    // tanggal, tidak dibatasi store filter, karena badge adalah atribut
    // customer, bukan atribut per-transaksi). ──────────────────────────────
    const tierRows = await sql`
      SELECT store_name, phone, COUNT(DISTINCT sales_order)::int AS total_order
      FROM shopify_orders
      WHERE lower(financial_status) = 'paid' AND phone IS NOT NULL AND phone <> ''
      GROUP BY store_name, phone
    `;
    const tierMap = new Map<string, number>();
    (tierRows as any[]).forEach((r) => tierMap.set(key(r.store_name, r.phone), Number(r.total_order) || 0));

    const bulkRows = await sql`
      SELECT DISTINCT o.store_name, o.phone
      FROM shopify_orders o
      WHERE lower(o.financial_status) = 'paid' AND o.phone IS NOT NULL AND o.phone <> ''
        AND (SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li) > 5
    `;
    const bulkSet = new Set<string>((bulkRows as any[]).map((r) => key(r.store_name, r.phone)));

    const badgeDefs = await sql`SELECT badge_key, label, badge_type, sku_list FROM customer_badges ORDER BY sort_order ASC`;
    const collectionBadges = (badgeDefs as any[]).filter(
      (b) => b.badge_type === 'collection' && Array.isArray(b.sku_list) && b.sku_list.length > 0
    );
    const collectionSets = new Map<string, Set<string>>();
    for (const badge of collectionBadges) {
      const skus: string[] = (badge.sku_list as string[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (skus.length === 0) continue;
      const rows = await sql`
        SELECT DISTINCT o.store_name, o.phone
        FROM shopify_orders o, jsonb_array_elements(o.line_items) li
        WHERE lower(o.financial_status) = 'paid' AND o.phone IS NOT NULL AND o.phone <> ''
          AND upper(li->>'sku') = ANY(${skus})
      `;
      const set = new Set<string>();
      (rows as any[]).forEach((r) => set.add(key(r.store_name, r.phone)));
      collectionSets.set(badge.badge_key, set);
    }

    function badgesForCustomer(store: string, phone: string): string[] {
      const k = key(store, phone);
      const totalOrder = tierMap.get(k) || 0;
      const badges: string[] = [];
      if (totalOrder === 1) badges.push('new_customer');
      else if (totalOrder >= 2 && totalOrder <= 5) badges.push('potential_loyalist');
      else if (totalOrder > 5) badges.push('champion');
      if (bulkSet.has(k)) badges.push('bulk_order');
      collectionSets.forEach((set, badgeKey) => {
        if (set.has(k)) badges.push(badgeKey);
      });
      return badges;
    }

    // ── 2. Penjualan DALAM rentang tanggal/store yang dipilih — per customer. ──
    const salesRows = storeScope
      ? await sql`
          SELECT
            o.store_name, o.phone,
            COUNT(DISTINCT o.sales_order)::int AS orders,
            SUM(o.total)::numeric AS value,
            SUM((SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li))::numeric AS qty
          FROM shopify_orders o
          WHERE lower(o.financial_status) = 'paid' AND o.phone IS NOT NULL AND o.phone <> ''
            AND o.store_name = ANY(${storeScope})
            AND (${from}::date IS NULL OR o.created_at >= ${from}::date)
            AND (${to}::date IS NULL OR o.created_at < (${to}::date + INTERVAL '1 day'))
          GROUP BY o.store_name, o.phone
        `
      : await sql`
          SELECT
            o.store_name, o.phone,
            COUNT(DISTINCT o.sales_order)::int AS orders,
            SUM(o.total)::numeric AS value,
            SUM((SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li))::numeric AS qty
          FROM shopify_orders o
          WHERE lower(o.financial_status) = 'paid' AND o.phone IS NOT NULL AND o.phone <> ''
            AND (${from}::date IS NULL OR o.created_at >= ${from}::date)
            AND (${to}::date IS NULL OR o.created_at < (${to}::date + INTERVAL '1 day'))
          GROUP BY o.store_name, o.phone
        `;

    // ── 3. Distribusikan tiap customer ke badge-badge yang dia punya. ──────
    type Agg = { orders: number; value: number; qty: number; customers: Set<string> };
    const totals = new Map<string, Agg>();
    const bump = (badgeKey: string, store: string, phone: string, orders: number, value: number, qty: number) => {
      const agg = totals.get(badgeKey) || { orders: 0, value: 0, qty: 0, customers: new Set<string>() };
      agg.orders += orders;
      agg.value += value;
      agg.qty += qty;
      agg.customers.add(key(store, phone));
      totals.set(badgeKey, agg);
    };

    for (const r of salesRows as any[]) {
      const badges = badgesForCustomer(r.store_name, r.phone);
      for (const b of badges) {
        bump(b, r.store_name, r.phone, Number(r.orders) || 0, Number(r.value) || 0, Number(r.qty) || 0);
      }
    }

    const labelByKey = new Map<string, string>([
      ['new_customer', 'New Customer'],
      ['potential_loyalist', 'Potential Loyalist'],
      ['champion', 'Champion'],
      ['bulk_order', 'Bulk Order'],
      ...(badgeDefs as any[]).map((b) => [b.badge_key, b.label] as [string, string]),
    ]);

    const result = Array.from(totals.entries()).map(([badge_key, agg]) => ({
      badge_key,
      label: labelByKey.get(badge_key) || badge_key,
      orders: agg.orders,
      qty: agg.qty,
      value: agg.value,
      customers: agg.customers.size,
    }));
    result.sort((a, b) => b.value - a.value);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error computing sales by badge:', error);
    return NextResponse.json({ error: 'Failed to compute sales by badge' }, { status: 500 });
  }
}
