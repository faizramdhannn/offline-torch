// Perkecil gambar sebelum disimpan ke Drive: mengurangi storage, bandwidth
// download, dan waktu proses function. Non-gambar (PDF, dll) dibiarkan.
export async function shrinkImageBuffer(
  buffer: Buffer,
  mimeType: string,
  maxDimension = 1600,
  quality = 75
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith('image/') || mimeType.includes('svg') || mimeType.includes('gif')) {
    return { buffer, mimeType };
  }
  try {
    // Import dinamis: sharp (native) hanya dimuat saat benar-benar ada gambar yang diproses.
    const sharp = (await import('sharp')).default;
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return out.length < buffer.length ? { buffer: out, mimeType: 'image/jpeg' } : { buffer, mimeType };
  } catch {
    return { buffer, mimeType };
  }
}
