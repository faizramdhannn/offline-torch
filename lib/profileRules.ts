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

// Nomor telepon selalu disimpan sebagai angka berawalan 62 (tanpa +, spasi, strip).
// 0812… → 62812…, +62 812… → 62812…, 812… → 62812….
export function normalizePhone(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}
const PHONE_RE = /^62\d{9,13}$/;

// Kode pos Indonesia = 5 digit yang berdiri sendiri (bukan bagian dari angka lebih panjang).
export const hasPostalCode = (address: string) => /(?<!\d)\d{5}(?!\d)/.test(String(address || ""));

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
      const raw = String(p.phone || "").trim();
      const v = normalizePhone(raw);
      if (!raw) out.phone = "No. telepon wajib diisi";
      else if (!PHONE_RE.test(v)) out.phone = "No. telepon tidak valid (contoh: 081234567890 atau 6281234567890)";
    }
    if (f === "address") {
      const v = String(p.address || "").trim();
      if (!v) out.address = "Alamat wajib diisi";
      else if (v.length < 10) out.address = "Alamat terlalu pendek (min. 10 karakter)";
      else if (!hasPostalCode(v)) out.address = "Alamat harus mencantumkan kode pos (5 digit)";
    }
    if (f === "photo" && !hasNewPhoto && !String(p.photo_url || "").trim()) out.photo = "Foto profil wajib diunggah";
  }
  // Alamat tidak wajib untuk role lain, tapi bila diisi tetap harus memuat kode pos.
  const addr = String(p.address || "").trim();
  if (!requiredProfileFields(p.role).includes("address") && addr && !hasPostalCode(addr)) {
    out.address = "Alamat harus mencantumkan kode pos (5 digit)";
  }
  return out;
}

export const isProfileComplete = (p: ProfileLike) => Object.keys(profileProblems(p)).length === 0;
