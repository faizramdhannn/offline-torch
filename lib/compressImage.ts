// Vercel membatasi body request function di ~4.5MB (413 FUNCTION_PAYLOAD_TOO_LARGE).
// Foto kamera HP sering 5-10MB, jadi perkecil di browser sebelum di-upload.
export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.8,
  skipBelowBytes = 800 * 1024
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= skipBelowBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
