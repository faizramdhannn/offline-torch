// Ukuran piksel gambar dari header file (PNG/JPEG/GIF/WebP) tanpa dependensi — untuk menjaga rasio gambar saat dicetak ke PDF/Word.
export function imageSize(input: Buffer): { width: number; height: number } | null {
  const b = input;
  if (b.length < 24) return null;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // GIF
  if (b.toString("ascii", 0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  // JPEG: cari penanda SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  // WebP (VP8 / VP8L / VP8X)
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const t = b.toString("ascii", 12, 16);
    if (t === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (t === "VP8L") { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (t === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

// Muat gambar ke dalam kotak maksimum tanpa merusak rasio (tidak diperbesar melebihi kotak).
export function fitBox(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: maxW, h: maxH };
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}

export function dataUriToBuffer(uri: string): Buffer | null {
  const m = uri.match(/^data:[^;]+;base64,(.*)$/);
  return m ? Buffer.from(m[1], "base64") : null;
}
