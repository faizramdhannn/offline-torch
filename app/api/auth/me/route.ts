import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { toClientUser } from "@/lib/clientUser";
import { serverBuildId } from "@/lib/buildInfo";
import { computePending } from "@/lib/pendingCounts";
import { withCache } from "@/lib/sheets";

// Dipakai klien untuk mengecek sesi masih sah (proxy.ts menolak dengan 401 bila tidak)
// sekaligus menyegarkan permission/role terbaru dari database.
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  // pending = angka permintaan menunggu untuk badge sidebar (hanya menu yang boleh diubah user ini)
  // Ditahan 60 dtk per user+izin (sumbernya sudah cache Sheets 5 mnt) supaya banyak tab/perangkat tidak menghitung ulang terus.
  const pkey = `pending:${user.user_name}:${user.role}:${[user.edit_request, user.tracking_edit, user.material_issue_all, user.employee_discount_approval, user.invoice_approval].join("")}`;
  const pending = await withCache(pkey, 60_000, () => computePending(user)).catch(() => ({}));
  return NextResponse.json({ ok: true, build: serverBuildId(), pending, user: toClientUser(user) }, { headers: { "Cache-Control": "no-store" } });
}
