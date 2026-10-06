import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import sharp from "sharp";
import { getCatalogVersion } from "@/lib/catalogVersion";
import { getSheetData } from "@/lib/sheets";
import { ONLINE_GROUPS, onlineGroupOf, onlineGroupIndex, parseColors } from "@/lib/onlineCatalogMap";

// File PDF Online Catalog (halaman publiknya ada di ../page.tsx, tombol Download pakai ?download=1) — PDF A4, sama konsepnya dengan
// E-Catalog Clearance 2 tapi dengan warna per grup + pilihan warna produk,
// TANPA jumlah stock. Produk dengan stock 0 tidak ditampilkan sama sekali.
// Sheet: online_catalog (id, artikel, category, color, stock, image_url, price).
const TORCH_LOGO_URL = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";
const TORCH_ICON_LOGO_URL =
  "https://cdn.shopify.com/s/files/1/1615/1301/files/Untitled_design_162c0ca1-c46e-4635-8f4c-bc44d547ee5e.png?v=1770919047";
const BRAND = "#0b7a8f";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const HEADER_H = 24;
const FOOTER_H = 9;
const CONTENT_TOP = HEADER_H + 4;
const CONTENT_H = PAGE_H - CONTENT_TOP - FOOTER_H;
const COLS = 3;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CELL_W = CONTENT_W / COLS;
const CELL_H = 58;
const BANNER_H = 11;
const BANNER_SLOT = BANNER_H + 3;

type Product = {
  artikel: string;
  group: string;
  colors: { name: string; hex: string }[];
  image_url: string;
  price: string;
  img?: { dataUrl: string; w: number; h: number } | null;
};

type PageRow = { type: "banner"; group: string } | { type: "cards"; items: Product[] };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function parseNum(v: unknown): number {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function formatRupiah(v: string): string {
  const n = parseNum(v);
  return n > 0 ? `Rp. ${n.toLocaleString("id-ID")}` : "";
}

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

// Semua gambar dikecilkan ke JPEG ~600px supaya PDF publik ini tetap ringan.
async function loadProductImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const raw = await fetchRaw(url);
  if (!raw) return null;
  try {
    const out = await sharp(raw)
      .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78 })
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

function paginate(rows: PageRow[]): PageRow[][] {
  const pages: PageRow[][] = [];
  let cur: PageRow[] = [];
  let used = 0;
  const flush = () => {
    if (cur.length) pages.push(cur);
    cur = [];
    used = 0;
  };
  for (const row of rows) {
    if (row.type === "banner") {
      if (used + BANNER_SLOT + CELL_H > CONTENT_H + 0.5) flush();
      cur.push(row);
      used += BANNER_SLOT;
    } else {
      if (used + CELL_H > CONTENT_H + 0.5) flush();
      cur.push(row);
      used += CELL_H;
    }
  }
  flush();
  return pages;
}

function drawCover(doc: jsPDF, icon: string | null, title: string) {
  const [r, g, b] = hexToRgb(BRAND);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // dekorasi: setengah lingkaran berwarna di tepi bawah
  ONLINE_GROUPS.forEach((grp, i) => {
    const [cr, cg, cb] = hexToRgb(grp.color);
    doc.setFillColor(cr, cg, cb);
    doc.circle(20 + i * 42, PAGE_H + 8, 24, "F");
  });
  doc.setFillColor(255, 255, 255);
  doc.circle(PAGE_W - 12, 22, 34, "F");
  doc.setFillColor(r, g, b);
  doc.circle(PAGE_W - 12, 22, 29, "F");

  if (icon) {
    try { doc.addImage(icon, "PNG", PAGE_W / 2 - 28, 92, 56, 22); } catch {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  doc.text(title, PAGE_W / 2, 140, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const bulan = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  doc.text(bulan, PAGE_W / 2, 150, { align: "center" });

  // chip grup berwarna
  const chipW = 32;
  const gap = 4;
  const total = ONLINE_GROUPS.length * chipW + (ONLINE_GROUPS.length - 1) * gap;
  let x = (PAGE_W - total) / 2;
  ONLINE_GROUPS.forEach((grp) => {
    const [cr, cg, cb] = hexToRgb(grp.color);
    doc.setFillColor(cr, cg, cb);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, 170, chipW, 8, 4, 4, "FD");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(grp.name, x + chipW / 2, 175.2, { align: "center" });
    x += chipW + gap;
  });
}

function drawPageChrome(doc: jsPDF, logo: string | null, pageNo: number, title: string) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  // strip warna grup di paling atas
  const segW = PAGE_W / ONLINE_GROUPS.length;
  ONLINE_GROUPS.forEach((g, i) => {
    const [r, gg, b] = hexToRgb(g.color);
    doc.setFillColor(r, gg, b);
    doc.rect(i * segW, 0, segW, 3, "F");
  });
  if (logo) {
    try { doc.addImage(logo, "PNG", MARGIN, 8, 36, 12); } catch {}
  }
  const [br, bg, bb] = hexToRgb(BRAND);
  doc.setTextColor(br, bg, bb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), PAGE_W - MARGIN, 15, { align: "right" });
  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, HEADER_H, PAGE_W - MARGIN, HEADER_H);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(String(pageNo), PAGE_W / 2, PAGE_H - 5, { align: "center" });
}

function drawBanner(doc: jsPDF, group: string, y: number) {
  const g = ONLINE_GROUPS.find((x) => x.name === group);
  const [r, gg, b] = hexToRgb(g ? g.color : BRAND);
  doc.setFillColor(r, gg, b);
  doc.roundedRect(MARGIN, y, CONTENT_W, BANNER_H, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const cx = PAGE_W / 2;
  doc.text(group, cx, y + 7.4, { align: "center" });
  const tw = doc.getTextWidth(group);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 8, y + BANNER_H / 2, cx - tw / 2 - 5, y + BANNER_H / 2);
  doc.line(cx + tw / 2 + 5, y + BANNER_H / 2, PAGE_W - MARGIN - 8, y + BANNER_H / 2);
}

// Unduh semua gambar paralel (pool 16) di awal — sebelumnya per-baris
// berurutan, total ~50 detik untuk 84 produk, hampir mentok maxDuration.
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

function drawCards(doc: jsPDF, items: Product[], y: number) {
  const images = items.map((p) => p.img || null);
  const [br, bg, bb] = hexToRgb(BRAND);
  items.forEach((p, i) => {
    const g = ONLINE_GROUPS.find((x) => x.name === p.group);
    const [ar, ag, ab] = hexToRgb(g ? g.color : BRAND);
    const x = MARGIN + i * CELL_W + 1.2;
    const w = CELL_W - 2.4;
    const h = CELL_H - 2.5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
    doc.setFillColor(ar, ag, ab);
    doc.roundedRect(x + 0.1, y + 0.1, w - 0.2, 1.4, 0.7, 0.7, "F");

    const cx = x + w / 2;
    const img = images[i];
    const box = 32;
    if (img) {
      const ratio = img.w / img.h || 1;
      const dw = ratio >= 1 ? box : box * ratio;
      const dh = ratio >= 1 ? box / ratio : box;
      try { doc.addImage(img.dataUrl, "JPEG", cx - dw / 2, y + 3 + (box - dh) / 2, dw, dh); } catch {}
    }

    doc.setTextColor(25, 25, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const lines = (doc.splitTextToSize(p.artikel || "-", w - 5) as string[]).slice(0, 2);
    lines.forEach((ln, j) => doc.text(ln, cx, y + 38 + j * 3.2, { align: "center" }));

    // pilihan warna: titik berwarna + nama
    if (p.colors.length) {
      const r = 1.25;
      const step = 3.6;
      const maxDots = Math.min(p.colors.length, 8);
      const startX = cx - ((maxDots - 1) * step) / 2;
      for (let k = 0; k < maxDots; k++) {
        const [cr, cg, cb] = hexToRgb(p.colors[k].hex);
        doc.setFillColor(cr, cg, cb);
        doc.setDrawColor(190, 190, 190);
        doc.setLineWidth(0.2);
        doc.circle(startX + k * step, y + 44.6, r, "FD");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(110, 110, 110);
      const names = p.colors.map((c) => c.name).join(", ");
      const nameLine = (doc.splitTextToSize(names, w - 4) as string[])[0];
      doc.text(nameLine, cx, y + 48, { align: "center" });
    }

    const price = formatRupiah(p.price);
    if (price) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(br, bg, bb);
      doc.text(price, cx, y + h - 1.8, { align: "center" });
    }
  });
}

export interface CatalogConfig {
  key: string;
  sheet: string;
  title: string;
  filename: string;
}

export async function generateCatalogResponse(request: Request, cfg: CatalogConfig) {
  const reqUrl = new URL(request.url);
  const download = reqUrl.searchParams.get("download") === "1";
  // Hanya versi terbaru yang dilayani (dan di-cache lama); link lama/tanpa ?v=
  // diarahkan ke versi sekarang.
  const current = await getCatalogVersion(cfg.key);
  if (reqUrl.searchParams.get("v") !== current) {
    reqUrl.searchParams.set("v", current);
    return NextResponse.redirect(reqUrl, { status: 307, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const toProducts = (data: any[]): Product[] =>
      data
        .filter((r) => (r.artikel || "").trim() && parseNum(r.stock) > 0)
        .map((r) => ({
          artikel: String(r.artikel).trim(),
          group: onlineGroupOf(r.category, r.artikel),
          colors: parseColors(r.color),
          image_url: String(r.image_url || "").trim(),
          price: String(r.price || ""),
        }))
        .sort((a, b) => onlineGroupIndex(a.group) - onlineGroupIndex(b.group));

    let products = toProducts((await getSheetData(cfg.sheet)) as any[]);
    // Hasil kosong (biasanya sheet gagal terbaca sesaat) jangan sampai jadi PDF
    // sampul-doang yang ke-cache CDN berjam-jam — coba ulang tanpa cache, kalau
    // tetap kosong balas 503 no-store.
    if (products.length === 0) {
      products = toProducts((await getSheetData(cfg.sheet, { skipCache: true })) as any[]);
    }
    if (products.length === 0) {
      return new NextResponse("Katalog belum bisa dimuat, coba lagi sebentar.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const [logo, icon] = await Promise.all([loadLogo(TORCH_LOGO_URL), loadLogo(TORCH_ICON_LOGO_URL), preloadImages(products)]).then((r) => [r[0], r[1]] as [string | null, string | null]);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    drawCover(doc, icon, cfg.title);

    const rows: PageRow[] = [];
    let currentGroup = "";
    let buf: Product[] = [];
    const flushRow = () => {
      if (buf.length) rows.push({ type: "cards", items: buf });
      buf = [];
    };
    for (const p of products) {
      if (p.group !== currentGroup) {
        flushRow();
        currentGroup = p.group;
        rows.push({ type: "banner", group: currentGroup });
      }
      buf.push(p);
      if (buf.length === COLS) flushRow();
    }
    flushRow();

    let pageNo = 1;
    for (const pageRows of paginate(rows)) {
      doc.addPage("a4", "portrait");
      pageNo += 1;
      drawPageChrome(doc, logo, pageNo, cfg.title);
      let y = CONTENT_TOP;
      for (const row of pageRows) {
        if (row.type === "banner") {
          drawBanner(doc, row.group, y);
          y += BANNER_SLOT;
        } else {
          drawCards(doc, row.items, y);
          y += CELL_H;
        }
      }
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buffer, {
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
