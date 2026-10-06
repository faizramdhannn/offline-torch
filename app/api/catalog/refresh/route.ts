import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { bumpCatalogVersion, getCatalogMeta, CATALOG_KEYS } from "@/lib/catalogVersion";

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
