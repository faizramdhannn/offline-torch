import type { Metadata } from "next";
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
  const sep = pdf.includes("?") ? "&" : "?";
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f3f0e8" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          background: "#0b7a8f",
          color: "#fff",
        }}
      >
        <strong style={{ fontSize: 15 }}>Torch Online Catalog</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={pdf}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.18)", color: "#fff", fontSize: 13, textDecoration: "none" }}
          >
            Buka PDF
          </a>
          <a
            href={`${pdf}${sep}download=1`}
            style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", color: "#0b7a8f", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            Download PDF
          </a>
        </div>
      </header>
      <iframe
        src={pdf}
        title="Torch Online Catalog"
        style={{ flex: 1, width: "100%", border: "none", minHeight: "calc(100vh - 56px)" }}
      />
    </div>
  );
}
