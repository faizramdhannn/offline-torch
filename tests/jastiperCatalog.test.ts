import { describe, expect, it } from "vitest";
import { buildJastiperCatalog, jastiperGroupOf } from "../lib/jastiperCatalog";

const row = (o: Record<string, any>) => ({ artikel: "Travi", warna: "Black", kategori: "Packing System", stok: "10", harga_normal: "100000", harga_tampil: "80000", foto_utama: "", semua_foto: "", ...o });

describe("katalog jastiper", () => {
  it("membuang SKU & artikel yang stoknya 0", () => {
    const d = buildJastiperCatalog([row({ stok: "0" }), row({ artikel: "Ace", stok: "3" })]);
    expect(d.products.map((p) => p.name)).toEqual(["Ace"]);
  });

  it("warna habis pada artikel yang masih ready hanya jadi penanda (tanpa foto/harga)", () => {
    const d = buildJastiperCatalog([
      row({ warna: "Black", foto_utama: "https://cdn/x.jpg?v=1", semua_foto: "https://cdn/x.jpg?v=1;https://cdn/y.jpg" }),
      row({ warna: "Navy", stok: "0", foto_utama: "https://cdn/n.jpg", harga_tampil: "99000" }),
    ]);
    const [black, navy] = d.products[0].colors;
    expect(black.images).toEqual(["https://cdn/x.jpg?v=1", "https://cdn/y.jpg"]);
    expect(black.price).toBe(80000);
    expect(black.normal).toBe(100000);
    expect(navy).toEqual({ name: "Navy", hex: expect.any(String), soldOut: true });
  });

  it("product_tampil FALSE membuang SKU itu; kosong/TRUE tampil", () => {
    const d = buildJastiperCatalog([
      row({ artikel: "A", product_tampil: "FALSE" }),
      row({ artikel: "B", product_tampil: "TRUE" }),
      row({ artikel: "C" }),
      row({ artikel: "D", warna: "Black" }),
      row({ artikel: "D", warna: "Navy", product_tampil: "false" }),
    ]);
    expect(d.products.map((p) => p.name)).toEqual(["B", "C", "D"]);
    expect(d.products[2].colors.map((c) => c.name)).toEqual(["Black"]);
  });

  it("urut grup seperti Online (Backpack dulu), Lainnya paling akhir, lalu A–Z", () => {
    const d = buildJastiperCatalog([
      row({ artikel: "Kaos", kategori: "Apparel" }),
      row({ artikel: "Zeta", kategori: "Backpack" }),
      row({ artikel: "Alfa", kategori: "Backpack" }),
      row({ artikel: "Sling X", kategori: "Sling Bag" }),
      row({ artikel: "Jam", kategori: "Watch" }),
    ]);
    expect(d.products.map((p) => p.name)).toEqual(["Alfa", "Zeta", "Sling X", "Jam", "Kaos"]);
    expect(d.groups).toEqual(["Backpack", "Sling Bag", "Accessories", "Lainnya"]);
  });

  it("peta grup", () => {
    expect(jastiperGroupOf("Sandal", "Sandal X")).toBe("Lainnya");
    expect(jastiperGroupOf("Accessories", "Kiip")).toBe("Accessories");
    expect(jastiperGroupOf("", "Mini Tote Backpack")).toBe("Backpack");
    expect(jastiperGroupOf("", "Entah")).toBe("Lainnya");
  });

  it("stok per warna ikut (dijumlah antar SKU), tier_product tidak", () => {
    const d = buildJastiperCatalog([row({ tier_product: "Smart", stok: "10" }), row({ sku: "2", stok: "5" })]);
    expect(d.products[0].colors[0].stock).toBe(15);
    expect(JSON.stringify(d)).not.toMatch(/Smart/);
  });
});
