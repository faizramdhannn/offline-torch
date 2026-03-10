// ─── analyticsExport.ts ───────────────────────────────────────────────────────
// Drop this file at: lib/analyticsExport.ts
// Usage: import { exportStoreTab, exportTrafficTab, ... } from '@/lib/analyticsExport'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRupiahRaw(val: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
}

function parseSubtotal(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function cleanLocationName(loc: string | null | undefined): string {
  if (!loc) return "Unknown";
  return (
    loc
      .replace(/Torch Store\s*/i, "")
      .replace(/Torch\s*/i, "")
      .split(" - ")[0]
      .trim() || loc
  );
}

const TRAFFIC_MAP: Record<string, string> = {
  WG: "Whatsapp Group", TO: "Traffic Organic / Walk In", TT: "Teman",
  IO: "Instagram Official", IT: "Instagram Toko", KM: "Komunitas",
  TK: "Tiktok Official", MO: "Marketplace Official", MT: "Marketplace Toko",
  SG: "Searching Google", ET: "Event Torch", VT: "Voucher Torch",
  LB: "Liat Banyak yang Pakai", WS: "Webstore", AD: "Ads Promote",
  EM: "Email", WB: "Whatsapp Blast", PB: "Pernah Beli / Cust Lama",
  PH: "Perusahaan", DE: "Dari Eiger", KK: "Karyawan",
  DY: "Dealer Yamaha", TB: "T Banner",
};

function extractTrafficCode(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const upper = notes.trim().toUpperCase();
  const tokens = upper.split(/[\s,]+/).map((t) => t.replace(/[^A-Z]/g, "")).filter(Boolean);
  if (tokens.length === 0) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (TRAFFIC_MAP[token]) return token;
    if (token.length > 2) {
      const tail = token.slice(-2);
      if (TRAFFIC_MAP[tail]) return tail;
    }
  }
  return null;
}

// Download a CSV string as a file
function downloadCsv(csvContent: string, filename: string) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCell(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Row {
  Name?: string;
  "Created at"?: string;
  Subtotal?: string;
  Notes?: string;
  "Discount Code"?: string;
  "Discount Amount"?: string;
  "Lineitem name"?: string;
  "Lineitem quantity"?: string;
  "Lineitem price"?: string;
  Employee?: string;
  Location?: string;
  [key: string]: string | null | undefined;
}

// ─── TAB 1: Revenue per Store ─────────────────────────────────────────────────
// Rows: metric (Revenue, Orders, Avg/Order)
// Cols: Store A | Store B | Store C | ...
export function exportStoreTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
  const revenueMap: Record<string, number> = {};
  const orderMap: Record<string, Set<string>> = {};

  filteredRows.forEach((r) => {
    const store = cleanLocationName(r.Location);
    if (!orderMap[store]) orderMap[store] = new Set();
    if (r.Name) orderMap[store].add(r.Name);
    if (!orderSeen.has(r.Name || "")) {
      orderSeen.add(r.Name || "");
      revenueMap[store] = (revenueMap[store] || 0) + parseSubtotal(r.Subtotal);
    }
  });

  const stores = Object.keys(revenueMap).sort((a, b) =>
    revenueMap[b] - revenueMap[a]
  );

  const headerRow = ["Metrik", ...stores];
  const revenueRow = [
    "Revenue (IDR)",
    ...stores.map((s) => revenueMap[s] || 0),
  ];
  const ordersRow = [
    "Jumlah Order",
    ...stores.map((s) => orderMap[s]?.size || 0),
  ];
  const avgRow = [
    "Avg Revenue / Order (IDR)",
    ...stores.map((s) => {
      const orders = orderMap[s]?.size || 0;
      return orders > 0 ? Math.round((revenueMap[s] || 0) / orders) : 0;
    }),
  ];

  // Also add formatted rupiah rows
  const revenueRowFormatted = [
    "Revenue (Rp)",
    ...stores.map((s) => formatRupiahRaw(revenueMap[s] || 0)),
  ];
  const avgRowFormatted = [
    "Avg Revenue / Order (Rp)",
    ...stores.map((s) => {
      const orders = orderMap[s]?.size || 0;
      return orders > 0
        ? formatRupiahRaw(Math.round((revenueMap[s] || 0) / orders))
        : "-";
    }),
  ];

  const csv = buildCsv([
    headerRow,
    revenueRow,
    revenueRowFormatted,
    ordersRow,
    avgRow,
    avgRowFormatted,
  ]);

  downloadCsv(csv, `Analytics_Revenue_per_Store_${Date.now()}.csv`);
}

// ─── TAB 2: Traffic Source ────────────────────────────────────────────────────
// Rows: traffic source name
// Cols: Store A | Store B | ... | TOTAL
export function exportTrafficTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
  // map: store -> traffic_label -> count
  const storeTrafficMap: Record<string, Record<string, number>> = {};
  const allStores = new Set<string>();
  const allTraffics = new Set<string>();

  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (orderSeen.has(key)) return;
    orderSeen.add(key);

    const store = cleanLocationName(r.Location);
    allStores.add(store);

    const code = extractTrafficCode(r.Notes);
    const label = code ? (TRAFFIC_MAP[code] || code) : "Tidak Diketahui";
    allTraffics.add(label);

    if (!storeTrafficMap[store]) storeTrafficMap[store] = {};
    storeTrafficMap[store][label] = (storeTrafficMap[store][label] || 0) + 1;
  });

  const stores = [...allStores].sort();
  const traffics = [...allTraffics].sort((a, b) => {
    if (a === "Tidak Diketahui") return 1;
    if (b === "Tidak Diketahui") return -1;
    return a.localeCompare(b);
  });

  const headerRow = ["Traffic Source", ...stores, "TOTAL"];
  const dataRows = traffics.map((traffic) => {
    const storeCounts = stores.map((s) => storeTrafficMap[s]?.[traffic] || 0);
    const total = storeCounts.reduce((a, b) => a + b, 0);
    return [traffic, ...storeCounts, total];
  });

  // Totals row
  const totalsRow = [
    "TOTAL",
    ...stores.map((s) =>
      Object.values(storeTrafficMap[s] || {}).reduce((a, b) => a + b, 0)
    ),
    filteredRows.filter((r, i, arr) =>
      arr.findIndex((x) => x.Name === r.Name) === i && r.Name
    ).length,
  ];

  const csv = buildCsv([headerRow, ...dataRows, totalsRow]);
  downloadCsv(csv, `Analytics_Traffic_Source_${Date.now()}.csv`);
}

// ─── TAB 3: Discount Code ─────────────────────────────────────────────────────
// Rows: discount code
// Cols: Store A orders | Store A amount | Store B orders | Store B amount | ... | TOTAL orders | TOTAL amount
export function exportDiscountTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
  // map: store -> code -> { count, total }
  const storeDiscountMap: Record<string, Record<string, { count: number; total: number }>> = {};
  const allStores = new Set<string>();
  const allCodes = new Set<string>();

  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (orderSeen.has(key)) return;
    orderSeen.add(key);

    const store = cleanLocationName(r.Location);
    const code = r["Discount Code"]?.trim();
    if (!code) return;

    allStores.add(store);
    allCodes.add(code);

    if (!storeDiscountMap[store]) storeDiscountMap[store] = {};
    if (!storeDiscountMap[store][code]) storeDiscountMap[store][code] = { count: 0, total: 0 };
    storeDiscountMap[store][code].count += 1;
    storeDiscountMap[store][code].total += parseSubtotal(r["Discount Amount"]);
  });

  const stores = [...allStores].sort();
  const codes = [...allCodes].sort((a, b) => {
    // Sort by total usage desc
    const totalA = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[a]?.count || 0), 0);
    const totalB = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[b]?.count || 0), 0);
    return totalB - totalA;
  });

  // Header: Discount Code | StoreA Orders | StoreA Amount | StoreB Orders | ...| TOTAL Orders | TOTAL Amount
  const storeHeaders = stores.flatMap((s) => [`${s} - Pakai`, `${s} - Potongan (IDR)`]);
  const headerRow = ["Discount Code", ...storeHeaders, "TOTAL Pakai", "TOTAL Potongan (IDR)"];

  const dataRows = codes.map((code) => {
    const storeCells = stores.flatMap((s) => [
      storeDiscountMap[s]?.[code]?.count || 0,
      storeDiscountMap[s]?.[code]?.total || 0,
    ]);
    const totalCount = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[code]?.count || 0), 0);
    const totalAmount = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[code]?.total || 0), 0);
    return [code, ...storeCells, totalCount, totalAmount];
  });

  const csv = buildCsv([headerRow, ...dataRows]);
  downloadCsv(csv, `Analytics_Discount_Code_${Date.now()}.csv`);
}

// ─── TAB 4: Product Sales ─────────────────────────────────────────────────────
// Rows: product name
// Cols: Store A qty | Store A revenue | Store B qty | ... | TOTAL qty | TOTAL revenue
export function exportProductTab(filteredRows: Row[]) {
  // map: store -> product -> { qty, revenue }
  const storeProductMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};
  const allStores = new Set<string>();
  const allProducts = new Set<string>();

  filteredRows.forEach((r) => {
    const store = cleanLocationName(r.Location);
    const name = r["Lineitem name"]?.trim();
    if (!name) return;

    allStores.add(store);
    allProducts.add(name);

    const qty = parseInt(r["Lineitem quantity"] || "1") || 1;
    const price = parseSubtotal(r["Lineitem price"]);

    if (!storeProductMap[store]) storeProductMap[store] = {};
    if (!storeProductMap[store][name]) storeProductMap[store][name] = { qty: 0, revenue: 0 };
    storeProductMap[store][name].qty += qty;
    storeProductMap[store][name].revenue += price * qty;
  });

  const stores = [...allStores].sort();
  const products = [...allProducts].sort((a, b) => {
    const totalA = stores.reduce((s, st) => s + (storeProductMap[st]?.[a]?.qty || 0), 0);
    const totalB = stores.reduce((s, st) => s + (storeProductMap[st]?.[b]?.qty || 0), 0);
    return totalB - totalA;
  });

  const storeHeaders = stores.flatMap((s) => [`${s} - Qty`, `${s} - Revenue (IDR)`]);
  const headerRow = ["Produk", ...storeHeaders, "TOTAL Qty", "TOTAL Revenue (IDR)"];

  const dataRows = products.map((product) => {
    const storeCells = stores.flatMap((s) => [
      storeProductMap[s]?.[product]?.qty || 0,
      storeProductMap[s]?.[product]?.revenue || 0,
    ]);
    const totalQty = stores.reduce((s, st) => s + (storeProductMap[st]?.[product]?.qty || 0), 0);
    const totalRev = stores.reduce((s, st) => s + (storeProductMap[st]?.[product]?.revenue || 0), 0);
    return [product, ...storeCells, totalQty, totalRev];
  });

  const csv = buildCsv([headerRow, ...dataRows]);
  downloadCsv(csv, `Analytics_Product_Sales_${Date.now()}.csv`);
}

// ─── TAB 5: Employee ──────────────────────────────────────────────────────────
// Rows: employee name
// Cols: Store A orders | Store A revenue | Store B orders | ... | TOTAL orders | TOTAL revenue
export function exportEmployeeTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
  // map: store -> employee -> { orders: Set, subtotal }
  const storeEmpMap: Record<string, Record<string, { orders: Set<string>; subtotal: number }>> = {};
  const allStores = new Set<string>();
  const allEmps = new Set<string>();

  filteredRows.forEach((r) => {
    const store = cleanLocationName(r.Location);
    const emp = r.Employee?.trim();
    if (!emp) return;

    allStores.add(store);
    allEmps.add(emp);

    if (!storeEmpMap[store]) storeEmpMap[store] = {};
    if (!storeEmpMap[store][emp]) storeEmpMap[store][emp] = { orders: new Set(), subtotal: 0 };
    if (r.Name) storeEmpMap[store][emp].orders.add(r.Name);
    if (!orderSeen.has(r.Name || "")) {
      orderSeen.add(r.Name || "");
      storeEmpMap[store][emp].subtotal += parseSubtotal(r.Subtotal);
    }
  });

  const stores = [...allStores].sort();
  const emps = [...allEmps].sort((a, b) => {
    const totalA = stores.reduce((s, st) => s + (storeEmpMap[st]?.[a]?.subtotal || 0), 0);
    const totalB = stores.reduce((s, st) => s + (storeEmpMap[st]?.[b]?.subtotal || 0), 0);
    return totalB - totalA;
  });

  const storeHeaders = stores.flatMap((s) => [`${s} - Orders`, `${s} - Revenue (IDR)`]);
  const headerRow = ["Karyawan", ...storeHeaders, "TOTAL Orders", "TOTAL Revenue (IDR)"];

  const dataRows = emps.map((emp) => {
    const storeCells = stores.flatMap((s) => [
      storeEmpMap[s]?.[emp]?.orders.size || 0,
      storeEmpMap[s]?.[emp]?.subtotal || 0,
    ]);
    const totalOrders = stores.reduce((s, st) => s + (storeEmpMap[st]?.[emp]?.orders.size || 0), 0);
    const totalRev = stores.reduce((s, st) => s + (storeEmpMap[st]?.[emp]?.subtotal || 0), 0);
    return [emp, ...storeCells, totalOrders, totalRev];
  });

  const csv = buildCsv([headerRow, ...dataRows]);
  downloadCsv(csv, `Analytics_Employee_${Date.now()}.csv`);
}