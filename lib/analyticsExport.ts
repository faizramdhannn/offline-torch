// ─── analyticsExport.ts ───────────────────────────────────────────────────────
// Usage: import { exportStoreTab, exportTrafficTab, ... } from '@/lib/analyticsExport'
// Requires: xlsx (SheetJS) — npm install xlsx

import * as XLSX from "xlsx";

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
  DY: "Dealer Yamaha", TB: "T Banner", TS: "Tiktok Store",
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

// ─── XLSX download helper ─────────────────────────────────────────────────────
function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  const stores = Object.keys(revenueMap).sort((a, b) => revenueMap[b] - revenueMap[a]);

  // Sheet 1: Summary per store
  const summaryData = [
    ["Store", "Jumlah Order", "Revenue (IDR)", "Revenue (Rp)", "Avg/Order (IDR)", "Avg/Order (Rp)"],
    ...stores.map((s) => {
      const orders = orderMap[s]?.size || 0;
      const rev = revenueMap[s] || 0;
      const avg = orders > 0 ? Math.round(rev / orders) : 0;
      return [s, orders, rev, formatRupiahRaw(rev), avg, orders > 0 ? formatRupiahRaw(avg) : "-"];
    }),
  ];

  // Sheet 2: Daily revenue per store
  const dailyMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (dailySeen.has(key)) return;
    dailySeen.add(key);
    const store = cleanLocationName(r.Location);
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    if (!dailyMap[date]) dailyMap[date] = {};
    dailyMap[date][store] = (dailyMap[date][store] || 0) + parseSubtotal(r.Subtotal);
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    ["Tanggal", ...stores],
    ...sortedDates.map((d) => [d, ...stores.map((s) => dailyMap[d]?.[s] || 0)]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary per Store");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Revenue per Store");
  downloadXlsx(wb, `Analytics_Revenue_per_Store_${Date.now()}.xlsx`);
}

// ─── TAB 2: Traffic Source ────────────────────────────────────────────────────
export function exportTrafficTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
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

  const summaryData = [
    ["Traffic Source", ...stores, "TOTAL"],
    ...traffics.map((t) => {
      const counts = stores.map((s) => storeTrafficMap[s]?.[t] || 0);
      return [t, ...counts, counts.reduce((a, b) => a + b, 0)];
    }),
    ["TOTAL", ...stores.map((s) => Object.values(storeTrafficMap[s] || {}).reduce((a, b) => a + b, 0)),
      [...orderSeen].length],
  ];

  // Daily traffic trend
  const dailyTrafficMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (dailySeen.has(key)) return;
    dailySeen.add(key);
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    const code = extractTrafficCode(r.Notes);
    const label = code ? (TRAFFIC_MAP[code] || code) : "Tidak Diketahui";
    if (!dailyTrafficMap[date]) dailyTrafficMap[date] = {};
    dailyTrafficMap[date][label] = (dailyTrafficMap[date][label] || 0) + 1;
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    ["Tanggal", ...traffics],
    ...sortedDates.map((d) => [d, ...traffics.map((t) => dailyTrafficMap[d]?.[t] || 0)]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Traffic per Store");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Traffic Trend");
  downloadXlsx(wb, `Analytics_Traffic_Source_${Date.now()}.xlsx`);
}

// ─── TAB 3: Discount Code ─────────────────────────────────────────────────────
export function exportDiscountTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
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
    const totalA = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[a]?.count || 0), 0);
    const totalB = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[b]?.count || 0), 0);
    return totalB - totalA;
  });

  const storeHeaders = stores.flatMap((s) => [`${s} - Pakai`, `${s} - Potongan (IDR)`]);
  const summaryData = [
    ["Discount Code", ...storeHeaders, "TOTAL Pakai", "TOTAL Potongan (IDR)"],
    ...codes.map((code) => {
      const cells = stores.flatMap((s) => [
        storeDiscountMap[s]?.[code]?.count || 0,
        storeDiscountMap[s]?.[code]?.total || 0,
      ]);
      const totalCount = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[code]?.count || 0), 0);
      const totalAmt = stores.reduce((s, st) => s + (storeDiscountMap[st]?.[code]?.total || 0), 0);
      return [code, ...cells, totalCount, totalAmt];
    }),
  ];

  // Daily discount usage
  const dailyDiscountMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (dailySeen.has(key)) return;
    dailySeen.add(key);
    const code = r["Discount Code"]?.trim();
    if (!code) return;
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    if (!dailyDiscountMap[date]) dailyDiscountMap[date] = {};
    dailyDiscountMap[date][code] = (dailyDiscountMap[date][code] || 0) + 1;
  });

  const sortedDates = [...allDates].sort();
  const topCodes = codes.slice(0, 10);
  const dailyData = [
    ["Tanggal", ...topCodes, "Total Discount Hari Ini"],
    ...sortedDates.map((d) => {
      const counts = topCodes.map((c) => dailyDiscountMap[d]?.[c] || 0);
      return [d, ...counts, counts.reduce((a, b) => a + b, 0)];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Discount per Store");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Discount Trend");
  downloadXlsx(wb, `Analytics_Discount_Code_${Date.now()}.xlsx`);
}

// ─── TAB 4: Product Sales ─────────────────────────────────────────────────────
export function exportProductTab(filteredRows: Row[]) {
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
  const summaryData = [
    ["Produk", ...storeHeaders, "TOTAL Qty", "TOTAL Revenue (IDR)"],
    ...products.map((p) => {
      const cells = stores.flatMap((s) => [
        storeProductMap[s]?.[p]?.qty || 0,
        storeProductMap[s]?.[p]?.revenue || 0,
      ]);
      const totalQty = stores.reduce((s, st) => s + (storeProductMap[st]?.[p]?.qty || 0), 0);
      const totalRev = stores.reduce((s, st) => s + (storeProductMap[st]?.[p]?.revenue || 0), 0);
      return [p, ...cells, totalQty, totalRev];
    }),
  ];

  // Daily product sales (top 10 products)
  const dailyProductMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  filteredRows.forEach((r) => {
    const name = r["Lineitem name"]?.trim();
    if (!name) return;
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    const qty = parseInt(r["Lineitem quantity"] || "1") || 1;
    if (!dailyProductMap[date]) dailyProductMap[date] = {};
    dailyProductMap[date][name] = (dailyProductMap[date][name] || 0) + qty;
  });

  const sortedDates = [...allDates].sort();
  const topProducts = products.slice(0, 10);
  const dailyData = [
    ["Tanggal", ...topProducts, "Total Qty Hari Ini"],
    ...sortedDates.map((d) => {
      const counts = topProducts.map((p) => dailyProductMap[d]?.[p] || 0);
      return [d, ...counts, counts.reduce((a, b) => a + b, 0)];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Product per Store");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Product Trend");
  downloadXlsx(wb, `Analytics_Product_Sales_${Date.now()}.xlsx`);
}

// ─── TAB 5: Employee ──────────────────────────────────────────────────────────
export function exportEmployeeTab(filteredRows: Row[]) {
  const orderSeen = new Set<string>();
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
  const summaryData = [
    ["Karyawan", ...storeHeaders, "TOTAL Orders", "TOTAL Revenue (IDR)"],
    ...emps.map((emp) => {
      const cells = stores.flatMap((s) => [
        storeEmpMap[s]?.[emp]?.orders.size || 0,
        storeEmpMap[s]?.[emp]?.subtotal || 0,
      ]);
      const totalOrders = stores.reduce((s, st) => s + (storeEmpMap[st]?.[emp]?.orders.size || 0), 0);
      const totalRev = stores.reduce((s, st) => s + (storeEmpMap[st]?.[emp]?.subtotal || 0), 0);
      return [emp, ...cells, totalOrders, totalRev];
    }),
  ];

  // Daily employee revenue trend
  const dailyEmpMap: Record<string, Record<string, { orders: Set<string>; revenue: number }>> = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const emp = r.Employee?.trim();
    if (!emp) return;
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    if (!dailyEmpMap[date]) dailyEmpMap[date] = {};
    if (!dailyEmpMap[date][emp]) dailyEmpMap[date][emp] = { orders: new Set(), revenue: 0 };
    if (r.Name) dailyEmpMap[date][emp].orders.add(r.Name);
    if (!dailySeen.has(`${date}__${r.Name || ""}`)) {
      dailySeen.add(`${date}__${r.Name || ""}`);
      dailyEmpMap[date][emp].revenue += parseSubtotal(r.Subtotal);
    }
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    ["Tanggal", ...emps.map((e) => `${e} - Revenue`), "Total Revenue Hari Ini"],
    ...sortedDates.map((d) => {
      const revenues = emps.map((e) => dailyEmpMap[d]?.[e]?.revenue || 0);
      return [d, ...revenues, revenues.reduce((a, b) => a + b, 0)];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Employee per Store");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), "Daily Employee Trend");
  downloadXlsx(wb, `Analytics_Employee_${Date.now()}.xlsx`);
}