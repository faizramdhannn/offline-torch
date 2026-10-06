import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { toClientUser } from "@/lib/clientUser";

// Dipakai klien untuk mengecek sesi masih sah (proxy.ts menolak dengan 401 bila tidak)
// sekaligus menyegarkan permission/role terbaru dari database.
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  return NextResponse.json({ ok: true, user: toClientUser(user) }, { headers: { "Cache-Control": "no-store" } });
}
