import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { sql, ensureCustomerSchema } from "@/lib/neon";
import { groupShopifyRows, type ShopifyCsvRow, type NormalizedOrder } from "@/lib/shopifyImport";

export const maxDuration = 300;

const CHUNK_SIZE = 300;

async function upsertChunk(chunk: NormalizedOrder[]): Promise<{ inserted: number; updated: number }> {
  const rows = chunk.map((o) => ({
    sales_order: o.sales_order,
    order_id: o.order_id,
    email: o.email,
    phone: o.phone,
    customer_name: o.customer_name,
    financial_status: o.financial_status,
    fulfillment_status: o.fulfillment_status,
    currency: o.currency,
    subtotal: o.subtotal,
    shipping: o.shipping,
    taxes: o.taxes,
    total: o.total,
    discount_code: o.discount_code,
    discount_amount: o.discount_amount,
    location: o.location,
    store_name: o.store_name,
    source: o.source,
    payment_method: o.payment_method,
    risk_level: o.risk_level,
    tags: o.tags,
    notes: o.notes,
    created_at: o.created_at,
    paid_at: o.paid_at,
    cancelled_at: o.cancelled_at,
    line_items: o.line_items,
    raw: o.raw,
  }));

  const result = await sql`
    INSERT INTO shopify_orders (
      sales_order, order_id, email, phone, customer_name,
      financial_status, fulfillment_status, currency,
      subtotal, shipping, taxes, total,
      discount_code, discount_amount,
      location, store_name, source, payment_method, risk_level, tags, notes,
      created_at, paid_at, cancelled_at,
      line_items, raw, updated_at
    )
    SELECT
      t.sales_order, t.order_id, t.email, t.phone, t.customer_name,
      t.financial_status, t.fulfillment_status, t.currency,
      t.subtotal, t.shipping, t.taxes, t.total,
      t.discount_code, t.discount_amount,
      t.location, t.store_name, t.source, t.payment_method, t.risk_level, t.tags, t.notes,
      t.created_at, t.paid_at, t.cancelled_at,
      t.line_items, t.raw, now()
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(
      sales_order TEXT, order_id TEXT, email TEXT, phone TEXT, customer_name TEXT,
      financial_status TEXT, fulfillment_status TEXT, currency TEXT,
      subtotal NUMERIC, shipping NUMERIC, taxes NUMERIC, total NUMERIC,
      discount_code TEXT, discount_amount NUMERIC,
      location TEXT, store_name TEXT, source TEXT, payment_method TEXT, risk_level TEXT, tags TEXT, notes TEXT,
      created_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
      line_items JSONB, raw JSONB
    )
    ON CONFLICT (sales_order) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      customer_name = EXCLUDED.customer_name,
      financial_status = EXCLUDED.financial_status,
      fulfillment_status = EXCLUDED.fulfillment_status,
      currency = EXCLUDED.currency,
      subtotal = EXCLUDED.subtotal,
      shipping = EXCLUDED.shipping,
      taxes = EXCLUDED.taxes,
      total = EXCLUDED.total,
      discount_code = EXCLUDED.discount_code,
      discount_amount = EXCLUDED.discount_amount,
      location = EXCLUDED.location,
      store_name = EXCLUDED.store_name,
      source = EXCLUDED.source,
      payment_method = EXCLUDED.payment_method,
      risk_level = EXCLUDED.risk_level,
      tags = EXCLUDED.tags,
      notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at,
      paid_at = EXCLUDED.paid_at,
      cancelled_at = EXCLUDED.cancelled_at,
      line_items = EXCLUDED.line_items,
      raw = EXCLUDED.raw,
      updated_at = now()
    RETURNING (xmax = 0) AS is_insert
  `;

  const inserted = result.filter((r: any) => r.is_insert).length;
  return { inserted, updated: result.length - inserted };
}

export async function POST(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File wajib diupload" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<ShopifyCsvRow>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      const fatal = parsed.errors.filter((e) => e.type !== "FieldMismatch");
      if (fatal.length > 0) {
        return NextResponse.json(
          { error: "Gagal parse CSV: " + fatal[0].message },
          { status: 400 }
        );
      }
    }

    const orders = groupShopifyRows(parsed.data);
    if (orders.length === 0) {
      return NextResponse.json({ error: "Tidak ada order yang bisa dibaca dari file ini" }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const chunk = orders.slice(i, i + CHUNK_SIZE);
      const r = await upsertChunk(chunk);
      inserted += r.inserted;
      updated += r.updated;
    }

    return NextResponse.json({
      success: true,
      total_rows_in_file: parsed.data.length,
      total_orders_found: orders.length,
      inserted,
      updated,
    });
  } catch (error) {
    console.error("Error importing Shopify CSV:", error);
    return NextResponse.json({ error: "Gagal import data" }, { status: 500 });
  }
}
