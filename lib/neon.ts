import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(process.env.DATABASE_URL);

let schemaReady: Promise<void> | null = null;

export function ensureCustomerSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS shopify_orders (
          id BIGSERIAL PRIMARY KEY,
          sales_order TEXT NOT NULL UNIQUE,
          order_id TEXT,
          email TEXT,
          phone TEXT,
          customer_name TEXT,
          financial_status TEXT,
          fulfillment_status TEXT,
          currency TEXT,
          subtotal NUMERIC,
          shipping NUMERIC,
          taxes NUMERIC,
          total NUMERIC,
          discount_code TEXT,
          discount_amount NUMERIC,
          location TEXT,
          store_name TEXT,
          source TEXT,
          payment_method TEXT,
          risk_level TEXT,
          tags TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ,
          paid_at TIMESTAMPTZ,
          cancelled_at TIMESTAMPTZ,
          line_items JSONB,
          raw JSONB,
          imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_shopify_orders_phone ON shopify_orders(phone)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_shopify_orders_store ON shopify_orders(store_name)`;

      await sql`
        CREATE TABLE IF NOT EXISTS customer_crm (
          store_name TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          followup BOOLEAN NOT NULL DEFAULT false,
          result TEXT,
          ket TEXT,
          link_url TEXT,
          update_by TEXT,
          update_at TEXT,
          PRIMARY KEY (store_name, phone_number)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS customer_badges (
          id BIGSERIAL PRIMARY KEY,
          badge_key TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          badge_type TEXT NOT NULL, -- 'tier' | 'bulk' | 'collection'
          logo_url TEXT,
          sku_list JSONB NOT NULL DEFAULT '[]',
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS customer_wa_followups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_number TEXT NOT NULL,
          store_name TEXT,
          analysis TEXT,
          message TEXT NOT NULL,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          sent_at TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_customer_wa_followups_phone ON customer_wa_followups(phone_number)`;

      // Seed the fixed rule-based badges once (tier & bulk) — their
      // thresholds are hardcoded in app logic, only label/logo are editable.
      // Collection badges (gundam, metro ride, etc.) are added by the admin
      // themselves via the badges management UI, not seeded here.
      await sql`
        INSERT INTO customer_badges (badge_key, label, badge_type, sort_order)
        VALUES
          ('new_customer', 'New Customer', 'tier', 1),
          ('potential_loyalist', 'Potential Loyalist', 'tier', 2),
          ('champion', 'Champion', 'tier', 3),
          ('bulk_order', 'Bulk Order', 'bulk', 4)
        ON CONFLICT (badge_key) DO NOTHING
      `;
    })();
  }
  return schemaReady;
}
