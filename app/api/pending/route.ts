import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { computePending } from "@/lib/pendingCounts";

export const dynamic = "force-dynamic";

// Penyegaran sesaat setelah user mengubah status (angka di sidebar). Pemuatan berkala sudah ikut di /api/auth/me.
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  return NextResponse.json({ pending: await computePending(user) }, { headers: { "Cache-Control": "no-store" } });
}
