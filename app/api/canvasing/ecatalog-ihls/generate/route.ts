import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// E-Catalog IHLS — kanvas persegi 1080x1080px (bukan A4), dipakai untuk event
// IHLS. Beda dari /api/canvasing/ecatalog/generate (Torch E-Catalog, A4, 5
// produk/halaman, ada logo):
//   - 1080x1080 px, 133px paling atas SENGAJA dikosongkan (user pasang header
//     event secara manual belakangan, mis. di Canva/Photoshop).
//   - 3 produk per halaman (bukan 5).
//   - TIDAK ada logo Torch — desain polos.
//   - Pembatas kategori tetap ada (halaman kosong berisi nama kategori),
//     tapi juga polos, tanpa logo.
//   - price ditampilkan tercoret, price_promo ditonjolkan sebagai harga
//     sekarang.
//   - Teks (nama produk/warna/harga) rata kiri (menjorok ke kiri), bukan
//     center — beda dari halaman cover Torch yang center.
//
// Sheet: ihls_product — kolom: id, sku, item_name, artikel, category, color,
// stock, onmodel_url, image_url, price, price_promo.
// ─────────────────────────────────────────────────────────────────────────────

// Kanvas 540x540 (setengah dari 1080 asli) — file jadi lebih ringan (gambar
// di-render lebih kecil), tapi semua proporsi (margin, font, ukuran gambar)
// diturunkan dari SCALE yang sama supaya komposisinya identik, cuma lebih
// kecil.
const SCALE = 540 / 1080;
const PAGE_SIZE = 540; // px, persegi
const HEADER_RESERVED = Math.round(133 * SCALE); // px kosong di paling atas, diisi manual belakangan
const MARGIN = Math.round(40 * SCALE) + 15; // margin kiri & kanan — dibuat lebih lebar dari sebelumnya (sebelumnya kepepet ke tepi)
const MARGIN_BOTTOM = Math.round(20 * SCALE);
const IMAGE_LEFT_INDENT = Math.round(30 * SCALE); // dorong foto lebih ke kanan dari margin kiri, jangan mepet tepi
const PRODUCTS_PER_PAGE = 3;

const COLOR_MAP: Record<string, string> = {
  'black': '#000000', 'grey': '#808080', 'gray': '#808080',
  'dark grey': '#404040', 'dark gray': '#404040',
  'navy': '#000080', 'blue': '#0000FF', 'legion blue': '#1E3A8A',
  'light blue': '#87CEEB', 'green': '#008000', 'olive': '#808000',
  'red': '#FF0000', 'yellow': '#FFFF00', 'pop yellow': '#FFD700',
  'everglade tosca': '#2F7F7F', 'sycamore green': '#8B9467',
  'charcoal grey': '#36454F', 'white': '#FFFFFF',
};

function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName.toLowerCase().trim()] || '#CCCCCC';
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

async function downloadImage(url: string, retries = 2): Promise<string | null> {
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
      let imageData = new Uint8Array(arrayBuffer);
      const originalSizeKB = imageData.length / 1024;

      if (originalSizeKB < 500) {
        const base64 = Buffer.from(imageData).toString('base64');
        const mimeType = url.includes('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
      }

      let quality = 85;
      while (imageData.length > 500000 && quality > 10) {
        try {
          const compressed = await sharp(Buffer.from(imageData))
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          imageData = new Uint8Array(compressed);
          if (imageData.length > 500000) {
            quality -= 15;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      const base64 = Buffer.from(imageData).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
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

// Input  : "150000" | 150000 | "150.000" | "Rp 150000"
// Output : "Rp. 150.000"
function formatRupiah(value: string | number): string {
  if (!value && value !== 0) return '';
  const raw = typeof value === 'string' ? value.replace(/\D/g, '') : String(value);
  const num = parseInt(raw, 10);
  if (isNaN(num) || num === 0) return '';
  return `Rp. ${num.toLocaleString('id-ID')}`;
}

export async function POST(request: NextRequest) {
  try {
    const data = await getSheetData('ihls_product');

    const products = data.filter((item: any) =>
      item.stock === 'TRUE' && item.category
    );

    const grouped: Record<string, any[]> = {};
    products.forEach((p: any) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push({
        item_name: p.item_name || p.artikel || '',
        color: p.color || '',
        price: p.price || '',
        price_promo: p.price_promo || '',
        onmodel_url: p.onmodel_url || '',
        image_url: p.image_url || '',
      });
    });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [PAGE_SIZE, PAGE_SIZE],
      compress: true,
    });

    const categories = Object.keys(grouped).sort();
    let firstPage = true;

    for (const cat of categories) {
      const items = grouped[cat];

      if (!firstPage) doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      firstPage = false;
      createCategoryPage(doc, cat);

      for (let i = 0; i < items.length; i += PRODUCTS_PER_PAGE) {
        const batch = items.slice(i, i + PRODUCTS_PER_PAGE);
        doc.addPage([PAGE_SIZE, PAGE_SIZE]);
        await createProductPage(doc, batch);
      }
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="IHLS_E-Catalog_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating IHLS catalog:', error);
    return NextResponse.json({
      error: 'Failed to generate IHLS catalog',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// Halaman pembatas kategori — polos, tanpa logo. 133px atas tetap
// dikosongkan supaya konsisten dengan halaman produk (header ditempel manual
// belakangan di semua halaman, termasuk ini).
function createCategoryPage(doc: jsPDF, category: string) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, 'F');

  const centerY = HEADER_RESERVED + (PAGE_SIZE - HEADER_RESERVED) / 2;
  const lineHalfW = 30 * SCALE;
  const lineGap = 15 * SCALE;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(PAGE_SIZE / 2 - lineHalfW, centerY - lineGap, PAGE_SIZE / 2 + lineHalfW, centerY - lineGap);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(category.toUpperCase(), PAGE_SIZE / 2, centerY, { align: 'center' });

  doc.line(PAGE_SIZE / 2 - lineHalfW, centerY + lineGap, PAGE_SIZE / 2 + lineHalfW, centerY + lineGap);
}

async function createProductPage(doc: jsPDF, products: any[]) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, 'F');
  // 133px paling atas SENGAJA dibiarkan kosong — jangan gambar apapun di sini.

  // Jarak tambahan setelah zona header kosong, supaya produk pertama tidak
  // langsung nempel/ketutupan header yang ditempel manual belakangan.
  const TOP_PADDING = 30 * SCALE + 10;
  const contentTop = HEADER_RESERVED + TOP_PADDING;
  const contentH = PAGE_SIZE - contentTop - MARGIN_BOTTOM;
  const rowHeight = contentH / PRODUCTS_PER_PAGE;

  const imagePromises = products.slice(0, PRODUCTS_PER_PAGE).map(async (p) => {
    const [onmodel, product] = await Promise.all([
      p.onmodel_url ? downloadImage(p.onmodel_url) : null,
      p.image_url ? downloadImage(p.image_url) : null,
    ]);
    return { onmodel, product };
  });
  const images = await Promise.all(imagePromises);

  for (let i = 0; i < Math.min(products.length, PRODUCTS_PER_PAGE); i++) {
    const p = products[i];
    const img = images[i];
    const y = contentTop + i * rowHeight;

    if (i > 0) {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(1);
      doc.line(MARGIN, y, PAGE_SIZE - MARGIN, y);
    }

    // 2 foto (onmodel_url + image_url) berdampingan. Digeser ke bawah dalam
    // row-nya (bukan center vertikal), dan digeser lebih ke kanan dari tepi
    // kiri (bukan mepet MARGIN persis) sesuai arahan.
    const imgH = rowHeight * 0.72;
    const imgGap = 8 * SCALE;
    const onmodelX = MARGIN + IMAGE_LEFT_INDENT;
    const productX = onmodelX + imgH + imgGap;
    const imgY = y + (rowHeight - imgH) * 0.7;

    if (img.onmodel) {
      try { doc.addImage(img.onmodel, 'JPEG', onmodelX, imgY, imgH, imgH); } catch {}
    }
    if (img.product) {
      try { doc.addImage(img.product, 'JPEG', productX, imgY, imgH, imgH); } catch {}
    }

    // ── Teks — rata kanan (pojok kanan), dengan margin kanan yang jelas ────
    const textRightEdge = PAGE_SIZE - MARGIN;
    const textLeftLimit = productX + imgH + 14 * SCALE;
    const textW = textRightEdge - textLeftLimit;
    let textY = y + rowHeight * 0.3;
    const textOpts = { align: 'right' as const };
    const nameSize = 17, colorLabelSize = 10.5, priceSize = 11, promoSize = 18;
    const lineGapName = 14 * SCALE + 14;

    // 1. Nama produk
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(nameSize);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(p.item_name || 'N/A', textW);
    const maxLines = Math.min(lines.length, 2);
    for (let j = 0; j < maxLines; j++) {
      doc.text(lines[j], textRightEdge, textY + j * lineGapName, textOpts);
    }
    textY += maxLines * lineGapName + 6;

    // 2. Warna — label diukur dulu supaya TIDAK numpuk sama dot (dot digambar
    // dari kanan ke kiri, lalu label ditaruh di sebelah kiri dot terakhir
    // dengan jarak tetap, bukan di posisi tetap seperti sebelumnya).
    if (p.color) {
      const colors = String(p.color).split(';').map((c: string) => c.trim()).filter(Boolean).slice(0, 5);
      const dotRadius = 4 * SCALE + 3;
      const dotSpacing = dotRadius * 2 + 5 * SCALE + 3;
      const dotY = textY - 4;

      for (let k = 0; k < colors.length; k++) {
        const rgb = hexToRgb(getColorHex(colors[k]));
        const cx = textRightEdge - dotRadius - k * dotSpacing;
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.circle(cx, dotY, dotRadius, 'F');
        doc.setDrawColor(140, 140, 140);
        doc.setLineWidth(0.5);
        doc.circle(cx, dotY, dotRadius, 'S');
      }

      const lastDotLeftEdge = textRightEdge - dotRadius * 2 - (colors.length - 1) * dotSpacing;
      doc.setFontSize(colorLabelSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Warna:', lastDotLeftEdge - 6, textY, textOpts);

      textY += 8 * SCALE + 14;
    }

    // 3. Harga biasa — DICORET
    const normalPriceText = formatRupiah(p.price);
    if (normalPriceText) {
      doc.setFontSize(priceSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(normalPriceText, textRightEdge, textY, textOpts);
      const strikeW = doc.getTextWidth(normalPriceText);
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.7);
      doc.line(textRightEdge - strikeW, textY - 3, textRightEdge, textY - 3);
      textY += 8 * SCALE + 12;
    }

    // 4. Harga promo — ditonjolkan sebagai harga sekarang
    const promoPriceText = formatRupiah(p.price_promo);
    if (promoPriceText) {
      doc.setFontSize(promoSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(promoPriceText, textRightEdge, textY, textOpts);
      doc.setTextColor(0, 0, 0);
    }
  }
}
