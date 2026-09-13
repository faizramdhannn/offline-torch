import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

export async function GET(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const orders = (from || to)
      ? await sql`
          SELECT
            sales_order, store_name, location, customer_name, email, phone,
            financial_status, fulfillment_status, currency,
            subtotal, shipping, taxes, total,
            discount_code, discount_amount,
            payment_method, risk_level, source, tags, notes,
            created_at, paid_at, line_items
          FROM shopify_orders
          WHERE (${from}::date IS NULL OR created_at >= ${from}::date)
            AND (${to}::date IS NULL OR created_at < (${to}::date + INTERVAL '1 day'))
          ORDER BY created_at ASC NULLS LAST
        `
      : await sql`
          SELECT
            sales_order, store_name, location, customer_name, email, phone,
            financial_status, fulfillment_status, currency,
            subtotal, shipping, taxes, total,
            discount_code, discount_amount,
            payment_method, risk_level, source, tags, notes,
            created_at, paid_at, line_items
          FROM shopify_orders
          ORDER BY created_at ASC NULLS LAST
        `;

    // ─── Badges per phone — status keseluruhan customer (bukan dibatasi
    // rentang tanggal export), sama seperti logic di /api/customer. ──
    const phones = Array.from(new Set((orders as any[]).map((o) => o.phone).filter(Boolean)));

    const badgeDefs = await sql`SELECT badge_key, label, badge_type, sku_list FROM customer_badges ORDER BY sort_order ASC`;
    const collectionBadges = badgeDefs.filter((b: any) => b.badge_type === 'collection' && Array.isArray(b.sku_list) && b.sku_list.length > 0);

    const tierCountByPhone = new Map<string, number>();
    if (phones.length > 0) {
      const rows = await sql`
        SELECT phone, COUNT(DISTINCT sales_order)::int AS total_order
        FROM shopify_orders
        WHERE phone = ANY(${phones})
        GROUP BY phone
      `;
      rows.forEach((r: any) => tierCountByPhone.set(r.phone, Number(r.total_order) || 0));
    }

    const bulkPhones = new Set<string>();
    if (phones.length > 0) {
      const rows = await sql`
        SELECT DISTINCT phone
        FROM shopify_orders
        WHERE phone = ANY(${phones})
          AND (SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(line_items) li) > 5
      `;
      rows.forEach((r: any) => bulkPhones.add(r.phone));
    }

    const collectionPhoneSets = new Map<string, Set<string>>();
    for (const badge of collectionBadges) {
      const skus: string[] = (badge.sku_list as string[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (skus.length === 0 || phones.length === 0) continue;
      const rows = await sql`
        SELECT DISTINCT o.phone
        FROM shopify_orders o, jsonb_array_elements(o.line_items) li
        WHERE o.phone = ANY(${phones}) AND upper(li->>'sku') = ANY(${skus})
      `;
      const set = new Set<string>();
      rows.forEach((r: any) => set.add(r.phone));
      collectionPhoneSets.set(badge.badge_key, set);
    }

    const labelByKey = new Map(badgeDefs.map((b: any) => [b.badge_key, b.label]));

    function badgesForPhone(phone: string): string {
      if (!phone) return '';
      const keys: string[] = [];
      const totalOrder = tierCountByPhone.get(phone) || 0;
      if (totalOrder === 1) keys.push('new_customer');
      else if (totalOrder >= 2 && totalOrder <= 5) keys.push('potential_loyalist');
      else if (totalOrder > 5) keys.push('champion');
      if (bulkPhones.has(phone)) keys.push('bulk_order');
      collectionPhoneSets.forEach((set, badgeKey) => {
        if (set.has(phone)) keys.push(badgeKey);
      });
      return keys.map((k) => labelByKey.get(k) || k).join(', ');
    }

    const rows: Record<string, any>[] = [];
    for (const o of orders as any[]) {
      const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
      const badges = badgesForPhone(o.phone);
      const base = {
        'Sales Order': o.sales_order,
        Store: o.store_name,
        Location: o.location,
        Customer: o.customer_name,
        Email: o.email,
        Phone: o.phone,
        Badge: badges,
        'Financial Status': o.financial_status,
        'Fulfillment Status': o.fulfillment_status,
        Currency: o.currency,
        Subtotal: Number(o.subtotal) || 0,
        Shipping: Number(o.shipping) || 0,
        Taxes: Number(o.taxes) || 0,
        Total: Number(o.total) || 0,
        'Discount Code': o.discount_code,
        'Discount Amount': Number(o.discount_amount) || 0,
        'Payment Method': o.payment_method,
        'Risk Level': o.risk_level,
        Source: o.source,
        Tags: o.tags,
        Notes: o.notes,
        'Created At': o.created_at,
        'Paid At': o.paid_at,
      };

      if (lineItems.length === 0) {
        rows.push({ ...base, SKU: '', 'Item Name': '', Qty: '', 'Item Price': '' });
        continue;
      }
      lineItems.forEach((li: any) => {
        rows.push({
          ...base,
          SKU: li.sku || '',
          'Item Name': li.name || '',
          Qty: li.quantity ?? '',
          'Item Price': li.price ?? '',
        });
      });
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Error exporting customer/order data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
