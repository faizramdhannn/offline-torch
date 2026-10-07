import { describe, it, expect } from "vitest";
import { isNewBuild } from "@/lib/buildInfo";

describe("deteksi deployment baru", () => {
  it("versi berbeda = ada pembaruan", () => {
    expect(isNewBuild("abc123", "def456")).toBe(true);
  });
  it("versi sama = tidak ada pembaruan", () => {
    expect(isNewBuild("abc123", "abc123")).toBe(false);
  });
  it("mode dev / data kosong tidak pernah memicu notifikasi", () => {
    expect(isNewBuild("dev", "abc")).toBe(false);
    expect(isNewBuild("abc", "dev")).toBe(false);
    expect(isNewBuild(undefined, "abc")).toBe(false);
    expect(isNewBuild("abc", undefined)).toBe(false);
  });
});
