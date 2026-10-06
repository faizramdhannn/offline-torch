import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import sharp from "sharp";
import { getCatalogState } from "@/lib/catalogVersion";
import { getSheetData } from "@/lib/sheets";
import {
  TORCH_LOGO_URL, TORCH_ICON_LOGO_URL, toProducts, renderCatalog,
  type CatalogConfig, type Product,
} from "@/lib/catalogPdfCore";

export type { CatalogConfig };

// File PDF katalog publik — sisi SERVER (dipakai cron harian dan sebagai cadangan bila PDF belum
// diunggah ke Blob). Penyusunan dokumen ada di catalogPdfCore.ts (dipakai juga oleh browser
// Super Admin saat menekan Refresh, supaya CPU Vercel tidak terpakai).

async function fetchRaw(url: string, retries = 1): Promise<Buffer | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(t);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
  }
  return null;
}

// Semua gambar dikecilkan ke JPEG ~480px supaya PDF publik ini tetap ringan.
async function loadProductImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const raw = await fetchRaw(url);
  if (!raw) return null;
  try {
    const out = await sharp(raw)
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 75 })
      .toBuffer({ resolveWithObject: true });
    return { dataUrl: `data:image/jpeg;base64,${out.data.toString("base64")}`, w: out.info.width, h: out.info.height };
  } catch {
    return null;
  }
}

async function loadLogo(url: string): Promise<string | null> {
  const raw = await fetchRaw(url);
  return raw ? `data:image/png;base64,${raw.toString("base64")}` : null;
}

// Unduh semua gambar paralel (pool 16).
async function preloadImages(products: Product[], concurrency = 16) {
  let next = 0;
  const worker = async () => {
    while (next < products.length) {
      const p = products[next++];
      p.img = p.image_url ? await loadProductImage(p.image_url) : null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, products.length) }, worker));
}

// Data katalog dari sheet; hasil kosong (sheet gagal terbaca sesaat) dicoba ulang tanpa cache.
export async function loadCatalogProducts(cfg: CatalogConfig): Promise<Product[]> {
  let products = toProducts((await getSheetData(cfg.sheet)) as any[]);
  if (products.length === 0) products = toProducts((await getSheetData(cfg.sheet, { skipCache: true })) as any[]);
  return products;
}

// Buat PDF di server. null = tidak ada produk (jangan dipublikasikan).
export async function generateCatalogBuffer(cfg: CatalogConfig): Promise<Buffer | null> {
  const products = await loadCatalogProducts(cfg);
  if (products.length === 0) return null;

  const [logo, icon] = await Promise.all([loadLogo(TORCH_LOGO_URL), loadLogo(TORCH_ICON_LOGO_URL), preloadImages(products)]).then(
    (r) => [r[0], r[1]] as [string | null, string | null]
  );
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  renderCatalog(doc, products, logo, icon, cfg);
  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateCatalogResponse(request: Request, cfg: CatalogConfig) {
  const reqUrl = new URL(request.url);
  const download = reqUrl.searchParams.get("download") === "1";
  // Hanya versi terbaru yang dilayani (dan di-cache lama); link lama/tanpa ?v=
  // diarahkan ke versi sekarang.
  const state = await getCatalogState(cfg.key);
  if (reqUrl.searchParams.get("v") !== state.version) {
    reqUrl.searchParams.set("v", state.version);
    return NextResponse.redirect(reqUrl, { status: 307, headers: { "Cache-Control": "no-store" } });
  }

  // PDF sudah dibuat (browser Super Admin / cron) dan tersimpan di Blob → arahkan ke sana, tanpa CPU.
  if (state.blob_url) {
    const to = download ? `${state.blob_url}${state.blob_url.includes("?") ? "&" : "?"}download=1` : state.blob_url;
    return NextResponse.redirect(to, { status: 307, headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  // Cadangan: buat di server (hasil di-cache CDN per versi).
  try {
    const buffer = await generateCatalogBuffer(cfg);
    if (!buffer) {
      // Hasil kosong jangan sampai jadi PDF sampul-doang yang ke-cache CDN.
      return new NextResponse("Katalog belum bisa dimuat, coba lagi sebentar.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${cfg.filename}"`,
        "Cache-Control": "public, s-maxage=31536000, max-age=3600",
      },
    });
  } catch (error) {
    console.error(`Error generating ${cfg.sheet}:`, error);
    return NextResponse.json({ error: "Failed to generate online catalog" }, { status: 500 });
  }
}
