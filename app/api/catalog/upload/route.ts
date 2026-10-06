import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { CATALOG_CONFIGS } from "@/lib/catalogs";
import { publishCatalogPdf, blobConfigured } from "@/lib/catalogBlob";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Super Admin / akses setting: PDF katalog yang dibuat di browser diunggah ke Vercel Blob dan langsung
// jadi versi aktif. Body = bytes PDF mentah (batas request Vercel ~4,5 MB).
export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user || user.user_setting !== "TRUE") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const key = request.nextUrl.searchParams.get("key") || "";
  const cfg = CATALOG_CONFIGS[key];
  if (!cfg) return NextResponse.json({ error: "Katalog tidak dikenal" }, { status: 400 });
  if (!blobConfigured()) {
    return NextResponse.json({ error: "Vercel Blob belum terhubung ke project ini" }, { status: 501 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length < 5000 || bytes.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json({ error: "Bukan file PDF yang valid" }, { status: 400 });
  }

  const { version, url } = await publishCatalogPdf(key, user.user_name, bytes);
  audit(request, "UPDATE", `Unggah PDF katalog ${key} (${Math.round(bytes.length / 1024)} KB)`, "catalog", key);
  return NextResponse.json({ success: true, version, url });
}
