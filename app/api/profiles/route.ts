import { NextRequest, NextResponse } from "next/server";
import { getUserByUserName, getUsersData, adminUpdateUser, countSuperAdmins, createUser, userNameTaken } from "@/lib/users";
import bcrypt from "bcryptjs";
import { normalizePhone } from "@/lib/profileRules";
import { audit } from "@/lib/audit";
import { getRole, applyRoleToUser } from "@/lib/roles";
import { sessionUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Identitas dari cookie sesi; role diperiksa dari database.
async function requireSuperAdmin(request: NextRequest) {
  const u = await sessionUser(request);
  return u && u.role === "super_admin" ? u : null;
}

export async function GET(request: NextRequest) {
  const actor = await requireSuperAdmin(request);
  if (!actor) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const users = await getUsersData();
  return NextResponse.json(
    users.map((u) => ({
      id: u.id, name: u.name, user_name: u.user_name, role: u.role, email: u.email,
      phone: u.phone, address: u.address, photo_url: u.photo_url, last_activity: u.last_activity,
      active: u.active !== "FALSE",
    }))
  );
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = await requireSuperAdmin(request);
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

    let active: boolean | undefined;
    if (typeof body.active === "boolean") {
      active = body.active;
      if (!active && (target.role === "super_admin" || target.user_name === actor.user_name)) {
        return NextResponse.json({ error: "Super Admin dan akun sendiri tidak bisa dinonaktifkan" }, { status: 400 });
      }
    }

    await adminUpdateUser(target.user_name, {
      active,
      name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
      email,
      phone: typeof body.phone === "string" ? normalizePhone(body.phone) : undefined,
      address: typeof body.address === "string" ? body.address.trim() : undefined,
      role,
      remove_photo: body.remove_photo === true,
    });
    const changes: string[] = [];
    if (role && role !== target.role) changes.push(`role ${target.role} → ${role}`);
    if (active !== undefined) changes.push(active ? "diaktifkan" : "dinonaktifkan");
    if (changes.length === 0) changes.push("profil diubah");
    audit(request, "UPDATE", `${target.user_name}: ${changes.join(", ")}`, "user", target.user_name);

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

// Super Admin: buat user baru langsung (tanpa lewat registrasi).
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin(request);
    if (!actor) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
    const body = await request.json();
    const name = String(body.name || "").trim();
    const userName = String(body.user_name || "").trim();
    const password = String(body.password || "");
    if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!/^[A-Za-z0-9 ._-]{3,30}$/.test(userName)) {
      return NextResponse.json({ error: "Username 3–30 karakter (huruf, angka, spasi, titik, strip, garis bawah)" }, { status: 400 });
    }
    if (password.length < 6) return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    if (await userNameTaken(userName)) return NextResponse.json({ error: "Username sudah dipakai" }, { status: 409 });
    const role = await getRole(String(body.role || "store"));
    if (!role) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });

    const perms = Object.fromEntries(Object.entries(role.perms).map(([k, v]) => [k, v === "TRUE"]));
    const ok = await createUser(
      { id: Date.now().toString(), name, user_name: userName, password: await bcrypt.hash(password, 10) },
      perms,
      role.key
    );
    if (!ok) return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
    audit(request, "CREATE", `Membuat user ${userName} (role ${role.name})`, "user", userName);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("profiles POST", e);
    return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
  }
}
