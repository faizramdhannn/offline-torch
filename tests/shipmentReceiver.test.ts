import { describe, it, expect } from "vitest";
import { parseReceiver, cleanReceiver, receiverError, normalizePhone } from "../lib/shipmentReceiver";

describe("normalizePhone", () => {
  it("menyeragamkan format", () => {
    expect(normalizePhone("0857-9488-4653")).toBe("085794884653");
    expect(normalizePhone("+62 857 9488 4653")).toBe("085794884653");
    expect(normalizePhone("6285794884653")).toBe("085794884653");
    expect(normalizePhone("85794884653")).toBe("085794884653");
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("parseReceiver", () => {
  it("contoh 1: label Nama/No Hp/Alamat, alamat dua baris", () => {
    const r = parseReceiver("Nama : Irwan Anwarudin\nNo Hp : 085794884653\nAlamat : SD IT INSAN CERMAT \nJl. Cigagak No. 65, RT 2 RW 4, kelurahan Palasari, kecamatan Cibiru, kota Bandung  40615");
    expect(r.name).toBe("Irwan Anwarudin");
    expect(r.phone).toBe("085794884653");
    expect(r.postal).toBe("40615");
    expect(r.address).toBe("SD IT INSAN CERMAT, Jl. Cigagak No. 65, RT 2 RW 4, kelurahan Palasari, kecamatan Cibiru, kota Bandung");
    expect(receiverError(r.text)).toBe("");
  });
  it("contoh 2: label 'Alamat (kec/kota :' dan 'No. Hp'", () => {
    const r = parseReceiver("Nama : Eflin Purba\nNo. Hp : 081385007922\nAlamat (kec/kota : Jl. Tebet Utara I No. 15 C (depan Salon Ever Green Tebet), Jakarta, 12820");
    expect(r.name).toBe("Eflin Purba");
    expect(r.phone).toBe("081385007922");
    expect(r.postal).toBe("12820");
    expect(r.address).toBe("Jl. Tebet Utara I No. 15 C (depan Salon Ever Green Tebet), Jakarta");
  });
  it("nomor bertanda baca & spasi tidak ditolak", () => {
    const t = "Budi Santoso\n+62 812-3456-7890\nJl. Merdeka No. 1, Bandung 40111";
    expect(receiverError(t)).toBe("");
    expect(parseReceiver(t).phone).toBe("081234567890");
  });
  it("tanpa label: baris pertama nama", () => {
    const r = parseReceiver("Siti\n0812 3456 7890\nJl. Mawar 3, Depok 16424");
    expect(r.text).toBe("Siti\n081234567890\nJl. Mawar 3, Depok\n16424");
  });
  it("semua dalam satu baris", () => {
    const r = parseReceiver("Nama: Andi No Hp: 08123456789 Alamat: Jl. Kenari 5, Bekasi 17111");
    expect(r.name).toBe("Andi");
    expect(r.phone).toBe("08123456789");
    expect(r.postal).toBe("17111");
  });
  it("nomor di dalam kurung → kurung kosong dibuang", () => {
    const r = parseReceiver("Miranti (+62 812-3678-2007)\nCluster Pelangi Blok P1A No 01, Makassar 90245");
    expect(r.name).toBe("Miranti");
    expect(r.phone).toBe("081236782007");
  });
  it("tidak ada HP → teks tidak diubah", () => {
    expect(cleanReceiver("Budi\nJl. A 40111")).toBe("Budi\nJl. A 40111");
    expect(receiverError("Budi\nJl. A 40111")).toMatch(/HP/);
  });
});
