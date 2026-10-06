import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { takeSnapshot, listSnapshots, getSnapshot, restoreSnapshot } from "@/lib/usersBackup";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function superAdmin(request: NextRequest) {
  const u = await sessionUser(request);
  return u && u.role === "super_admin" ? u : null;
}
const deny = () => NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });

// GET → daftar snapshot; GET ?id=X → unduh snapshot (JSON)
export async function GET(request: NextRequest) {
  if (!(await superAdmin(request))) return deny();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json(await listSnapshots());
  const snap = await getSnapshot(id);
  if (!snap) return NextResponse.json({ error: "Snapshot tidak ditemukan" }, { status: 404 });
  return new NextResponse(JSON.stringify(snap, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="backup-users-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

// POST {action:'create'} | {action:'restore', id}
export async function POST(request: NextRequest) {
  const actor = await superAdmin(request);
  if (!actor) return deny();
  const body = await request.json();
  if (body.action === "restore") {
    const r = await restoreSnapshot(String(body.id), actor.user_name);
    if (!r) return NextResponse.json({ error: "Snapshot tidak ditemukan" }, { status: 404 });
    audit(request, "UPDATE", `Memulihkan user & role dari snapshot #${body.id} (${r.users} user, ${r.roles} role)`, "backup", String(body.id));
    return NextResponse.json({ success: true, ...r });
  }
  const id = await takeSnapshot("manual", actor.user_name);
  audit(request, "CREATE", `Membuat snapshot user & role #${id}`, "backup", String(id));
  return NextResponse.json({ success: true, id });
}
