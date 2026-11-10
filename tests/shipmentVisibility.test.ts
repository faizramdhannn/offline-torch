import { describe, expect, it } from "vitest";
import { canSeeShipment, normStore, receiverStoreName } from "../lib/shipmentVisibility";

const row = { request_by: "lembong", sender: "Torch Cirebon", receiver: "Torch Margonda\n0812345678\nJl. Margonda Raya No. 1" };

describe("visibilitas Request Shipment", () => {
  it("terlihat oleh pembuat, pengirim, dan penerima", () => {
    expect(canSeeShipment(row, "lembong")).toBe(true); // request_by
    expect(canSeeShipment(row, "Torch Cirebon")).toBe(true); // pengirim
    expect(canSeeShipment(row, "Torch Margonda")).toBe(true); // penerima
  });

  it("nama akun boleh tanpa awalan Torch / beda huruf besar-kecil", () => {
    expect(canSeeShipment(row, "cirebon")).toBe(true);
    expect(canSeeShipment(row, "MARGONDA")).toBe(true);
  });

  it("toko lain tidak melihat", () => {
    expect(canSeeShipment(row, "Torch Medan")).toBe(false);
    expect(canSeeShipment(row, "bekasi")).toBe(false);
    expect(canSeeShipment(row, "")).toBe(false);
  });

  it("penerima teks bebas (bukan toko) tidak cocok dengan akun toko", () => {
    const r = { request_by: "lembong", sender: "Torch Cirebon", receiver: "Budi Santoso\n081234\nJl. Mawar 5" };
    expect(canSeeShipment(r, "Torch Margonda")).toBe(false);
    expect(canSeeShipment(r, "lembong")).toBe(true);
  });

  it("helper", () => {
    expect(normStore("Torch Margonda")).toBe("margonda");
    expect(normStore("Torch")).toBe("");
    expect(receiverStoreName("Torch Margonda\r\n0812")).toBe("Torch Margonda");
  });
});
