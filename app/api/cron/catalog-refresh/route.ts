import { NextRequest, NextResponse } from "next/server";
import { publishCatalogPdf, blobConfigured } from "@/lib/catalogBlob";
import { bumpCatalogVersion, catalogPdfPath, getCatalogMeta, CATALOG_KEYS } from "@/lib/catalogVersion";
import { CATALOG_CONFIGS } from "@/lib/catalogs";
import { generateCatalogBuffer } from "@/lib/onlineCatalogPdf";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Dipanggil Vercel Cron tiap hari 03:00 UTC (= 10:00 WIB). Bila Blob tersedia: PDF dibuat di sini SEKALI
// lalu disimpan di Blob (pengunjung publik tidak pernah memicu pembuatan PDF). Tanpa Blob: naikkan versi
// dan "hangatkan" CDN seperti sebelumnya.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  const results: Record<string, number | string> = {};
  const meta = await getCatalogMeta();
  for (const key of CATALOG_KEYS) {
    try {
      // Cadangan: bila GitHub Actions (jadwal utama) sudah sukses dalam 6 jam terakhir, tidak perlu membuat ulang di Vercel.
      const m = meta[key];
      const fresh = m && m.updated_by === "github-actions" && Date.now() - Date.parse(m.updated_at.replace(" ", "T").replace(/\+00$/, "Z")) < 6 * 3600 * 1000;
      if (fresh) { results[key] = "dilewati (sudah dibuat GitHub Actions)"; continue; }

      if (blobConfigured()) {
        const buffer = await generateCatalogBuffer(CATALOG_CONFIGS[key]);
        if (!buffer) { results[key] = "tanpa produk, dilewati"; continue; }
        await publishCatalogPdf(key, "cron", buffer);
        results[key] = "blob";
      } else {
        const v = await bumpCatalogVersion(key, "cron");
        const res = await fetch(`${origin}${catalogPdfPath(key)}?v=${v}`, { cache: "no-store" });
        results[key] = res.status;
        await res.arrayBuffer();
      }
    } catch (e: any) {
      results[key] = e.message || "gagal";
    }
  }
  return NextResponse.json({ success: true, results });
}
