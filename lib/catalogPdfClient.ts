import { renderCatalog, TORCH_LOGO_URL, TORCH_ICON_LOGO_URL, type CatalogConfig, type Product } from "./catalogPdfCore";

// Pembuatan PDF katalog DI BROWSER (Super Admin menekan Refresh) — CPU Vercel tidak terpakai.
// Gambar dari CDN Shopify/ibb mendukung CORS, jadi bisa diolah lewat canvas.

const IMG_MAX = 440;
const IMG_QUALITY = 0.7;

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function shopifyResized(url: string): string {
  if (!/cdn\.shopify\.com/.test(url) || /[?&]width=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}width=${IMG_MAX}`;
}

async function productImage(url: string): Promise<Product["img"]> {
  const bmp = await loadBitmap(shopifyResized(url));
  if (!bmp) return null;
  const scale = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", IMG_QUALITY), w, h };
}

async function pngDataUrl(url: string): Promise<string | null> {
  const bmp = await loadBitmap(url);
  if (!bmp) return null;
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")?.drawImage(bmp, 0, 0);
  bmp.close();
  return canvas.toDataURL("image/png");
}

export async function buildCatalogPdfInBrowser(key: string, onProgress: (text: string) => void): Promise<Blob> {
  onProgress("Mengambil data katalog…");
  const res = await fetch(`/api/catalog/data?key=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil data katalog");
  const { cfg, products }: { cfg: CatalogConfig; products: Product[] } = await res.json();
  if (!products.length) throw new Error("Tidak ada produk dengan stock > 0");

  const [{ default: jsPDF }, logo, icon] = await Promise.all([
    import("jspdf"),
    pngDataUrl(TORCH_LOGO_URL),
    pngDataUrl(TORCH_ICON_LOGO_URL),
  ]);

  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < products.length) {
      const p = products[next++];
      p.img = p.image_url ? await productImage(p.image_url) : null;
      onProgress(`Memproses gambar ${++done}/${products.length}…`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  onProgress("Menyusun PDF…");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  renderCatalog(doc, products, logo, icon, cfg);
  return doc.output("blob");
}

export async function uploadCatalogPdf(key: string, pdf: Blob): Promise<{ version: string; url: string }> {
  if (pdf.size > 4.3 * 1024 * 1024) throw new Error(`PDF terlalu besar (${(pdf.size / 1048576).toFixed(1)} MB, batas ~4,3 MB)`);
  const res = await fetch(`/api/catalog/upload?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdf,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Gagal mengunggah PDF");
  return j;
}
