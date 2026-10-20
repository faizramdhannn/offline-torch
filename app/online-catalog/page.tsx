import type { Metadata } from "next";
import CatalogViewer from "@/components/CatalogViewer";
import { getCatalogState } from "@/lib/catalogVersion";

// Halaman publik (tanpa login) Online Catalog: preview PDF + tombol Download.
export const metadata: Metadata = {
  title: "Torch Online Catalog",
  description: "Katalog produk Torch (A4)",
};

export const dynamic = "force-dynamic";

export default async function OnlineCatalogPage() {
  const state = await getCatalogState("online");
  // PDF sudah di Blob (dibuat di browser Super Admin / cron) → langsung ke sana, tanpa function Vercel.
  const pdf = state.blob_url || `/online-catalog/pdf?v=${state.version}`;
  return <CatalogViewer title="Torch Online Catalog" pdf={pdf} accent="#0b7a8f" />;
}
