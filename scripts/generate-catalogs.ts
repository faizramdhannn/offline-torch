/**
 * Buat PDF katalog (Online & Clearance) di luar Vercel — dijalankan GitHub Actions
 * (.github/workflows/catalog-refresh.yml) supaya CPU Vercel tidak terpakai.
 *
 * Alur per katalog: baca sheet → unduh & kecilkan gambar → susun PDF (kode yang sama dengan server,
 * lib/catalogPdfCore.ts) → unggah ke Vercel Blob → tulis versi + alamat Blob ke tabel catalog_state (Neon).
 *
 * Env yang dibutuhkan: GOOGLE_CREDENTIALS, SPREADSHEET_CATALOG, DATABASE_URL, BLOB_READ_WRITE_TOKEN.
 * DRY_RUN=1 → hanya membuat PDF ke ./tmp-catalog (tanpa unggah / tanpa ubah database).
 */
import fs from "fs";
import { CATALOG_CONFIGS } from "../lib/catalogs";
import { generateCatalogBuffer } from "../lib/onlineCatalogPdf";

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const only = process.argv[2]; // opsional: "online" | "clearance"
  const keys = Object.keys(CATALOG_CONFIGS).filter((k) => !only || k === only);
  if (keys.length === 0) throw new Error(`Katalog tidak dikenal: ${only}`);

  let failed = 0;
  for (const key of keys) {
    const t0 = Date.now();
    try {
      const buffer = await generateCatalogBuffer(CATALOG_CONFIGS[key]);
      if (!buffer) {
        // Sheet kosong / gagal terbaca: JANGAN menimpa PDF yang sudah tayang.
        console.error(`✗ ${key}: tidak ada produk — dilewati (PDF lama tetap dipakai)`);
        failed++;
        continue;
      }
      const kb = Math.round(buffer.length / 1024);
      if (dry) {
        fs.mkdirSync("tmp-catalog", { recursive: true });
        fs.writeFileSync(`tmp-catalog/${key}.pdf`, buffer);
        console.log(`✓ ${key}: ${kb} KB → tmp-catalog/${key}.pdf (${((Date.now() - t0) / 1000).toFixed(1)} dtk, DRY_RUN)`);
        continue;
      }
      // import dinamis: lib/catalogBlob menyentuh Neon/Blob hanya saat benar-benar mengunggah
      const { publishCatalogPdf } = await import("../lib/catalogBlob");
      const { version, url } = await publishCatalogPdf(key, "github-actions", buffer);
      console.log(`✓ ${key}: ${kb} KB diunggah, versi ${version} (${((Date.now() - t0) / 1000).toFixed(1)} dtk)\n  ${url}`);
    } catch (e: any) {
      console.error(`✗ ${key}: ${e?.message || e}`);
      failed++;
    }
  }
  if (failed > 0) process.exit(1); // workflow merah → GitHub kirim email
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
