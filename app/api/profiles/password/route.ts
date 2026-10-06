import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { sessionUser } from "@/lib/authz";
import { getUserByUserName, updateUserProfile, invalidateSessions } from "@/lib/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generate = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// Super Admin: reset password user lain. Tanpa new_password → dibuatkan password acak
// (dikembalikan SEKALI di respons). Semua sesi user itu dicabut.
export async function POST(request: NextRequest) {
  try {
    const actor = await sessionUser(request);
    if (!actor || actor.role !== "super_admin") {
      return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
    }
    const body = await request.json();
    const target = await getUserByUserName(String(body.user_name || ""));
    if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const given = typeof body.new_password === "string" ? body.new_password : "";
    if (given && given.length < 6) return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    const password = given || generate();

    await updateUserProfile(target.user_name, { password: await bcrypt.hash(password, 10) });
    await invalidateSessions({ userName: target.user_name });
    audit(request, "UPDATE", `Reset password ${target.user_name}`, "user", target.user_name);
    return NextResponse.json({ success: true, password: given ? undefined : password });
  } catch (e) {
    console.error("profiles/password", e);
    return NextResponse.json({ error: "Gagal reset password" }, { status: 500 });
  }
}
