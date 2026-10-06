import { NextRequest, NextResponse } from "next/server";
import { bumpCatalogVersion, catalogPdfPath, CATALOG_KEYS } from "@/lib/catalogVersion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Dipanggil Vercel Cron tiap hari 03:00 UTC (= 10:00 WIB): naikkan versi lalu
// "hangatkan" CDN supaya pengunjung pertama tidak menunggu PDF dibuat.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  const results: Record<string, number | string> = {};
  for (const key of CATALOG_KEYS) {
    const v = await bumpCatalogVersion(key, "cron");
    try {
      const res = await fetch(`${origin}${catalogPdfPath(key)}?v=${v}`, { cache: "no-store" });
      results[key] = res.status;
      await res.arrayBuffer();
    } catch (e: any) {
      results[key] = e.message || "warm failed";
    }
  }
  return NextResponse.json({ success: true, results });
}
