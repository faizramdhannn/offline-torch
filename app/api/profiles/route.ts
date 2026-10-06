import { NextRequest, NextResponse } from "next/server";
import { getUserByUserName, getUsersData, adminUpdateUser, countSuperAdmins } from "@/lib/users";
import { getRole, applyRoleToUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Soft-auth seperti route lain: `actor` dikirim klien, tapi role-nya diperiksa dari database.
async function requireSuperAdmin(actor: string | null) {
  const u = actor ? await getUserByUserName(actor) : null;
  return u && u.role === "super_admin" ? u : null;
}

export async function GET(request: NextRequest) {
  const actor = await requireSuperAdmin(request.nextUrl.searchParams.get("actor"));
  if (!actor) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const users = await getUsersData();
  return NextResponse.json(
    users.map((u) => ({
      id: u.id, name: u.name, user_name: u.user_name, role: u.role, email: u.email,
      phone: u.phone, address: u.address, photo_url: u.photo_url, last_activity: u.last_activity,
    }))
  );
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = await requireSuperAdmin(body.actor);
    if (!actor) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });

    const target = await getUserByUserName(String(body.user_name || ""));
    if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    let role: string | undefined;
    if (body.role !== undefined) {
      if (!(await getRole(String(body.role)))) {
        return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
      }
      role = String(body.role);
      if (target.role === "super_admin" && role !== "super_admin" && (await countSuperAdmins()) <= 1) {
        return NextResponse.json({ error: "Harus ada minimal 1 Super Admin" }, { status: 400 });
      }
    }

    await adminUpdateUser(target.user_name, {
      name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
      email,
      phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
      address: typeof body.address === "string" ? body.address.trim() : undefined,
      role,
      remove_photo: body.remove_photo === true,
    });
    // Role berubah → permission user mengikuti role barunya (kecuali dimatikan).
    if (role && role !== target.role && body.apply_role_perms !== false) {
      await applyRoleToUser(role, target.user_name);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("profiles PUT", e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
