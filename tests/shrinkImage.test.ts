import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { shrinkImageBuffer } from "@/lib/shrinkImage";

describe("shrinkImageBuffer", () => {
  it("foto kecil dikembalikan apa adanya (tanpa kompresi ulang)", async () => {
    const small = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const out = await shrinkImageBuffer(small, "image/jpeg");
    expect(out.buffer).toBe(small);
    expect(out.mimeType).toBe("image/jpeg");
  });

  it("foto besar diperkecil ke batas dimensi dan jadi JPEG", async () => {
    // noise acak supaya hasil JPEG tetap besar (> 300 KB)
    const raw = Buffer.alloc(2400 * 1800 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
    const big = await sharp(raw, { raw: { width: 2400, height: 1800, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    expect(big.length).toBeGreaterThan(300 * 1024);
    const out = await shrinkImageBuffer(big, "image/jpeg", 800, 70);
    const meta = await sharp(out.buffer).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(800);
    expect(out.buffer.length).toBeLessThan(big.length);
  });

  it("PDF dan non-gambar tidak disentuh", async () => {
    const pdf = Buffer.from("%PDF-1.4 contoh");
    const out = await shrinkImageBuffer(pdf, "application/pdf");
    expect(out.buffer).toBe(pdf);
  });
});
