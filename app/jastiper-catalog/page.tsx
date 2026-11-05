import type { Metadata } from "next";
import JastiperCatalog from "@/components/JastiperCatalog";
import { getCatalogState } from "@/lib/catalogVersion";
import { JASTIPER_KEY } from "@/lib/jastiperCatalog";

// Halaman publik (tanpa login) Katalog Jastiper. Data = satu file JSON di Vercel Blob (dibuat harian oleh GitHub Actions),
// dibaca browser langsung dari CDN; foto dari CDN Shopify. Server hanya membaca alamat JSON dari Neon.
export const metadata: Metadata = {
  title: "Torch Catalog",
  description: "Katalog produk Torch yang ready — lengkap dengan pilihan warna dan foto detail",
};

export const dynamic = "force-dynamic";

export default async function JastiperCatalogPage() {
  const state = await getCatalogState(JASTIPER_KEY);
  return <JastiperCatalog dataUrl={state.blob_url} />;
}
