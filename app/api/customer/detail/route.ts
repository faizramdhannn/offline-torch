import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

function formatRupiah(v: number) {
  return 'Rp' + Math.round(v).toLocaleString('id-ID');
}

export async function GET(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    const orders = await sql`
      SELECT sales_order, store_name, customer_name, email, financial_status, fulfillment_status,
             total, created_at, paid_at, line_items
      FROM shopify_orders
      WHERE phone = ${phone}
      ORDER BY created_at ASC NULLS LAST
    `;

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const crmRows = await sql`
      SELECT store_name, followup, result, ket, link_url, update_by, update_at
      FROM customer_crm
      WHERE phone_number = ${phone}
    `;

    const badgeDefs = await sql`SELECT badge_key, label, badge_type, logo_url, sku_list FROM customer_badges ORDER BY sort_order ASC`;

    const stores = Array.from(new Set(orders.map((o: any) => o.store_name).filter(Boolean)));
    const totalOrder = new Set(orders.map((o: any) => o.sales_order)).size;
    const totalValue = orders.reduce((a: number, o: any) => a + (Number(o.total) || 0), 0);

    let totalQty = 0;
    let bulkOrderFound = false;
    const skuSet = new Set<string>();
    const orderList = orders.map((o: any) => {
      const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
      const qty = lineItems.reduce((a: number, li: any) => a + (Number(li.quantity) || 0), 0);
      totalQty += qty;
      if (qty > 5) bulkOrderFound = true;
      lineItems.forEach((li: any) => {
        if (li.sku) skuSet.add(String(li.sku).trim().toUpperCase());
      });
      return {
        sales_order: o.sales_order,
        store_name: o.store_name,
        financial_status: o.financial_status,
        fulfillment_status: o.fulfillment_status,
        total: Number(o.total) || 0,
        total_formatted: formatRupiah(Number(o.total) || 0),
        created_at: o.created_at,
        paid_at: o.paid_at,
        qty,
        line_items: lineItems.map((li: any) => ({
          sku: li.sku || '',
          name: li.name || '',
          quantity: Number(li.quantity) || 0,
          price: Number(li.price) || 0,
        })),
      };
    });

    const badges: string[] = [];
    if (totalOrder === 1) badges.push('new_customer');
    else if (totalOrder >= 2 && totalOrder <= 5) badges.push('potential_loyalist');
    else if (totalOrder > 5) badges.push('champion');
    if (bulkOrderFound) badges.push('bulk_order');
    for (const badge of badgeDefs as any[]) {
      if (badge.badge_type !== 'collection') continue;
      const skus: string[] = Array.isArray(badge.sku_list) ? badge.sku_list : [];
      const matched = skus.some((s) => skuSet.has(String(s).trim().toUpperCase()));
      if (matched) badges.push(badge.badge_key);
    }

    const last = orders[orders.length - 1];
    const first = orders[0];

    return NextResponse.json({
      phone_number: phone,
      customer_name: last.customer_name || first.customer_name || '',
      email:
        [...orders].reverse().map((o: any) => o.email).find((e: string) => e && e.trim() !== '') || '',
      stores,
      total_order: totalOrder,
      total_qty: totalQty,
      total_value: totalValue,
      total_value_formatted: formatRupiah(totalValue),
      average_value_formatted: formatRupiah(totalOrder ? totalValue / totalOrder : 0),
      first_purchase: first.created_at,
      last_purchase: last.created_at,
      badges,
      orders: orderList.reverse(),
      crm: crmRows,
    });
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    return NextResponse.json({ error: 'Failed to fetch customer detail' }, { status: 500 });
  }
}
