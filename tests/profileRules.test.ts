import { describe, it, expect } from "vitest";
import { requiredProfileFields, profileProblems, isProfileComplete } from "@/lib/profileRules";

const full = { name: "A", email: "a@b.co", phone: "081234567890", address: "Jl. Contoh No. 1 Jakarta", photo_url: "https://x/y.jpg" };

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
});
