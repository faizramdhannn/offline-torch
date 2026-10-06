import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { invalidateSessions } from "@/lib/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Super Admin: paksa logout satu user ({user_name}) atau semua kecuali Super Admin ({all:true}).
export async function POST(request: NextRequest) {
  const actor = await sessionUser(request);
  if (!actor || actor.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }
  const body = await request.json();
  if (body.all === true) {
    const n = await invalidateSessions({ exceptRole: "super_admin" });
    audit(request, "UPDATE", `Logout paksa semua akun (kecuali Super Admin): ${n} akun`, "user", "all");
    return NextResponse.json({ success: true, count: n });
  }
  const target = String(body.user_name || "");
  if (!target) return NextResponse.json({ error: "user_name wajib diisi" }, { status: 400 });
  const n = await invalidateSessions({ userName: target });
  audit(request, "UPDATE", `Logout paksa ${target}`, "user", target);
  return NextResponse.json({ success: true, count: n });
}
