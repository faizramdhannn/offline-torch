import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

// Kolom-kolom yang benar-benar dipakai oleh app/(main)/analytics-order/page.tsx
// (lihat interface Row di sana). Baris pertama tiap order dapat semua kolom
// order-level (diproyeksikan langsung dari `raw` lewat ->> di SQL — JANGAN
// select seluruh kolom `raw`/`line_items` mentah untuk semua order sekaligus,
// itu pernah bikin response >64MB dan gagal di driver Neon), baris ke-2+
// (item ke-2 dst dalam order yang sama) hanya membawa Name + kolom
// Lineitem-nya sendiri — persis seperti export mentah Shopify, supaya semua
// logic analytics yang sudah ada di halaman tetap jalan sama.
export async function GET(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const orders = from || to
      ? await sql`
          SELECT
            sales_order,
            raw->>'Created at' AS created_at_raw,
            raw->>'Paid at' AS paid_at,
            raw->>'Financial Status' AS financial_status,
            raw->>'Subtotal' AS subtotal,
            raw->>'Notes' AS notes,
            raw->>'Discount Code' AS discount_code,
            raw->>'Discount Amount' AS discount_amount,
            raw->>'Employee' AS employee,
            raw->>'Location' AS location,
            line_items
          FROM shopify_orders
          WHERE (${from}::date IS NULL OR created_at >= ${from}::date)
            AND (${to}::date IS NULL OR created_at < (${to}::date + INTERVAL '1 day'))
          ORDER BY created_at ASC NULLS LAST
        `
      : await sql`
          SELECT
            sales_order,
            raw->>'Created at' AS created_at_raw,
            raw->>'Paid at' AS paid_at,
            raw->>'Financial Status' AS financial_status,
            raw->>'Subtotal' AS subtotal,
            raw->>'Notes' AS notes,
            raw->>'Discount Code' AS discount_code,
            raw->>'Discount Amount' AS discount_amount,
            raw->>'Employee' AS employee,
            raw->>'Location' AS location,
            line_items
          FROM shopify_orders
          ORDER BY created_at ASC NULLS LAST
        `;

    const rows: Record<string, string>[] = [];
    for (const o of orders as any[]) {
      const head = {
        'Name': o.sales_order || '',
        'Created at': o.created_at_raw || '',
        'Paid at': o.paid_at || '',
        'Financial Status': o.financial_status || '',
        'Subtotal': o.subtotal || '',
        'Notes': o.notes || '',
        'Discount Code': o.discount_code || '',
        'Discount Amount': o.discount_amount || '',
        'Employee': o.employee || '',
        'Location': o.location || '',
      };
      const lineItems = Array.isArray(o.line_items) ? o.line_items : [];

      if (lineItems.length === 0) {
        rows.push({ ...head, 'Lineitem name': '', 'Lineitem quantity': '', 'Lineitem price': '' });
        continue;
      }

      lineItems.forEach((li: any, idx: number) => {
        const row: Record<string, string> =
          idx === 0
            ? { ...head }
            : {
                Name: head['Name'],
                'Created at': '', 'Paid at': '', 'Financial Status': '', 'Subtotal': '',
                Notes: '', 'Discount Code': '', 'Discount Amount': '', Employee: '', Location: '',
              };
        row['Lineitem name'] = li.name || '';
        row['Lineitem quantity'] = li.quantity != null ? String(li.quantity) : '';
        row['Lineitem price'] = li.price != null ? String(li.price) : '';
        rows.push(row);
      });
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching shopify analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch shopify analytics data' }, { status: 500 });
  }
}
