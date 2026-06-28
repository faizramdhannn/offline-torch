// ─────────────────────────────────────────────────────────────────────────────
// Step ERP — master/reference data.
//
// This mirrors the "master_type" and "master_checklist" sheets from the
// "Step by Step on ERP" spreadsheet the feature was modeled on. It is kept
// as static config (rather than another Google Sheet) because it changes
// rarely and every page that needs the type list / step list needs it
// synchronously on the client too.
//
// `key` is also the literal Google Sheet tab name used to store entries for
// that type (see SPREADSHEET_MAP in lib/sheets.ts) — keep it in sync with
// the sheet tabs you create in the SPREADSHEET_STEP_ERP spreadsheet.
// ─────────────────────────────────────────────────────────────────────────────

export interface StepErpStepDef {
  /** Column name in the sheet, e.g. "step_1" */
  key: string;
  /** Human-readable description of what to do */
  label: string;
  /** Who is responsible for this step */
  owner: "Requester" | "Sender" | "Receiver" | "Head Office";
}

export interface StepErpTypeDef {
  /** master_type.id */
  id: number;
  /** Sheet tab name this type's entries live in */
  key: string;
  /** Display name */
  label: string;
  /** Short description of what this process is for */
  description: string;
  steps: StepErpStepDef[];
}

function steps(
  owner: StepErpStepDef["owner"],
  labels: string[]
): StepErpStepDef[] {
  return labels.map((label, i) => ({ key: `step_${i + 1}`, label, owner }));
}

export const STEP_ERP_TYPES: StepErpTypeDef[] = [
  {
    id: 1,
    key: "material_request_store",
    label: "Material Request Store",
    description: "Meminta Barang dari Gudang Lain",
    steps: steps("Requester", [
      'Mengajukan di ERP pada Modul "Material Request"',
      "Mengisi required by (today)",
      "Mengisi Purpose dengan Sesuai",
      "Mengisi Cost Center Sesuai Store tujuan",
      "Mengisi Source dan Target Warehouse Transit dengan Sesuai",
      "Megisi SKU sesuai Ketersediaan Stock di Source Warehouse",
      "Meminta Approval ke Inventory",
    ]),
  },
  {
    id: 2,
    key: "stock_entry_store",
    label: "Stock Entry Store",
    description: "Membuat Pengiriman ke Gudang Lain setelah Material Request di Approve",
    steps: steps("Sender", [
      "Membuat dari Material Request yang sebelumnya sudah di Approved dengan Klik Create > Material Transfer",
      "Mengisi Cost Center dengan Store Penerima",
      "Mengisi source WH pengirim dan target WH transit penerima",
      "Menceklis Add to transit dan Send Transfer Warehouse Powerbiz diisi dengan Store Pengirim",
      "Save -> Submit",
      "Melakukan proses kirim di Powerbiz Sesuai STE",
    ]),
  },
  {
    id: 3,
    key: "end_transit_store",
    label: "End Transit Store",
    description: "Menerima Barang Datang dari Gudang Lain",
    steps: steps("Receiver", [
      "Melakukan Endtransit di Nomor Stock Entry",
      "Mengisi Cost Center dengan Store Penerima",
      "Mengisi target WH dengan gudang toko masing masing",
      "Save -> Submit",
      "Menerima STE di Powerbiz",
    ]),
  },
  {
    id: 4,
    key: "allocation_pca",
    label: "Allocation PCA",
    description: "Menerima Barang yang Datang dari PCA",
    steps: steps("Receiver", [
      "Pengecekan Barang",
      "Menyesuaikan data ERP dan data Fisik",
      "Melaporkan Jika Ada ketidaksesuaian antara Fisik dan Data (opsional)",
      "Melakukan Endtransit ke Gudang Utama",
      "Unceklis send to order powerbiz",
      "Meminta upstock STE alokasi ke inventory",
    ]),
  },
  {
    id: 5,
    key: "material_request_warehouse",
    label: "Material Request Warehouse",
    description: "Meminta Barang untuk Pindah dari Gudang Utama ke Gudang Reject",
    steps: steps("Requester", [
      'Mengajukan di ERP pada Modul "Material Request"',
      "Mengisi Purpose dengan Sesuai",
      "Mengisi required by today",
      "Mengisi Cost Center Sesuai Store masing masing",
      "Mengisi Source dan Target Warehouse Transit dengan Sesuai",
      "Megisi SKU sesuai Ketersediaan Stock di Source Warehouse",
      "Meminta Approval ke Inventory",
    ]),
  },
  {
    id: 6,
    key: "stock_entry_warehouse",
    label: "Stock Entry Warehouse",
    description: "Membuat Pengiriman ke Gudang Reject setelah Material Request di Approve",
    steps: steps("Sender", [
      "Dari no Material Request yg sudah di Approved, Klik Create > Material Transfer",
      "Mengisi Cost Center dengan Store masing masing",
      "Menceklis Send Tranfer Warehouse Powerbiz diisi dengan warehouse Pengirim",
      "Save -> Submit",
      "Melakukan proses kirim di Powerbiz Sesuai STE",
    ]),
  },
  {
    id: 7,
    key: "material_request_issue",
    label: "Material Request Issue",
    description: "Membuat Permintaan Barang untuk Gift dari Gudang Utama",
    steps: steps("Requester", [
      'Mengajukan di ERP pada Modul "Material Request"',
      "Mengisi Purpose dengan Sesuai",
      "Mengisi Cost Center Sesuai Store",
      "Mengisi Target Warehouse dengan Sesuai",
      "Megisi SKU sesuai Ketersediaan Stock di Warehouse",
      "Meminta Approval ke Inventory",
    ]),
  },
  {
    id: 8,
    key: "stock_entry_issue",
    label: "Stock Entry Issue",
    description: "Membuat Pengurangan Stock dari Gudang Utama setelah di Approve",
    steps: steps("Head Office", [
      "Membuat dari Material Request yang sebelumnya sudah di Approved dengan Klik Create > Material Transfer",
      "Mengisi Cost Center dengaan Store Penerima",
      "Menceklis Send to Adjustment Powerbiz dengan Store Pemilik",
      "Meminta Approval ke Finance",
    ]),
  },
];

export function getStepErpType(key: string): StepErpTypeDef | undefined {
  return STEP_ERP_TYPES.find((t) => t.key === key);
}

/** Whitelist check — used by the API route before touching any sheet. */
export function isValidStepErpType(key: string): boolean {
  return STEP_ERP_TYPES.some((t) => t.key === key);
}

/** How many of this type's steps are checked off on a given entry row. */
export function computeEntryProgress(
  entry: Record<string, any>,
  typeDef: StepErpTypeDef
): { done: number; total: number; percent: number } {
  const total = typeDef.steps.length;
  const done = typeDef.steps.filter((s) => entry[s.key] === "TRUE").length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

/** Aggregate stats across a list of entries — used for the type grid + stat cards. */
export function summarizeEntries(
  entries: Record<string, any>[],
  typeDef: StepErpTypeDef
): { total: number; completed: number; avgPercent: number } {
  const total = entries.length;
  let sumPercent = 0;
  let completed = 0;
  entries.forEach((entry) => {
    const { percent } = computeEntryProgress(entry, typeDef);
    sumPercent += percent;
    if (percent >= 100) completed += 1;
  });
  const avgPercent = total > 0 ? Math.round(sumPercent / total) : 0;
  return { total, completed, avgPercent };
}

// Same 14 stores used across the app (Bundling, Customer, Invoice, etc.)
export const STEP_ERP_STORES: string[] = [
  "Torch Cirebon",
  "Torch Jogja",
  "Torch Karawaci",
  "Torch Karawang",
  "Torch Lampung",
  "Torch Lembong",
  "Torch Makassar",
  "Torch Malang",
  "Torch Margonda",
  "Torch Medan",
  "Torch Pekalongan",
  "Torch Purwokerto",
  "Torch Surabaya",
  "Torch Tambun",
];
