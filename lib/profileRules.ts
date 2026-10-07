// Aturan kelengkapan profil (dipakai gate di layout, halaman Profile, dan validasi server).
// Semua role wajib: nama, email, no. telepon, foto. Alamat wajib hanya untuk Store dan Merchant.

export type ProfileField = "name" | "email" | "phone" | "address" | "photo";

export const PROFILE_FIELD_LABEL: Record<ProfileField, string> = {
  name: "Nama",
  email: "Email",
  phone: "No. telepon",
  address: "Alamat",
  photo: "Foto profil",
};

export const ADDRESS_REQUIRED_ROLES = ["store", "merchant"];

export function requiredProfileFields(role: string | undefined): ProfileField[] {
  const base: ProfileField[] = ["name", "email", "phone", "photo"];
  return ADDRESS_REQUIRED_ROLES.includes(String(role || "")) ? [...base, "address"] : base;
}

export interface ProfileLike {
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  photo_url?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,17}$/;

// Pesan error per field yang belum benar (kosong = lengkap).
export function profileProblems(p: ProfileLike, hasNewPhoto = false): Partial<Record<ProfileField, string>> {
  const out: Partial<Record<ProfileField, string>> = {};
  for (const f of requiredProfileFields(p.role)) {
    if (f === "name" && !String(p.name || "").trim()) out.name = "Nama wajib diisi";
    if (f === "email") {
      const v = String(p.email || "").trim();
      if (!v) out.email = "Email wajib diisi";
      else if (!EMAIL_RE.test(v)) out.email = "Format email tidak valid";
    }
    if (f === "phone") {
      const v = String(p.phone || "").trim();
      if (!v) out.phone = "No. telepon wajib diisi";
      else if (!PHONE_RE.test(v)) out.phone = "No. telepon tidak valid (hanya angka, 9–15 digit)";
    }
    if (f === "address") {
      const v = String(p.address || "").trim();
      if (!v) out.address = "Alamat wajib diisi";
      else if (v.length < 10) out.address = "Alamat terlalu pendek (min. 10 karakter)";
    }
    if (f === "photo" && !hasNewPhoto && !String(p.photo_url || "").trim()) out.photo = "Foto profil wajib diunggah";
  }
  return out;
}

export const isProfileComplete = (p: ProfileLike) => Object.keys(profileProblems(p)).length === 0;
