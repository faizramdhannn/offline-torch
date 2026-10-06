import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUserName, updateUserProfile } from "@/lib/users";
import { getStoreAddressList } from "@/lib/storeAddress";
import { uploadToGoogleDrive } from "@/lib/drive";
import { shrinkImageBuffer } from "@/lib/shrinkImage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Soft-auth seperti route lain: username dikirim klien.
async function profileOf(userName: string) {
  const u = await getUserByUserName(userName);
  if (!u) return null;
  let { phone, address } = u;
  let fromStore = false;
  if (!phone || !address) {
    try {
      const stores = await getStoreAddressList();
      const key = (s: string) => s.trim().toLowerCase();
      const hit = stores.find((s) => key(s.store_location) === key(u.user_name) || key(s.store_location) === key(u.name));
      if (hit) {
        if (!phone && hit.phone_number) { phone = hit.phone_number; fromStore = true; }
        if (!address && hit.address) { address = hit.address; fromStore = true; }
      }
    } catch {
      // store_address opsional
    }
  }
  return {
    id: u.id,
    name: u.name,
    user_name: u.user_name,
    email: u.email,
    phone,
    address,
    photo_url: u.photo_url,
    role: u.role,
    prefilled_from_store: fromStore,
    last_activity: u.last_activity,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userName = request.nextUrl.searchParams.get("username") || "";
    if (!userName) return NextResponse.json({ error: "username wajib diisi" }, { status: 400 });
    const p = await profileOf(userName);
    if (!p) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    return NextResponse.json(p);
  } catch (e) {
    console.error("profile GET", e);
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const form = await request.formData();
    const userName = String(form.get("username") || "");
    if (!userName) return NextResponse.json({ error: "username wajib diisi" }, { status: 400 });
    const existing = await getUserByUserName(userName);
    if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const str = (k: string) => (form.has(k) ? String(form.get(k) ?? "").trim() : undefined);
    const email = str("email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    let password: string | undefined;
    const newPassword = str("new_password");
    if (newPassword) {
      if (newPassword.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
      const ok = await bcrypt.compare(String(form.get("current_password") || ""), existing.password);
      if (!ok) return NextResponse.json({ error: "Password saat ini salah" }, { status: 400 });
      password = await bcrypt.hash(newPassword, 10);
    }

    let photo_url: string | undefined;
    if (form.get("remove_photo") === "true") photo_url = "";
    const file = form.get("photo") as File | null;
    if (file && file.size > 0) {
      const raw = Buffer.from(await file.arrayBuffer());
      const small = await shrinkImageBuffer(raw, file.type || "image/jpeg", 512, 80);
      const url = await uploadToGoogleDrive(small.buffer, `profile_${userName}_${Date.now()}`, small.mimeType, "profile_photos", true);
      photo_url = url.replace(/sz=w\d+/, "sz=w256");
    }

    await updateUserProfile(userName, {
      name: str("name") || undefined,
      email,
      phone: str("phone"),
      address: str("address"),
      photo_url,
      password,
    });
    const p = await profileOf(userName);
    return NextResponse.json({ success: true, profile: p });
  } catch (e) {
    console.error("profile PUT", e);
    return NextResponse.json({ error: "Gagal menyimpan profil" }, { status: 500 });
  }
}
