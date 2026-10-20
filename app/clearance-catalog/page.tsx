import type { Metadata } from "next";
import CatalogViewer from "@/components/CatalogViewer";
import { getCatalogState } from "@/lib/catalogVersion";

// Halaman publik (tanpa login) Online Catalog: preview PDF + tombol Download.
export const metadata: Metadata = {
  title: "Torch Clearance Catalog",
  description: "Katalog clearance Torch (A4)",
};

export const dynamic = "force-dynamic";

export default async function ClearanceCatalogPage() {
  const state = await getCatalogState("clearance");
  // PDF sudah di Blob (dibuat di browser Super Admin / cron) → langsung ke sana, tanpa function Vercel.
  const pdf = state.blob_url || `/clearance-catalog/pdf?v=${state.version}`;
  return <CatalogViewer title="Torch Clearance Catalog" pdf={pdf} accent="#0b7a8f" />;
}
