import { NextRequest, NextResponse } from "next/server";
import { CATALOG_CONFIGS } from "@/lib/catalogs";
import { loadCatalogProducts } from "@/lib/onlineCatalogPdf";

export const dynamic = "force-dynamic";

// Data produk katalog (sudah difilter stock>0 & diurutkan per grup) untuk pembuatan PDF di browser.
export async function GET(request: NextRequest) {
  const cfg = CATALOG_CONFIGS[request.nextUrl.searchParams.get("key") || ""];
  if (!cfg) return NextResponse.json({ error: "Katalog tidak dikenal" }, { status: 400 });
  const products = await loadCatalogProducts(cfg);
  return NextResponse.json({ cfg, products }, { headers: { "Cache-Control": "no-store" } });
}
