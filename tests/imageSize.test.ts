import { describe, it, expect } from "vitest";
import { fitBox, imageSize } from "@/lib/imageSize";

const png = (w: number, h: number) => { const b = Buffer.alloc(32); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
// JPEG minimal: SOI + APP0(len 16) + SOF0 (tinggi, lebar)
const jpg = (w: number, h: number) => {
  const b = Buffer.alloc(64);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08], 20);
  b.writeUInt16BE(h, 25); b.writeUInt16BE(w, 27);
  return b;
};

describe("imageSize & fitBox", () => {
  it("membaca ukuran PNG dan JPEG", () => {
    expect(imageSize(png(800, 350))).toEqual({ width: 800, height: 350 });
    expect(imageSize(jpg(640, 480))).toEqual({ width: 640, height: 480 });
    expect(imageSize(Buffer.from("bukan gambar bukan gambar"))).toBeNull();
  });
  it("fitBox menjaga rasio dalam kotak maksimum", () => {
    const f = fitBox(800, 350, 60, 30); // lebar menjadi penentu
    expect(f.w).toBeCloseTo(60);
    expect(f.h).toBeCloseTo(26.25);
    const t = fitBox(200, 400, 60, 30); // tinggi menjadi penentu
    expect(t.h).toBeCloseTo(30);
    expect(t.w).toBeCloseTo(15);
  });
});
