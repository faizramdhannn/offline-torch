import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { takeSnapshot } from "@/lib/usersBackup";
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
  const created = await createRole(String(b.name), b.perms || {});
  audit(request, "CREATE", `Membuat role ${created.name}`, "role", created.key);
  return NextResponse.json(created);
}

export async function PUT(request: NextRequest) {
  const b = await request.json();
  if (!(await isSuperAdmin(request))) return deny();
  if (b.apply) await takeSnapshot(`sebelum terapkan role ${b.key}`, (await sessionUser(request))?.user_name || "");
  await updateRole(String(b.key), b.name, b.perms);
  const applied = b.apply ? await applyRoleToUsers(String(b.key)) : 0;
  audit(request, "UPDATE", `Mengubah role ${b.key}${b.apply ? ` dan menerapkan ke ${applied} user` : ""}`, "role", String(b.key));
  return NextResponse.json({ success: true, applied });
}

export async function DELETE(request: NextRequest) {
  const b = await request.json();
  if (!(await isSuperAdmin(request))) return deny();
  const r = await deleteRole(String(b.key));
  if (r === "system") return NextResponse.json({ error: "Role bawaan tidak bisa dihapus" }, { status: 400 });
  if (r === "in_use") return NextResponse.json({ error: "Masih ada user dengan role ini" }, { status: 400 });
  audit(request, "DELETE", `Menghapus role ${b.key}`, "role", String(b.key));
  return NextResponse.json({ success: true });
}
