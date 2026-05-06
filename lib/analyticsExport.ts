// ─── analyticsExport.ts ───────────────────────────────────────────────────────
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

function extractTrafficCode(
  notes: string | null | undefined,
  trafficMap: Record<string, string>
): string | null {
  if (!notes) return null;
  const upper = notes.trim().toUpperCase();
  const tokens = upper
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^A-Z]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (trafficMap[token]) return token;
    if (token.length > 2) {
      const tail = token.slice(-2);
      if (trafficMap[tail]) return tail;
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
  "Paid at"?: string;
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
export function exportStoreTab(
  filteredRows: Row[],
  trafficMap: Record<string, string> = {}
) {
  const orderSeen = new Set<string>();
  const revenueMap: Record<string, number> = {};
  const orderMap: Record<string, Set<string>> = {};
  // NEW: discount tracking per store
  const discountOrderMap: Record<string, Set<string>> = {};
  const discountAmountMap: Record<string, number> = {};

  filteredRows.forEach((r) => {
    const store = cleanLocationName(r.Location);
    if (!orderMap[store]) orderMap[store] = new Set();
    if (!discountOrderMap[store]) discountOrderMap[store] = new Set();
    if (r.Name) orderMap[store].add(r.Name);

    if (!orderSeen.has(r.Name || "")) {
      orderSeen.add(r.Name || "");
      revenueMap[store] = (revenueMap[store] || 0) + parseSubtotal(r.Subtotal);

      // track discount per store
      if (r["Discount Code"]?.trim() && r.Name) {
        discountOrderMap[store].add(r.Name);
        discountAmountMap[store] =
          (discountAmountMap[store] || 0) + parseSubtotal(r["Discount Amount"]);
      }
    }
  });

  const stores = Object.keys(revenueMap).sort(
    (a, b) => revenueMap[b] - revenueMap[a]
  );

  // Sheet 1: Summary per store — matches frontend table columns + discount cols
  const summaryData = [
    [
      "Store",
      "Jumlah Order",
      "Revenue (IDR)",
      "Revenue (Rp)",
      "Avg/Order (IDR)",
      "Avg/Order (Rp)",
      "Pakai Discount (Order)",
      "% Pakai Discount",
      "Total Potongan (IDR)",
      "Total Potongan (Rp)",
    ],
    ...stores.map((s) => {
      const orders = orderMap[s]?.size || 0;
      const rev = revenueMap[s] || 0;
      const avg = orders > 0 ? Math.round(rev / orders) : 0;
      const discOrders = discountOrderMap[s]?.size || 0;
      const discAmt = discountAmountMap[s] || 0;
      const discPct =
        orders > 0 ? `${((discOrders / orders) * 100).toFixed(1)}%` : "-";
      return [
        s,
        orders,
        rev,
        formatRupiahRaw(rev),
        avg,
        orders > 0 ? formatRupiahRaw(avg) : "-",
        discOrders,
        discPct,
        discAmt,
        discAmt > 0 ? formatRupiahRaw(discAmt) : "-",
      ];
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
    dailyMap[date][store] =
      (dailyMap[date][store] || 0) + parseSubtotal(r.Subtotal);
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    ["Tanggal", ...stores],
    ...sortedDates.map((d) => [
      d,
      ...stores.map((s) => dailyMap[d]?.[s] || 0),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryData),
    "Summary per Store"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailyData),
    "Daily Revenue per Store"
  );
  downloadXlsx(wb, `Analytics_Revenue_per_Store_${Date.now()}.xlsx`);
}

// ─── TAB 2: Traffic Source ────────────────────────────────────────────────────
export function exportTrafficTab(
  filteredRows: Row[],
  trafficMap: Record<string, string> = {}
) {
  const orderSeen = new Set<string>();
  const storeTrafficMap: Record<
    string,
    Record<string, { count: number; subtotal: number }>
  > = {};
  const allStores = new Set<string>();
  const allTraffics = new Set<string>();

  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (orderSeen.has(key)) return;
    orderSeen.add(key);
    const store = cleanLocationName(r.Location);
    allStores.add(store);
    const code = extractTrafficCode(r.Notes, trafficMap);
    // Use trafficMap from frontend (not hardcoded)
    const label = code ? trafficMap[code] || code : "Tidak Diketahui";
    allTraffics.add(label);
    if (!storeTrafficMap[store]) storeTrafficMap[store] = {};
    if (!storeTrafficMap[store][label])
      storeTrafficMap[store][label] = { count: 0, subtotal: 0 };
    storeTrafficMap[store][label].count += 1;
    storeTrafficMap[store][label].subtotal += parseSubtotal(r.Subtotal);
  });

  const stores = [...allStores].sort();
  const traffics = [...allTraffics].sort((a, b) => {
    if (a === "Tidak Diketahui") return 1;
    if (b === "Tidak Diketahui") return -1;
    // sort by total order count descending — matches frontend table order
    const totalA = stores.reduce(
      (s, st) => s + (storeTrafficMap[st]?.[a]?.count || 0),
      0
    );
    const totalB = stores.reduce(
      (s, st) => s + (storeTrafficMap[st]?.[b]?.count || 0),
      0
    );
    return totalB - totalA;
  });

  const totalAllOrders = [...orderSeen].length;

  // Sheet 1: Traffic summary — matches frontend: Jumlah Order, Total Revenue, Avg/Order, Persentase
  const summaryData = [
    [
      "Traffic Source",
      "Jumlah Order",
      "Total Revenue (IDR)",
      "Total Revenue (Rp)",
      "Avg/Order (IDR)",
      "Avg/Order (Rp)",
      "Persentase (%)",
      ...stores,
    ],
    ...traffics.map((t) => {
      const totalCount = stores.reduce(
        (s, st) => s + (storeTrafficMap[st]?.[t]?.count || 0),
        0
      );
      const totalSub = stores.reduce(
        (s, st) => s + (storeTrafficMap[st]?.[t]?.subtotal || 0),
        0
      );
      const avg = totalCount > 0 ? Math.round(totalSub / totalCount) : 0;
      const pct =
        totalAllOrders > 0
          ? `${((totalCount / totalAllOrders) * 100).toFixed(1)}%`
          : "-";
      const perStoreCounts = stores.map(
        (s) => storeTrafficMap[s]?.[t]?.count || 0
      );
      return [
        t,
        totalCount,
        totalSub,
        formatRupiahRaw(totalSub),
        avg,
        totalCount > 0 ? formatRupiahRaw(avg) : "-",
        pct,
        ...perStoreCounts,
      ];
    }),
    // TOTAL row
    [
      "TOTAL",
      totalAllOrders,
      "",
      "",
      "",
      "",
      "100%",
      ...stores.map((s) =>
        Object.values(storeTrafficMap[s] || {}).reduce(
          (a, b) => a + b.count,
          0
        )
      ),
    ],
  ];

  // Sheet 2: Daily traffic trend
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
    const code = extractTrafficCode(r.Notes, trafficMap);
    const label = code ? trafficMap[code] || code : "Tidak Diketahui";
    if (!dailyTrafficMap[date]) dailyTrafficMap[date] = {};
    dailyTrafficMap[date][label] =
      (dailyTrafficMap[date][label] || 0) + 1;
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    ["Tanggal", ...traffics],
    ...sortedDates.map((d) => [
      d,
      ...traffics.map((t) => dailyTrafficMap[d]?.[t] || 0),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryData),
    "Traffic per Store"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailyData),
    "Daily Traffic Trend"
  );
  downloadXlsx(wb, `Analytics_Traffic_Source_${Date.now()}.xlsx`);
}

// ─── TAB 3: Discount Code ─────────────────────────────────────────────────────
export function exportDiscountTab(
  filteredRows: Row[],
  trafficMap: Record<string, string> = {}
) {
  const orderSeen = new Set<string>();
  // Now track count, discount amount, AND subtotal/revenue — matches frontend
  const discountSummary: Record<
    string,
    { count: number; discountTotal: number; subtotal: number }
  > = {};
  // Per-store breakdown
  const storeDiscountMap: Record<
    string,
    Record<
      string,
      { count: number; discountTotal: number; subtotal: number }
    >
  > = {};
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

    const discAmt = parseSubtotal(r["Discount Amount"]);
    const sub = parseSubtotal(r.Subtotal);

    // global summary
    if (!discountSummary[code])
      discountSummary[code] = { count: 0, discountTotal: 0, subtotal: 0 };
    discountSummary[code].count += 1;
    discountSummary[code].discountTotal += discAmt;
    discountSummary[code].subtotal += sub;

    // per-store
    if (!storeDiscountMap[store]) storeDiscountMap[store] = {};
    if (!storeDiscountMap[store][code])
      storeDiscountMap[store][code] = {
        count: 0,
        discountTotal: 0,
        subtotal: 0,
      };
    storeDiscountMap[store][code].count += 1;
    storeDiscountMap[store][code].discountTotal += discAmt;
    storeDiscountMap[store][code].subtotal += sub;
  });

  const stores = [...allStores].sort();
  // sort by count descending — matches frontend
  const codes = [...allCodes].sort(
    (a, b) =>
      (discountSummary[b]?.count || 0) - (discountSummary[a]?.count || 0)
  );

  // Sheet 1: Summary — matches frontend columns exactly
  // Frontend: Discount Code | Dipakai (Order) | Total Revenue | Total Potongan | Avg Revenue/Order
  const summaryData = [
    [
      "Discount Code",
      "Dipakai (Order)",
      "Total Revenue (IDR)",
      "Total Revenue (Rp)",
      "Total Potongan (IDR)",
      "Total Potongan (Rp)",
      "Avg Revenue/Order (IDR)",
      "Avg Revenue/Order (Rp)",
    ],
    ...codes.map((code) => {
      const d = discountSummary[code] || {
        count: 0,
        discountTotal: 0,
        subtotal: 0,
      };
      const avg = d.count > 0 ? Math.round(d.subtotal / d.count) : 0;
      return [
        code,
        d.count,
        d.subtotal,
        formatRupiahRaw(d.subtotal),
        d.discountTotal,
        d.discountTotal > 0 ? formatRupiahRaw(d.discountTotal) : "-",
        avg,
        d.count > 0 ? formatRupiahRaw(avg) : "-",
      ];
    }),
  ];

  // Sheet 2: Per-store breakdown
  const storeHeaders = stores.flatMap((s) => [
    `${s} - Pakai`,
    `${s} - Revenue (IDR)`,
    `${s} - Potongan (IDR)`,
  ]);
  const perStoreData = [
    [
      "Discount Code",
      ...storeHeaders,
      "TOTAL Pakai",
      "TOTAL Revenue (IDR)",
      "TOTAL Potongan (IDR)",
    ],
    ...codes.map((code) => {
      const cells = stores.flatMap((s) => [
        storeDiscountMap[s]?.[code]?.count || 0,
        storeDiscountMap[s]?.[code]?.subtotal || 0,
        storeDiscountMap[s]?.[code]?.discountTotal || 0,
      ]);
      const d = discountSummary[code];
      return [code, ...cells, d.count, d.subtotal, d.discountTotal];
    }),
  ];

  // Sheet 3: Daily discount usage trend
  const dailyTotalMap: Record<string, number> = {};
  const dailyDiscountMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const key = r.Name || "";
    if (dailySeen.has(key)) return;
    dailySeen.add(key);
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    dailyTotalMap[date] = (dailyTotalMap[date] || 0) + 1;
    const code = r["Discount Code"]?.trim();
    if (!code) return;
    if (!dailyDiscountMap[date]) dailyDiscountMap[date] = {};
    dailyDiscountMap[date][code] =
      (dailyDiscountMap[date][code] || 0) + 1;
  });

  const sortedDates = [...allDates].sort();
  const topCodes = codes.slice(0, 10);
  const dailyData = [
    ["Tanggal", "Total Order", "Pakai Discount", ...topCodes],
    ...sortedDates.map((d) => {
      const discTotal = Object.values(dailyDiscountMap[d] || {}).reduce(
        (a, b) => a + b,
        0
      );
      const counts = topCodes.map((c) => dailyDiscountMap[d]?.[c] || 0);
      return [d, dailyTotalMap[d] || 0, discTotal, ...counts];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryData),
    "Summary Discount"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(perStoreData),
    "Discount per Store"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailyData),
    "Daily Discount Trend"
  );
  downloadXlsx(wb, `Analytics_Discount_Code_${Date.now()}.xlsx`);
}

// ─── TAB 4: Product Sales ─────────────────────────────────────────────────────
export function exportProductTab(
  filteredRows: Row[],
  trafficMap: Record<string, string> = {}
) {
  const storeProductMap: Record<
    string,
    Record<string, { qty: number; revenue: number }>
  > = {};
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
    if (!storeProductMap[store][name])
      storeProductMap[store][name] = { qty: 0, revenue: 0 };
    storeProductMap[store][name].qty += qty;
    storeProductMap[store][name].revenue += price * qty;
  });

  const stores = [...allStores].sort();
  const products = [...allProducts].sort((a, b) => {
    const totalA = stores.reduce(
      (s, st) => s + (storeProductMap[st]?.[a]?.qty || 0),
      0
    );
    const totalB = stores.reduce(
      (s, st) => s + (storeProductMap[st]?.[b]?.qty || 0),
      0
    );
    return totalB - totalA;
  });

  // Sheet 1: Summary — matches frontend: Produk | Qty Terjual | Total Revenue
  const globalSummaryData = [
    [
      "Produk",
      "Qty Terjual",
      "Total Revenue (IDR)",
      "Total Revenue (Rp)",
    ],
    ...products.map((p) => {
      const totalQty = stores.reduce(
        (s, st) => s + (storeProductMap[st]?.[p]?.qty || 0),
        0
      );
      const totalRev = stores.reduce(
        (s, st) => s + (storeProductMap[st]?.[p]?.revenue || 0),
        0
      );
      return [p, totalQty, totalRev, formatRupiahRaw(totalRev)];
    }),
  ];

  // Sheet 2: Per-store breakdown
  const storeHeaders = stores.flatMap((s) => [
    `${s} - Qty`,
    `${s} - Revenue (IDR)`,
  ]);
  const perStoreData = [
    ["Produk", ...storeHeaders, "TOTAL Qty", "TOTAL Revenue (IDR)"],
    ...products.map((p) => {
      const cells = stores.flatMap((s) => [
        storeProductMap[s]?.[p]?.qty || 0,
        storeProductMap[s]?.[p]?.revenue || 0,
      ]);
      const totalQty = stores.reduce(
        (s, st) => s + (storeProductMap[st]?.[p]?.qty || 0),
        0
      );
      const totalRev = stores.reduce(
        (s, st) => s + (storeProductMap[st]?.[p]?.revenue || 0),
        0
      );
      return [p, ...cells, totalQty, totalRev];
    }),
  ];

  // Sheet 3: Daily product sales (top 10)
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
    dailyProductMap[date][name] =
      (dailyProductMap[date][name] || 0) + qty;
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
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(globalSummaryData),
    "Summary Produk"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(perStoreData),
    "Product per Store"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailyData),
    "Daily Product Trend"
  );
  downloadXlsx(wb, `Analytics_Product_Sales_${Date.now()}.xlsx`);
}

// ─── TAB 5: Employee ──────────────────────────────────────────────────────────
export function exportEmployeeTab(
  filteredRows: Row[],
  trafficMap: Record<string, string> = {}
) {
  const orderSeen = new Set<string>();
  const storeEmpMap: Record<
    string,
    Record<string, { orders: Set<string>; subtotal: number }>
  > = {};
  const allStores = new Set<string>();
  const allEmps = new Set<string>();

  filteredRows.forEach((r) => {
    const store = cleanLocationName(r.Location);
    const emp = r.Employee?.trim();
    if (!emp) return;
    allStores.add(store);
    allEmps.add(emp);
    if (!storeEmpMap[store]) storeEmpMap[store] = {};
    if (!storeEmpMap[store][emp])
      storeEmpMap[store][emp] = { orders: new Set(), subtotal: 0 };
    if (r.Name) storeEmpMap[store][emp].orders.add(r.Name);
    if (!orderSeen.has(r.Name || "")) {
      orderSeen.add(r.Name || "");
      storeEmpMap[store][emp].subtotal += parseSubtotal(r.Subtotal);
    }
  });

  const stores = [...allStores].sort();
  const emps = [...allEmps].sort((a, b) => {
    const totalA = stores.reduce(
      (s, st) => s + (storeEmpMap[st]?.[a]?.subtotal || 0),
      0
    );
    const totalB = stores.reduce(
      (s, st) => s + (storeEmpMap[st]?.[b]?.subtotal || 0),
      0
    );
    return totalB - totalA;
  });

  // Sheet 1: Summary — matches frontend: Karyawan | Jumlah Order | Total Revenue | Avg/Order
  const globalSummaryData = [
    [
      "Karyawan",
      "Jumlah Order",
      "Total Revenue (IDR)",
      "Total Revenue (Rp)",
      "Avg/Order (IDR)",
      "Avg/Order (Rp)",
    ],
    ...emps.map((emp) => {
      const totalOrders = stores.reduce(
        (s, st) => s + (storeEmpMap[st]?.[emp]?.orders.size || 0),
        0
      );
      const totalRev = stores.reduce(
        (s, st) => s + (storeEmpMap[st]?.[emp]?.subtotal || 0),
        0
      );
      const avg = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
      return [
        emp,
        totalOrders,
        totalRev,
        formatRupiahRaw(totalRev),
        avg,
        totalOrders > 0 ? formatRupiahRaw(avg) : "-",
      ];
    }),
  ];

  // Sheet 2: Per-store breakdown
  const storeHeaders = stores.flatMap((s) => [
    `${s} - Orders`,
    `${s} - Revenue (IDR)`,
  ]);
  const perStoreData = [
    ["Karyawan", ...storeHeaders, "TOTAL Orders", "TOTAL Revenue (IDR)"],
    ...emps.map((emp) => {
      const cells = stores.flatMap((s) => [
        storeEmpMap[s]?.[emp]?.orders.size || 0,
        storeEmpMap[s]?.[emp]?.subtotal || 0,
      ]);
      const totalOrders = stores.reduce(
        (s, st) => s + (storeEmpMap[st]?.[emp]?.orders.size || 0),
        0
      );
      const totalRev = stores.reduce(
        (s, st) => s + (storeEmpMap[st]?.[emp]?.subtotal || 0),
        0
      );
      return [emp, ...cells, totalOrders, totalRev];
    }),
  ];

  // Sheet 3: Daily employee revenue
  const dailyEmpMap: Record<
    string,
    Record<string, { orders: Set<string>; revenue: number }>
  > = {};
  const allDates = new Set<string>();
  const dailySeen = new Set<string>();
  filteredRows.forEach((r) => {
    const emp = r.Employee?.trim();
    if (!emp) return;
    const date = (r["Created at"] || "").split(" ")[0];
    if (!date) return;
    allDates.add(date);
    if (!dailyEmpMap[date]) dailyEmpMap[date] = {};
    if (!dailyEmpMap[date][emp])
      dailyEmpMap[date][emp] = { orders: new Set(), revenue: 0 };
    if (r.Name) dailyEmpMap[date][emp].orders.add(r.Name);
    const dayOrderKey = `${date}__${r.Name || ""}`;
    if (!dailySeen.has(dayOrderKey)) {
      dailySeen.add(dayOrderKey);
      dailyEmpMap[date][emp].revenue += parseSubtotal(r.Subtotal);
    }
  });

  const sortedDates = [...allDates].sort();
  const dailyData = [
    [
      "Tanggal",
      ...emps.map((e) => `${e} - Revenue`),
      "Total Revenue Hari Ini",
    ],
    ...sortedDates.map((d) => {
      const revenues = emps.map((e) => dailyEmpMap[d]?.[e]?.revenue || 0);
      return [d, ...revenues, revenues.reduce((a, b) => a + b, 0)];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(globalSummaryData),
    "Summary Karyawan"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(perStoreData),
    "Employee per Store"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailyData),
    "Daily Employee Trend"
  );
  downloadXlsx(wb, `Analytics_Employee_${Date.now()}.xlsx`);
}