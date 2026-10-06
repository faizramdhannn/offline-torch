import { put, del } from "@vercel/blob";
import { getCatalogState, publishCatalogBlob } from "./catalogVersion";

// Blob tersedia bila ada token klasik (BLOB_READ_WRITE_TOKEN) ATAU store terhubung lewat OIDC (BLOB_STORE_ID,
// dibuat otomatis Vercel saat store dihubungkan ke project).
export const blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Simpan PDF katalog ke Vercel Blob, jadikan versi aktif, lalu hapus PDF lama (hemat kuota 1 GB).
export async function publishCatalogPdf(key: string, by: string, bytes: Buffer | Uint8Array): Promise<{ version: string; url: string }> {
  const previous = (await getCatalogState(key)).blob_url;
  const blob = await put(`catalog/${key}-${Date.now()}.pdf`, Buffer.from(bytes), {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });
  const version = await publishCatalogBlob(key, by, blob.url);
  if (previous && previous !== blob.url) await del(previous).catch(() => {});
  return { version, url: blob.url };
}
