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
import { getCatalogMeta } from "../lib/catalogVersion";

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const only = process.argv[2]; // opsional: "online" | "clearance"
  const keys = Object.keys(CATALOG_CONFIGS).filter((k) => !only || k === only);
  if (keys.length === 0) throw new Error(`Katalog tidak dikenal: ${only}`);

  // Jadwal kedua di hari yang sama tidak perlu membuat ulang bila yang pertama baru sukses
  // (hanya untuk run terjadwal; run manual / dry run selalu jalan).
  const freshHours = Number(process.env.SKIP_IF_FRESH_HOURS || 5);
  const meta = !dry && process.env.GITHUB_EVENT_NAME === "schedule" ? await getCatalogMeta() : null;

  let failed = 0;
  for (const key of keys) {
    const t0 = Date.now();
    try {
      const m = meta?.[key];
      if (m && m.updated_by === "github-actions") {
        const ageH = (Date.now() - Date.parse(m.updated_at.replace(" ", "T").replace(/\+00$/, "Z"))) / 3600_000;
        if (ageH < freshHours) {
          console.log(`↷ ${key}: dilewati — sudah diperbarui GitHub Actions ${ageH.toFixed(1)} jam lalu`);
          continue;
        }
      }
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
