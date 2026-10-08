import type { CatalogConfig } from "./catalogPdfCore";

// Daftar katalog publik. Menambah katalog baru = tambah entri di sini + halaman publik + kartu di menu Catalog.
export const CATALOG_CONFIGS: Record<string, CatalogConfig> = {
  online: { key: "online", sheet: "online_catalog", title: "Online Catalog", filename: "Torch_Online_Catalog.pdf" },
  clearance: {
    key: "clearance",
    sheet: "clearance_catalog",
    title: "Clearance Catalog",
    filename: "Torch_Clearance_Catalog.pdf",
    showStock: true,
    note: "S&K Berlaku",
    promoPercent: 50, // harga di sheet = harga normal (dicoret); harga promo = 50% dari harga normal
  },
};
