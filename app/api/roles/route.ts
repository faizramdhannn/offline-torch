import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { listRoles, createRole, updateRole, deleteRole, applyRoleToUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function isSuperAdmin(request: NextRequest) {
  const u = await sessionUser(request);
  return !!u && u.role === "super_admin";
}
const deny = () => NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });

export async function GET(request: NextRequest) {
  if (!(await isSuperAdmin(request))) return deny();
  return NextResponse.json(await listRoles());
}

export async function POST(request: NextRequest) {
  const b = await request.json();
  if (!(await isSuperAdmin(request))) return deny();
  if (!String(b.name || "").trim()) return NextResponse.json({ error: "Nama role wajib diisi" }, { status: 400 });
  return NextResponse.json(await createRole(String(b.name), b.perms || {}));
}

export async function PUT(request: NextRequest) {
  const b = await request.json();
  if (!(await isSuperAdmin(request))) return deny();
  await updateRole(String(b.key), b.name, b.perms);
  const applied = b.apply ? await applyRoleToUsers(String(b.key)) : 0;
  return NextResponse.json({ success: true, applied });
}

export async function DELETE(request: NextRequest) {
  const b = await request.json();
  if (!(await isSuperAdmin(request))) return deny();
  const r = await deleteRole(String(b.key));
  if (r === "system") return NextResponse.json({ error: "Role bawaan tidak bisa dihapus" }, { status: 400 });
  if (r === "in_use") return NextResponse.json({ error: "Masih ada user dengan role ini" }, { status: 400 });
  return NextResponse.json({ success: true });
}
