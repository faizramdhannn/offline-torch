// Perkecil gambar sebelum disimpan ke Drive: mengurangi storage, bandwidth
// download, dan waktu proses function. Non-gambar (PDF, dll) dibiarkan.
export async function shrinkImageBuffer(
  buffer: Buffer,
  mimeType: string,
  maxDimension = 1600,
  quality = 75,
  // Foto yang sudah kecil (mis. sudah dikompres di browser) tidak diproses ulang: hemat CPU dan
  // menghindari kompresi JPEG ganda yang menurunkan kualitas.
  skipBelowBytes = 300 * 1024
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith('image/') || mimeType.includes('svg') || mimeType.includes('gif')) {
    return { buffer, mimeType };
  }
  if (buffer.length <= skipBelowBytes) return { buffer, mimeType };
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

// Logo badge disimpan sebagai data URL di database dan ikut di SETIAP respons daftar badge —
// harus kecil. Perkecil ke 128px (PNG, transparansi dipertahankan). Selain data URL gambar dibiarkan.
export async function shrinkLogoDataUrl(dataUrl: string | null | undefined): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl ?? null;
  if (dataUrl.length < 20_000) return dataUrl;
  try {
    const sharp = (await import('sharp')).default;
    const buf = Buffer.from(dataUrl.split(',')[1] || '', 'base64');
    const out = await sharp(buf)
      .resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const small = `data:image/png;base64,${out.toString('base64')}`;
    return small.length < dataUrl.length ? small : dataUrl;
  } catch {
    return dataUrl;
  }
}
