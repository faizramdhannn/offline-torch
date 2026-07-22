import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// E-Catalog IHLS — kanvas persegi 540x540px (bukan A4), dipakai untuk event
// IHLS. Beda dari /api/canvasing/ecatalog/generate (Torch E-Catalog, A4, 5
// produk/halaman):
//   - 540x540 px, background HEADER_IMAGE_URL (header event) ditempel
//     otomatis di SETIAP halaman produk — bukan lagi dikosongkan untuk
//     ditempel manual belakangan.
//   - 3 produk per halaman.
//   - TIDAK ada logo Torch tambahan dari kode — cuma background header itu.
//   - Semua produk digabung jadi SATU urutan, diurutkan berdasarkan nama
//     produk (item_name) — TIDAK dikelompokkan per kategori, TIDAK ada
//     halaman pembatas kategori.
//   - Kolom `color` di sheet sudah dikosongkan user, jadi bagian "Warna"
//     dihapus total dari layout.
//   - price ditampilkan tercoret, price_promo ditonjolkan sebagai harga
//     sekarang.
//   - Teks (nama produk/harga) rata kanan (pojok kanan halaman).
//
// Sheet: ihls_product — kolom: id, sku, item_name, artikel, category, color,
// stock, onmodel_url, image_url, price, price_promo. (`category`/`color`
// tidak lagi dipakai untuk grouping/tampilan, tapi kolomnya boleh tetap ada
// di sheet.)
// ─────────────────────────────────────────────────────────────────────────────

// Background header event — didownload sekali, ditempel di SETIAP halaman
// produk sebagai gambar penuh 1 halaman (bagian putih di bawah header dipakai
// utk konten produk, sisanya adalah desain header itu sendiri).
const HEADER_IMAGE_URL = 'https://i.ibb.co.com/BVNJmN2M/IHLS-E-Catalog-1784628371921-pdf.png';
// Diukur langsung dari file aslinya (2000x2000px): baris ke-436 adalah batas
// akhir header / awal area putih untuk konten produk.
const HEADER_HEIGHT_RATIO = 436 / 2000;

const SCALE = 540 / 1080;
const PAGE_SIZE = 540; // px, persegi
const HEADER_HEIGHT = Math.round(PAGE_SIZE * HEADER_HEIGHT_RATIO);
const MARGIN = Math.round(40 * SCALE) + 15;
const MARGIN_BOTTOM = Math.round(20 * SCALE);
const IMAGE_LEFT_INDENT = Math.round(30 * SCALE); // dorong foto lebih ke kanan dari margin kiri, jangan mepet tepi
const PRODUCTS_PER_PAGE = 3;

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

    const products = data
      .filter((item: any) => item.stock === 'TRUE')
      .map((p: any) => ({
        item_name: p.artikel || p.item_name || '',
        price: p.price || '',
        price_promo: p.price_promo || '',
        onmodel_url: p.onmodel_url || '',
        image_url: p.image_url || '',
      }))
      .sort((a: any, b: any) => a.item_name.localeCompare(b.item_name, 'id'));

    const headerImage = await downloadImage(HEADER_IMAGE_URL);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [PAGE_SIZE, PAGE_SIZE],
      compress: true,
    });

    let firstPage = true;
    for (let i = 0; i < products.length; i += PRODUCTS_PER_PAGE) {
      const batch = products.slice(i, i + PRODUCTS_PER_PAGE);
      if (!firstPage) doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      firstPage = false;
      await createProductPage(doc, batch, headerImage);
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

async function createProductPage(doc: jsPDF, products: any[], headerImage: string | null) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, 'F');

  if (headerImage) {
    try { doc.addImage(headerImage, 'PNG', 0, 0, PAGE_SIZE, PAGE_SIZE); } catch {}
  }

  const contentTop = HEADER_HEIGHT + MARGIN_BOTTOM;
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
    let textY = y + rowHeight * 0.36;
    const textOpts = { align: 'right' as const };
    const nameSize = 17, priceSize = 11, promoSize = 18;
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
    textY += maxLines * lineGapName + 14;

    // Kalau price_promo kosong, tampilkan price SAJA (normal, tidak dicoret,
    // ditonjolkan seperti biasanya promo). Kalau ada keduanya, price dicoret
    // dan price_promo ditonjolkan sebagai harga sekarang seperti biasa.
    const normalPriceText = formatRupiah(p.price);
    const promoPriceText = formatRupiah(p.price_promo);

    if (promoPriceText) {
      // 2. Harga biasa — DICORET
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

      // 3. Harga promo — ditonjolkan sebagai harga sekarang
      doc.setFontSize(promoSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(promoPriceText, textRightEdge, textY, textOpts);
      doc.setTextColor(0, 0, 0);
    } else if (normalPriceText) {
      // Tidak ada promo — tampilkan price saja, ditonjolkan (bukan dicoret).
      doc.setFontSize(promoSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(normalPriceText, textRightEdge, textY, textOpts);
      doc.setTextColor(0, 0, 0);
    }
  }
}
