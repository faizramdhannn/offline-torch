import { describe, expect, it } from "vitest";
import { codeHours, totalHours } from "../components/attendance/utils";

describe("jam kerja attendance", () => {
  it("jam per kode", () => {
    const hours = { P: 8, S: 8, M: 8, MF: 10, F: 12, O: 0, C: 0, "+": 0, I: 0, A: 0 } as Record<string, number>;
    for (const [code, h] of Object.entries(hours)) expect(codeHours(code, "Torch Lembong")).toBe(h);
  });

  it("Full 13 jam di Karawang, Purwokerto, Jogja (tanpa peduli huruf besar/kecil)", () => {
    expect(codeHours("F", "Torch Karawang")).toBe(13);
    expect(codeHours("F", "TORCH PURWOKERTO")).toBe(13);
    expect(codeHours("F", "Torch Jogja")).toBe(13);
    expect(codeHours("MF", "Torch Karawang")).toBe(10); // hanya F yang 13
  });

  it("kode kosong / tak dikenal = 0, huruf kecil & spasi tetap dibaca", () => {
    expect(codeHours("", "Torch X")).toBe(0);
    expect(codeHours(undefined, "Torch X")).toBe(0);
    expect(codeHours("Z", "Torch X")).toBe(0);
    expect(codeHours(" p ", "Torch X")).toBe(8);
  });

  it("total seminggu", () => {
    expect(totalHours(["P", "S", "F", "MF", "O", "C", ""], "Torch Lembong")).toBe(8 + 8 + 12 + 10);
    expect(totalHours(["F", "F", "F", "F", "F", "O", "O"], "Torch Karawang")).toBe(65);
  });
});
