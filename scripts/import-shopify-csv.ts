// Impor CSV Shopify dari terminal (sama dengan /api/customer/import, tanpa batas upload).
// Pakai: npx tsx scripts/import-shopify-csv.ts file1.csv [file2.csv ...]
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import Papa from "papaparse";
import { groupShopifyRows, type ShopifyCsvRow, type NormalizedOrder } from "../lib/shopifyImport";

const CHUNK_SIZE = 300;

let sql: any;
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

(async () => {
  const neon = await import("../lib/neon");
  sql = neon.sql;
  await neon.ensureCustomerSchema();
  for (const f of process.argv.slice(2)) {
    const parsed = Papa.parse<ShopifyCsvRow>(readFileSync(f, "utf8"), { header: true, skipEmptyLines: true });
    const orders = groupShopifyRows(parsed.data);
    let ins = 0, upd = 0;
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const r = await upsertChunk(orders.slice(i, i + CHUNK_SIZE));
      ins += r.inserted; upd += r.updated;
    }
    console.log(f, "order:", orders.length, "baru:", ins, "diperbarui:", upd);
  }
  const s = await sql`select pg_size_pretty(pg_database_size(current_database())) s, (select count(*) from shopify_orders) n`;
  console.log("ukuran DB:", s[0].s, "| total order:", s[0].n);
  process.exit(0);
})();
