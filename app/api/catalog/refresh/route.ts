import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { bumpCatalogVersion, getCatalogMeta, CATALOG_KEYS } from "@/lib/catalogVersion";
import { JASTIPER_KEY, loadJastiperCatalog } from "@/lib/jastiperCatalog";
import { blobConfigured, publishCatalogJson } from "@/lib/catalogBlob";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCatalogMeta());
}

// Refresh manual — hanya user dengan akses setting (identitas dari cookie sesi).
export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    const user = await sessionUser(request);
    if (!user || user.user_setting !== "TRUE") {
      return NextResponse.json({ error: "Akses ditolak: butuh akses setting" }, { status: 403 });
    }
    // Katalog Jastiper: tanpa PDF — server hanya membaca sheet (1 panggilan) lalu menyimpan JSON kecil ke Blob.
    if (key === JASTIPER_KEY) {
      if (!blobConfigured()) return NextResponse.json({ error: "Vercel Blob belum terhubung" }, { status: 500 });
      const data = await loadJastiperCatalog();
      if (!data) return NextResponse.json({ error: "Sheet jastiper_catalog kosong / tidak ada produk ready" }, { status: 422 });
      const { version } = await publishCatalogJson(JASTIPER_KEY, user.user_name, JSON.stringify(data));
      audit(request, "UPDATE", `Refresh katalog ${key} (${data.products.length} produk)`, "catalog", key);
      return NextResponse.json({ success: true, version, products: data.products.length });
    }
    if (!(CATALOG_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json({ error: "Katalog tidak dikenal" }, { status: 400 });
    }
    const version = await bumpCatalogVersion(key, user.user_name);
    audit(request, "UPDATE", `Refresh katalog ${key}`, "catalog", key);
    return NextResponse.json({ success: true, version });
  } catch (e) {
    console.error("catalog refresh", e);
    return NextResponse.json({ error: "Gagal refresh katalog" }, { status: 500 });
  }
}
