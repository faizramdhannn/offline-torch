import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { computeDashboardSummary } from "@/lib/dashboardSummary";
import { jsonWithEtag } from "@/lib/etag";

export const dynamic = "force-dynamic";

// Satu panggilan untuk semua kartu "Perlu tindakan" di dashboard (hanya yang boleh dilihat user itu).
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  try {
    return jsonWithEtag(request, await computeDashboardSummary(user));
  } catch (e) {
    console.error("dashboard summary:", e);
    return NextResponse.json({ error: "Gagal memuat ringkasan" }, { status: 500 });
  }
}
