import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// E-Catalog Clearance 2 — sheet clearance_product_2. Layout kartu (grid 3
// kolom x 4 baris, slot tetap, gambar contain-fit, baseline harga sejajar)
// mengikuti persis konsep /api/canvasing/ecatalog-pasaraya/generate, TAPI:
//   - Header tiap halaman produk = logo Torch (TORCH_LOGO_URL) polos di
//     tengah atas (bukan banner desain custom seperti Pasaraya/IHLS).
//   - Cover = logo Torch (shopify CDN, dipakai juga di E-Catalog biasa) di
//     atas, judul "Clearance Catalog" di bawahnya — digambar sendiri (bukan
//     gambar cover jadi seperti Pasaraya).
//   - Tiap kartu produk menampilkan STOCK dari kolom `stock_all` SAJA (total
//     gabungan semua store) — sheet-nya MASIH punya kolom
//     stock_lembong/margonda/cirebon/karawang juga (kolom F-I), tapi kolom
//     itu TIDAK dipakai di kode ini, cuma stock_all (kolom paling akhir)
//     yang dibaca dan ditampilkan.
//   - Semua produk masuk (tidak difilter stock), diurutkan by category lalu
//     by artikel, TANPA halaman pembatas kategori — sama seperti Pasaraya.
//
// Sheet: clearance_product_2 — id, sku, item_name, artikel, category,
// stock_lembong, stock_margonda, stock_cirebon, stock_karawang, image_url,
// price, price_promo, stock_all (13 kolom, A-M).
// ─────────────────────────────────────────────────────────────────────────────

const TORCH_LOGO_URL = 'https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png';
const TORCH_ICON_LOGO_URL =
  'https://cdn.shopify.com/s/files/1/1615/1301/files/Untitled_design_162c0ca1-c46e-4635-8f4c-bc44d547ee5e.png?v=1770919047';
const TORCH_BLUE = { r: 11, g: 122, b: 143 };

const PAGE_W = 1080;
const PAGE_H = 1350;
const COLS = 3;
const ROWS = 4;
const PRODUCTS_PER_PAGE = COLS * ROWS; // 12

async function fetchImageBuffer(url: string, retries = 2): Promise<{ buffer: Buffer; mime: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries) continue;
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      let imageData: Buffer = Buffer.from(arrayBuffer);
      let mime = url.includes('.png') ? 'image/png' : 'image/jpeg';

      if (imageData.length / 1024 >= 500) {
        let quality = 85;
        while (imageData.length > 500000 && quality > 10) {
          try {
            const compressed = await sharp(imageData).jpeg({ quality, mozjpeg: true }).toBuffer();
            imageData = compressed;
            mime = 'image/jpeg';
            if (imageData.length > 500000) quality -= 15;
            else break;
          } catch {
            break;
          }
        }
      }

      return { buffer: imageData, mime };
    } catch {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function downloadImage(url: string): Promise<string | null> {
  const r = await fetchImageBuffer(url);
  if (!r) return null;
  return `data:${r.mime};base64,${r.buffer.toString('base64')}`;
}

async function downloadProductImage(
  url: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const r = await fetchImageBuffer(url);
  if (!r) return null;
  let width = 1;
  let height = 1;
  try {
    const meta = await sharp(r.buffer).metadata();
    width = meta.width || 1;
    height = meta.height || 1;
  } catch {}
  return { dataUrl: `data:${r.mime};base64,${r.buffer.toString('base64')}`, width, height };
}

// Format gambar produk bisa PNG ATAU JPEG (sharp cuma convert ke JPEG kalau
// ukuran asli >= 500KB — gambar kecil dipertahankan apa adanya, termasuk PNG).
// Sebelumnya format dikirim hardcode 'JPEG' ke doc.addImage walau datanya PNG,
// bikin jsPDF gagal decode diam-diam → gambar produk tampil kosong/blank.
function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function formatRupiah(value: string | number): string {
  if (!value && value !== 0) return '';
  const raw = typeof value === 'string' ? value.replace(/\D/g, '') : String(value);
  const num = parseInt(raw, 10);
  if (isNaN(num) || num === 0) return '';
  return `Rp. ${num.toLocaleString('id-ID')}`;
}

function parseNum(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const raw = typeof value === 'string' ? value.replace(/[^\d-]/g, '') : String(value);
  const num = parseInt(raw, 10);
  return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
  try {
    const data = await getSheetData('clearance_product_2');

    const products = (data as any[])
      .filter((item) => item.artikel || item.item_name)
      .map((p) => ({
        item_name: p.artikel || p.item_name || '',
        category: p.category || 'Lainnya',
        image_url: p.image_url || '',
        price: p.price || '',
        price_promo: p.price_promo || '',
        stock_all: parseNum(p.stock_all),
      }))
      .sort((a, b) => {
        const catCmp = a.category.localeCompare(b.category, 'id');
        if (catCmp !== 0) return catCmp;
        return a.item_name.localeCompare(b.item_name, 'id');
      });

    const [torchLogo, torchIconLogo] = await Promise.all([
      downloadImage(TORCH_LOGO_URL),
      downloadImage(TORCH_ICON_LOGO_URL),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [PAGE_W, PAGE_H],
      compress: true,
    });

    createCoverPage(doc, torchIconLogo);

    for (let i = 0; i < products.length; i += PRODUCTS_PER_PAGE) {
      const batch = products.slice(i, i + PRODUCTS_PER_PAGE);
      doc.addPage([PAGE_W, PAGE_H]);
      await createProductPage(doc, batch, torchLogo);
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Clearance_Catalog_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating clearance-2 catalog:', error);
    return NextResponse.json({
      error: 'Failed to generate clearance-2 catalog',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

function createCoverPage(doc: jsPDF, logo: string | null) {
  doc.setFillColor(TORCH_BLUE.r, TORCH_BLUE.g, TORCH_BLUE.b);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  if (logo) {
    const logoW = 260;
    const logoH = 104; // rasio ~2.5:1, sama seperti dipakai di E-Catalog biasa
    try { doc.addImage(logo, 'PNG', (PAGE_W - logoW) / 2, PAGE_H / 2 - 160, logoW, logoH); } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(46);
  doc.setFont('helvetica', 'bold');
  doc.text('Clearance Catalog', PAGE_W / 2, PAGE_H / 2 + 20, { align: 'center' });
}

async function createProductPage(doc: jsPDF, products: any[], torchLogo: string | null) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Header: logo Torch polos, center-top.
  const headerLogoW = 195;
  const headerLogoH = 65;
  const headerTopPad = 30;
  if (torchLogo) {
    try {
      doc.addImage(torchLogo, 'PNG', (PAGE_W - headerLogoW) / 2, headerTopPad, headerLogoW, headerLogoH);
    } catch {}
  }
  const headerHeight = headerTopPad + headerLogoH;

  const marginLR = 40;
  const marginBottom = 36;
  const contentTop = headerHeight + 30;

  const contentW = PAGE_W - marginLR * 2;
  const contentH = PAGE_H - contentTop - marginBottom;
  const cellW = contentW / COLS;
  const cellH = contentH / ROWS;

  // ── Layout per-kartu — slot tetap (bukan proporsional ke cellH), sama
  // pola dengan E-Catalog Pasaraya, plus 1 baris tambahan untuk stock per store.
  const NAME_SIZE = 17;
  const NAME_LINE_H = 20;
  const NAME_LINES_RESERVED = 2; // dipakai HANYA untuk hitung budget tinggi gambar (worst-case)
  const STRIKE_SIZE = 12;
  const PROMO_SIZE = 19;
  const STOCK_SIZE = 9;
  const GAP_IMG_TO_NAME = 14;
  const GAP_NAME_TO_PRICE = 6;
  const GAP_STRIKE_TO_PROMO = 15;
  const GAP_PRICE_TO_STOCK = 12;
  const PAD_TOP = 8;

  const nameBlockH = NAME_LINES_RESERVED * NAME_LINE_H;
  const priceBlockH = STRIKE_SIZE + GAP_STRIKE_TO_PROMO + PROMO_SIZE * 0.4;
  const stockBlockH = GAP_PRICE_TO_STOCK + STOCK_SIZE * 1.4; // 1 baris "Stock: N"
  const textZoneH = GAP_IMG_TO_NAME + nameBlockH + GAP_NAME_TO_PRICE + priceBlockH + stockBlockH;

  const imgBoxByWidth = cellW * 0.82;
  const imgBoxByHeight = cellH - PAD_TOP - textZoneH - 16;
  const imgBox = Math.max(60, Math.min(imgBoxByWidth, imgBoxByHeight));

  const images = await Promise.all(
    products.map((p) => (p.image_url ? downloadProductImage(p.image_url) : Promise.resolve(null)))
  );

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const img = images[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const cellX = marginLR + col * cellW;
    const cellY = contentTop + row * cellH;
    const cellCenterX = cellX + cellW / 2;

    // ── Gambar produk — "contain" fit (jaga rasio asli) ──────────────────
    const imgY = cellY + PAD_TOP;
    if (img) {
      const ratio = img.width / img.height || 1;
      const drawW = ratio >= 1 ? imgBox : imgBox * ratio;
      const drawH = ratio >= 1 ? imgBox / ratio : imgBox;
      const drawX = cellCenterX - drawW / 2;
      const drawY = imgY + (imgBox - drawH) / 2;
      try { doc.addImage(img.dataUrl, imageFormatFromDataUrl(img.dataUrl), drawX, drawY, drawW, drawH); } catch {}
    }

    // ── Nama produk ───────────────────────────────────────────────────────
    const textOpts = { align: 'center' as const };
    const textW = cellW - 14;
    const nameTop = imgY + imgBox + GAP_IMG_TO_NAME;

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(NAME_SIZE);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(p.item_name || 'N/A', textW);
    const maxLines = Math.min(lines.length, NAME_LINES_RESERVED);
    for (let j = 0; j < maxLines; j++) {
      doc.text(lines[j], cellCenterX, nameTop + NAME_SIZE + j * NAME_LINE_H, textOpts);
    }

    // ── Harga — baseline promo fixed slot, sama pola dengan Pasaraya ──────
    const priceTop = nameTop + maxLines * NAME_LINE_H + GAP_NAME_TO_PRICE;
    const strikeBaseline = priceTop + STRIKE_SIZE;
    const promoBaseline = strikeBaseline + GAP_STRIKE_TO_PROMO;

    const normalPriceText = formatRupiah(p.price);
    const promoPriceText = formatRupiah(p.price_promo);

    if (promoPriceText) {
      if (normalPriceText) {
        doc.setFontSize(STRIKE_SIZE);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(normalPriceText, cellCenterX, strikeBaseline, textOpts);
        const strikeW = doc.getTextWidth(normalPriceText);
        const textH = doc.getTextDimensions(normalPriceText).h;
        const strikeLineY = strikeBaseline - textH * 0.32;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.7);
        doc.line(cellCenterX - strikeW / 2, strikeLineY, cellCenterX + strikeW / 2, strikeLineY);
      }

      doc.setFontSize(PROMO_SIZE);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TORCH_BLUE.r, TORCH_BLUE.g, TORCH_BLUE.b);
      doc.text(promoPriceText, cellCenterX, promoBaseline, textOpts);
      doc.setTextColor(0, 0, 0);
    } else if (normalPriceText) {
      doc.setFontSize(PROMO_SIZE);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TORCH_BLUE.r, TORCH_BLUE.g, TORCH_BLUE.b);
      doc.text(normalPriceText, cellCenterX, promoBaseline, textOpts);
      doc.setTextColor(0, 0, 0);
    }

    // ── Stock — 1 baris, dari kolom stock_all (bukan per-store lagi) ─────
    const stockTop = promoBaseline + GAP_PRICE_TO_STOCK;
    doc.setFontSize(STOCK_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text(`Stock: ${p.stock_all}`, cellCenterX, stockTop, textOpts);
    doc.setTextColor(0, 0, 0);
  }
}
