import { buildJastiperCatalog, type JastiperData } from "./jastiperCatalog";

// Katalog Revo Mall Bekasi (bazaar IHLS) — sheet `revo_catalog` (spreadsheet katalog yang sama), kolom IDENTIK dengan
// `jastiper_catalog`, jadi penyusunnya dipakai ulang (stok ≤ 0 tidak ditulis, product_tampil = FALSE dibuang).
// Beda dengan katalog lain: TIDAK ada refresh harian (tidak masuk GitHub Actions / cron Vercel) — hanya tombol Refresh
// manual di menu Catalog. Hasilnya satu JSON kecil di Vercel Blob (key `revo`).
export const REVO_KEY = "revo";
export const REVO_SHEET = "revo_catalog";

export const buildRevoCatalog = buildJastiperCatalog;

// null = tidak ada produk (sheet kosong/gagal terbaca) → jangan menimpa data yang sudah tayang.
export async function loadRevoCatalog(): Promise<JastiperData | null> {
  const { getSheetData } = await import("./sheets");
  let data = buildRevoCatalog((await getSheetData(REVO_SHEET)) as any[]);
  if (data.products.length === 0) data = buildRevoCatalog((await getSheetData(REVO_SHEET, { skipCache: true })) as any[]);
  return data.products.length ? data : null;
}
