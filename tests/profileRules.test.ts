import { describe, it, expect } from "vitest";
import { requiredProfileFields, profileProblems, isProfileComplete, normalizePhone, hasPostalCode } from "@/lib/profileRules";

const full = { name: "A", email: "a@b.co", phone: "081234567890", address: "Jl. Contoh No. 1 Jakarta 12345", photo_url: "https://x/y.jpg" };

describe("kelengkapan profil", () => {
  it("Store & Merchant wajib semua termasuk alamat; role lain tidak wajib alamat", () => {
    expect(requiredProfileFields("store")).toContain("address");
    expect(requiredProfileFields("merchant")).toContain("address");
    for (const r of ["super_admin", "admin", "guest", "role_baru", undefined]) {
      expect(requiredProfileFields(r as any)).not.toContain("address");
      expect(requiredProfileFields(r as any)).toEqual(expect.arrayContaining(["name", "email", "phone", "photo"]));
    }
  });

  it("lengkap = tidak ada masalah", () => {
    expect(isProfileComplete({ role: "store", ...full })).toBe(true);
    expect(isProfileComplete({ role: "admin", ...full, address: "" })).toBe(true);
  });

  it("alamat kosong: Store dan Merchant ditolak, Admin boleh", () => {
    expect(profileProblems({ role: "store", ...full, address: "" }).address).toBeTruthy();
    expect(profileProblems({ role: "merchant", ...full, address: "" }).address).toBeTruthy();
    expect(profileProblems({ role: "admin", ...full, address: "" }).address).toBeUndefined();
  });

  it("email, telepon, dan foto divalidasi untuk semua role", () => {
    expect(profileProblems({ role: "admin", ...full, email: "salah" }).email).toBeTruthy();
    expect(profileProblems({ role: "admin", ...full, phone: "abc" }).phone).toBeTruthy();
    expect(profileProblems({ role: "admin", ...full, phone: "+62 812-3456-7890" }).phone).toBeUndefined();
    expect(profileProblems({ role: "admin", ...full, photo_url: "" }).photo).toBeTruthy();
    expect(profileProblems({ role: "admin", ...full, photo_url: "" }, true).photo).toBeUndefined();
  });

  it("nomor telepon dinormalkan berawalan 62", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
    expect(normalizePhone("")).toBe("");
    expect(profileProblems({ role: "admin", ...full, phone: "12345" }).phone).toBeTruthy();
  });

  it("alamat wajib memuat kode pos 5 digit", () => {
    expect(hasPostalCode("Jl. A No.1, Cirebon 45121")).toBe(true);
    expect(hasPostalCode("Jl. A No.1, Cirebon")).toBe(false);
    expect(hasPostalCode("Jl. A No. 123456")).toBe(false); // 6 digit bukan kode pos
    expect(profileProblems({ role: "store", ...full, address: "Jl. Contoh No. 1 Jakarta" }).address).toMatch(/kode pos/i);
    expect(profileProblems({ role: "admin", ...full, address: "Jl. Contoh No. 1 Jakarta" }).address).toMatch(/kode pos/i); // bila diisi
    expect(profileProblems({ role: "admin", ...full, address: "" }).address).toBeUndefined();
  });
});
