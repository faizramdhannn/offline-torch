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

let jastiperSchemaReady: Promise<void> | null = null;

export function ensureJastiperSchema(): Promise<void> {
  if (!jastiperSchemaReady) {
    jastiperSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS jastiper_master (
          uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          jastiper_name TEXT NOT NULL DEFAULT '',
          jastiper_phone_number TEXT NOT NULL DEFAULT '',
          jastiper_phone_normalized TEXT NOT NULL DEFAULT '',
          jastiper_respond TEXT NOT NULL DEFAULT '',
          jastiper_store TEXT NOT NULL DEFAULT '',
          jastiper_code TEXT NOT NULL DEFAULT '',
          jastiper_status TEXT NOT NULL DEFAULT 'Active',
          notes TEXT NOT NULL DEFAULT '',
          social_media TEXT NOT NULL DEFAULT '',
          social_media_username TEXT NOT NULL DEFAULT '',
          created_by TEXT DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          update_by TEXT DEFAULT '',
          update_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Tabel jastiper_master sudah ada di production sebelum kolom notes
      // ditambahkan — ALTER ini yang memastikan kolomnya muncul di DB lama.
      await sql`ALTER TABLE jastiper_master ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE jastiper_master ADD COLUMN IF NOT EXISTS social_media TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE jastiper_master ADD COLUMN IF NOT EXISTS social_media_username TEXT NOT NULL DEFAULT ''`;
      await sql`CREATE INDEX IF NOT EXISTS idx_jastiper_store ON jastiper_master(jastiper_store)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_jastiper_code ON jastiper_master(jastiper_code)`;
      // Cegah duplikat import ulang CSV master data yang sama (per toko + no
      // HP ternormalisasi) — hanya berlaku kalau HP-nya terisi, supaya baris
      // tanpa HP (ada beberapa di data awal) tetap bisa masuk semua.
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uidx_jastiper_store_phone
        ON jastiper_master(jastiper_store, jastiper_phone_normalized)
        WHERE jastiper_phone_normalized <> ''
      `;
      // Cegah 2 jastiper di toko yang sama kebagian jastiper_code yang sama
      // persis — bisa kejadian kalau nomor HP mereka berakhiran 2 digit yang
      // sama (format kode cuma pakai 2 digit terakhir). API akan auto-resolve
      // tabrakan ini dengan tambah akhiran huruf sebelum insert/update, index
      // ini jadi pengaman terakhir di level DB.
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uidx_jastiper_store_code
        ON jastiper_master(jastiper_store, jastiper_code)
        WHERE jastiper_code <> ''
      `;
    })();
  }
  return jastiperSchemaReady;
}

let announcementSchemaReady: Promise<void> | null = null;

export function ensureAnnouncementSchema(): Promise<void> {
  if (!announcementSchemaReady) {
    announcementSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_announcement (
          id INT PRIMARY KEY DEFAULT 1,
          message TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          update_by TEXT DEFAULT '',
          update_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT app_announcement_singleton CHECK (id = 1)
        )
      `;
      // Baris tunggal (id selalu 1) — announcement bar cuma butuh satu pesan
      // aktif sekaligus, bukan daftar/riwayat.
      await sql`
        INSERT INTO app_announcement (id, message, active)
        VALUES (1, '', false)
        ON CONFLICT (id) DO NOTHING
      `;
      // Gambar opsional + label tombol untuk buka popup gambar itu (mis.
      // "Klik", "Link") — ditambahkan belakangan, kolom lama di production
      // butuh ALTER supaya tetap ada.
      await sql`ALTER TABLE app_announcement ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE app_announcement ADD COLUMN IF NOT EXISTS link_text TEXT NOT NULL DEFAULT ''`;
    })();
  }
  return announcementSchemaReady;
}
