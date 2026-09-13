import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

export async function GET() {
  try {
    await ensureCustomerSchema();
    const rows = await sql`
      SELECT id, badge_key, label, badge_type, logo_url, sku_list, sort_order
      FROM customer_badges
      ORDER BY sort_order ASC, id ASC
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Error fetching customer badges:', error);
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCustomerSchema();
    const body = await request.json();
    const { badge_key, label, logo_url, sku_list } = body;

    if (!badge_key || !label) {
      return NextResponse.json({ error: 'badge_key dan label wajib diisi' }, { status: 400 });
    }

    const skuArray = Array.isArray(sku_list) ? sku_list : [];

    const rows = await sql`
      INSERT INTO customer_badges (badge_key, label, badge_type, logo_url, sku_list, sort_order)
      VALUES (
        ${badge_key}, ${label}, 'collection', ${logo_url || null}, ${JSON.stringify(skuArray)},
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM customer_badges)
      )
      RETURNING id, badge_key, label, badge_type, logo_url, sku_list, sort_order
    `;

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    if (error?.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Badge key sudah dipakai' }, { status: 400 });
    }
    console.error('Error creating customer badge:', error);
    return NextResponse.json({ error: 'Failed to create badge' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureCustomerSchema();
    const body = await request.json();
    const { id, label, logo_url, sku_list } = body;

    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    }

    const skuArray = Array.isArray(sku_list) ? sku_list : undefined;

    const rows = await sql`
      UPDATE customer_badges SET
        label = COALESCE(${label ?? null}, label),
        logo_url = COALESCE(${logo_url ?? null}, logo_url),
        sku_list = COALESCE(${skuArray ? JSON.stringify(skuArray) : null}::jsonb, sku_list),
        updated_at = now()
      WHERE id = ${id}
      RETURNING id, badge_key, label, badge_type, logo_url, sku_list, sort_order
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Badge tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error updating customer badge:', error);
    return NextResponse.json({ error: 'Failed to update badge' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCustomerSchema();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    }
    await sql`DELETE FROM customer_badges WHERE id = ${id} AND badge_type = 'collection'`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer badge:', error);
    return NextResponse.json({ error: 'Failed to delete badge' }, { status: 500 });
  }
}
