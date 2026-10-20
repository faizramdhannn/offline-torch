import { describe, it, expect } from "vitest";
import { warehouseBelongsTo, scopeStockRows, isStoreScoped } from "../lib/stockScope";

describe("stockScope", () => {
  const lembong = { name: "Torch Lembong", user_name: "lembong" };
  it("mencocokkan nama akun dengan gudang", () => {
    expect(warehouseBelongsTo(lembong, "Torch Store Lembong - T")).toBe(true);
    expect(warehouseBelongsTo({ name: "Torch Cirebon", user_name: "cirebon" }, "Torch Store Cirebon - T")).toBe(true);
    expect(warehouseBelongsTo({ name: "Torch Lampung", user_name: "lampung" }, "Torch Lampung - T")).toBe(true);
  });
  it("tidak cocok ke toko lain / partner", () => {
    expect(warehouseBelongsTo(lembong, "Torch Jogja - T")).toBe(false);
    expect(warehouseBelongsTo(lembong, "Torch Neka Condet - T")).toBe(false);
    expect(warehouseBelongsTo(lembong, "")).toBe(false);
  });
  it("Store/Merchant melihat semua toko & merchant, bukan partner", () => {
    const accounts = [lembong, { name: "Torch Jogja", user_name: "jogja" }, { name: "Torch Lampung", user_name: "lampung" }];
    const rows = [
      { warehouse: "Torch Jogja - T" }, { warehouse: "Torch Store Lembong - T" }, { warehouse: "Torch Lampung - T" },
      { warehouse: "Torch Neka Condet - T" }, { warehouse: "Torch Gramedia Pandanaran - T" }, { warehouse: "Vega Toys & Hobbies - T" },
    ];
    expect(scopeStockRows(rows, accounts).map((r) => r.warehouse)).toEqual(["Torch Jogja - T", "Torch Store Lembong - T", "Torch Lampung - T"]);
  });
  it("peran", () => {
    expect(isStoreScoped("store")).toBe(true);
    expect(isStoreScoped("merchant")).toBe(true);
    expect(isStoreScoped("admin")).toBe(false);
  });
});
