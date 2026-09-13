export interface ShopifyCsvRow {
  [key: string]: string;
}

export interface NormalizedOrder {
  sales_order: string;
  order_id: string;
  email: string;
  phone: string;
  customer_name: string;
  financial_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal: number | null;
  shipping: number | null;
  taxes: number | null;
  total: number | null;
  discount_code: string;
  discount_amount: number | null;
  location: string;
  store_name: string;
  source: string;
  payment_method: string;
  risk_level: string;
  tags: string;
  notes: string;
  created_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  line_items: { name: string; sku: string; quantity: number; price: number | null }[];
  raw: ShopifyCsvRow;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function ts(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Mapping eksplisit dari Location (kolom Shopify) ke nama pendek yang dipakai
// di seluruh app — didefinisikan langsung oleh user (bukan hasil tebak-tebakan
// regex), termasuk toko utama, bazar/pameran, dan department store partner
// (Gramedia/Neka/Vega/Margo City digabung jadi satu grup "Dept Store").
const STORE_NAME_MAP: Record<string, string> = {
  "Torch Store Pekalongan - Jawa Tengah": "Pekalongan",
  "Torch Store Surabaya - Jawa Timur": "Surabaya",
  "Torch Store Margonda - Depok": "Margonda",
  "Bazar KBR Bogor": "KBR Bogor",
  "Torch Store Lampung - Lampung": "Lampung",
  "Torch Store Karawang - Karawang": "Karawang",
  "Torch Store Cirebon - Cirebon": "Cirebon",
  "Torch Store Purwokerto - Jawa Tengah": "Purwokerto",
  "Pameran Metro TSM Bandung": "Metro TSM",
  "Torch Store Jogja - Jogja": "Jogja",
  "Torch Store Lembong - Bandung": "Lembong",
  "Bazar ITC Depok": "ITC Depok",
  "Torch Gramedia Botani Square": "Dept Store",
  "Torch Gramedia Sam Ratulangi": "Dept Store",
  "Torch Gramedia Gajah Mada": "Dept Store",
  "Torch Gramedia Pandanaran": "Dept Store",
  "Torch Vega Toys & Hobbies": "Dept Store",
  "Torch Neka Meruyung": "Dept Store",
  "Torch Neka Condet": "Dept Store",
  "Torch Neka Ciputat": "Dept Store",
  "Torch Neka Bogor": "Dept Store",
  "Bazar IP Bandung": "IP Bandung",
  "Pameran Yogya Kepatihan": "Dept Store",
  "Pameran Margo City": "Dept Store",
  "Torch Store Makassar - Makassar": "Makassar",
  "Torch Store Karawaci - Tangerang": "Karawaci",
  "Torch Store Medan - Medan": "Medan",
  "Torch Store Malang - Malang": "Malang",
  "Torch Store Tambun - Bekasi": "Tambun",
  "Bazar Lembong": "Lembong",
};

export function normalizeStoreName(location: string): string {
  if (!location) return "";
  const trimmed = location.trim();
  if (STORE_NAME_MAP[trimmed]) return STORE_NAME_MAP[trimmed];
  // Fallback untuk location yang belum terdaftar di STORE_NAME_MAP (mis. toko
  // baru yang belum sempat didefinisikan) — tetap coba pola "Torch Store X - Y".
  const m = trimmed.match(/^Torch Store ([^-]+?)\s*-/i);
  if (m) return m[1].trim();
  return trimmed;
}

export function groupShopifyRows(rows: ShopifyCsvRow[]): NormalizedOrder[] {
  const byOrder = new Map<string, ShopifyCsvRow[]>();
  rows.forEach((row) => {
    const name = row["Name"]?.trim();
    if (!name) return;
    if (!byOrder.has(name)) byOrder.set(name, []);
    byOrder.get(name)!.push(row);
  });

  const orders: NormalizedOrder[] = [];
  byOrder.forEach((group, salesOrder) => {
    // The order-level fields (Id, Total, Email, etc.) are only populated on
    // the first CSV row of the order — subsequent rows only carry line-item
    // fields. Fall back to the first row if none has an Id.
    const head = group.find((r) => r["Id"]?.trim()) || group[0];
    const location = head["Location"] || "";
    const phone =
      head["Phone"]?.trim() || head["Billing Phone"]?.trim() || head["Shipping Phone"]?.trim() || "";
    const customerName = head["Billing Name"]?.trim() || head["Shipping Name"]?.trim() || "";

    const lineItems = group
      .filter((r) => r["Lineitem name"]?.trim())
      .map((r) => ({
        name: r["Lineitem name"] || "",
        sku: r["Lineitem sku"] || "",
        quantity: num(r["Lineitem quantity"]) || 0,
        price: num(r["Lineitem price"]),
      }));

    orders.push({
      sales_order: salesOrder,
      order_id: head["Id"] || "",
      email: head["Email"] || "",
      phone,
      customer_name: customerName,
      financial_status: head["Financial Status"] || "",
      fulfillment_status: head["Fulfillment Status"] || "",
      currency: head["Currency"] || "",
      subtotal: num(head["Subtotal"]),
      shipping: num(head["Shipping"]),
      taxes: num(head["Taxes"]),
      total: num(head["Total"]),
      discount_code: head["Discount Code"] || "",
      discount_amount: num(head["Discount Amount"]),
      location,
      store_name: normalizeStoreName(location),
      source: head["Source"] || "",
      payment_method: head["Payment Method"] || "",
      risk_level: head["Risk Level"] || "",
      tags: head["Tags"] || "",
      notes: head["Notes"] || "",
      created_at: ts(head["Created at"]),
      paid_at: ts(head["Paid at"]),
      cancelled_at: ts(head["Cancelled at"]),
      line_items: lineItems,
      raw: head,
    });
  });

  return orders;
}
