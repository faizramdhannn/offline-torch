import { NextRequest, NextResponse } from "next/server";
import { listByEntityTypes } from "@/lib/activityLog";

export const dynamic = "force-dynamic";

// Riwayat perintah & perubahan Store Monitor (siapa mengirim apa, kapan) — dari activity log yang sudah ada.
export async function GET(_request: NextRequest) {
  const rows = await listByEntityTypes(["device", "music", "announce"], 100);
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
