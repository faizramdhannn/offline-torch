import type { Metadata } from "next";
import RevoCatalog from "@/components/RevoCatalog";
import { getCatalogState } from "@/lib/catalogVersion";
import { REVO_KEY } from "@/lib/revoCatalog";

// Halaman publik (tanpa login) Katalog Revo Mall Bekasi. Data = satu file JSON di Vercel Blob (diperbarui manual dari menu Catalog).
export const metadata: Metadata = {
  title: "Torch × IHLS Revo Mall Bekasi",
  description: "Katalog produk Torch di bazaar IHLS Revo Mall Bekasi, 25 November – 6 Desember 2026",
};

export const dynamic = "force-dynamic";

export default async function RevoCatalogPage() {
  const state = await getCatalogState(REVO_KEY);
  return <RevoCatalog dataUrl={state.blob_url} />;
}
