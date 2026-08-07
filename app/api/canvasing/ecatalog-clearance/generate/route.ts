import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// E-Catalog Clearance — sheet clearance_product. Layout kartu produk (2 foto
// berdampingan, teks rata kanan) mengikuti konsep /api/canvasing/ecatalog-ihls/generate,
// TAPI ukuran halaman & header memakai gaya /api/canvasing/ecatalog/generate
// (A4, header biru + logo Torch — bukan background image custom), dan
// dikelompokkan per category (halaman pembatas, urut A-Z) seperti E-Catalog biasa.
//
// 5 produk per halaman. Beda utama dari ihls_product: kolom `stock` di
// clearance_product adalah ANGKA (bukan TRUE/FALSE) dan ditampilkan di kartu
// produk, plus badge persentase diskon (dihitung dari price vs price_promo).
//
// Sheet: clearance_product — id, sku, item_name, artikel, category, color,
// stock, onmodel_url, image_url, price, price_promo.
// ─────────────────────────────────────────────────────────────────────────────

const TORCH_BLUE = '#0B7A8F';
const PRODUCTS_PER_PAGE = 5;

const COLOR_MAP: Record<string, string> = {
  'black': '#000000', 'grey': '#808080', 'gray': '#808080',
  'dark grey': '#404040', 'dark gray': '#404040',
  'navy': '#000080', 'blue': '#0000FF', 'legion blue': '#1E3A8A',
  'light blue': '#87CEEB', 'green': '#008000', 'olive': '#808000',
  'red': '#FF0000', 'yellow': '#FFFF00', 'pop yellow': '#FFD700',
  'everglade tosca': '#2F7F7F', 'sycamore green': '#8B9467',
  'charcoal grey': '#36454F', 'white': '#FFFFFF', 'brown': '#8B4513',
  'cream': '#FFFDD0', 'tosca': '#2F7F7F', 'terracotta': '#E2725B',
  'beet red': '#8B0000', 'cactus green': '#5C8A5A',
};

function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName.toLowerCase().trim()] || '#CCCCCC';
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

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
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

function parseNum(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const raw = typeof value === 'string' ? value.replace(/[^\d-]/g, '') : String(value);
  const num = parseInt(raw, 10);
  return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
  try {
    const data = await getSheetData('clearance_product');

    const products = data
      .filter((item: any) => parseNum(item.stock) > 0 && (item.artikel || item.item_name))
      .map((p: any) => ({
        item_name: p.artikel || p.item_name || '',
        category: p.category || 'Lainnya',
        color: p.color || '',
        stock: parseNum(p.stock),
        price: p.price || '',
        price_promo: p.price_promo || '',
        onmodel_url: p.onmodel_url || '',
        image_url: p.image_url || '',
      }));

    // Kelompokkan per category, urut A-Z (nama category & produk di dalamnya).
    const grouped: Record<string, any[]> = {};
    products.forEach((p: any) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    Object.values(grouped).forEach((list) =>
      list.sort((a, b) => a.item_name.localeCompare(b.item_name, 'id'))
    );
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'id'));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const logo = await downloadImage(
      'https://cdn.shopify.com/s/files/1/1615/1301/files/Untitled_design_162c0ca1-c46e-4635-8f4c-bc44d547ee5e.png?v=1770919047'
    );

    let firstPage = true;
    for (const cat of categories) {
      const items = grouped[cat];

      if (!firstPage) doc.addPage();
      firstPage = false;
      createCategoryPage(doc, W, H, cat, logo);

      for (let i = 0; i < items.length; i += PRODUCTS_PER_PAGE) {
        const batch = items.slice(i, i + PRODUCTS_PER_PAGE);
        doc.addPage();
        await createProductPage(doc, W, H, batch, logo);
      }
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Torch_E-Catalog_Clearance_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating clearance catalog:', error);
    return NextResponse.json({
      error: 'Failed to generate clearance catalog',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

function createCategoryPage(doc: jsPDF, w: number, h: number, category: string, logo: string | null) {
  const blue = hexToRgb(TORCH_BLUE);

  doc.setFillColor(blue.r, blue.g, blue.b);
  doc.rect(0, 0, w, h, 'F');

  doc.setFillColor(Math.max(0, blue.r - 20), Math.max(0, blue.g - 20), Math.max(0, blue.b - 20));
  doc.rect(0, 0, w, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('E-Catalogue Clearance', 10, 18);

  if (logo) {
    try { doc.addImage(logo, 'PNG', w - 55, 4, 50, 20); } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(category, w / 2, h / 2, { align: 'center' });
}

async function createProductPage(doc: jsPDF, w: number, h: number, products: any[], logo: string | null) {
  const blue = hexToRgb(TORCH_BLUE);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');

  doc.setFillColor(blue.r, blue.g, blue.b);
  doc.rect(0, 0, w, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('E-Catalogue Clearance', 10, 18);

  if (logo) {
    try { doc.addImage(logo, 'PNG', w - 55, 4, 50, 20); } catch {}
  }

  const marginTop = 32;
  const marginBottom = 10;
  const marginLR = 10;

  const contentH = h - marginTop - marginBottom;
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
    const y = marginTop + i * rowHeight;

    if (i > 0) {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.line(marginLR, y, w - marginLR, y);
    }

    // 2 foto (onmodel_url + image_url) berdampingan.
    const imgH = rowHeight * 0.78;
    const imgGap = 2.5;
    const onmodelX = marginLR + 2;
    const productX = onmodelX + imgH + imgGap;
    const imgY = y + (rowHeight - imgH) / 2;

    if (img.onmodel) {
      try { doc.addImage(img.onmodel, 'JPEG', onmodelX, imgY, imgH, imgH); } catch {}
    }
    if (img.product) {
      try { doc.addImage(img.product, 'JPEG', productX, imgY, imgH, imgH); } catch {}
    }

    // ── Teks — rata kanan (pojok kanan halaman) ─────────────────────────
    const textRightEdge = w - marginLR;
    const textLeftLimit = productX + imgH + 5;
    const textW = textRightEdge - textLeftLimit;
    let textY = y + rowHeight * 0.18;
    const textOpts = { align: 'right' as const };
    const nameSize = 13, priceSize = 9, promoSize = 15;
    const lineGapName = 5.2;

    // 1. Nama produk
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(nameSize);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(p.item_name || 'N/A', textW);
    const maxLines = Math.min(lines.length, 2);
    for (let j = 0; j < maxLines; j++) {
      doc.text(lines[j], textRightEdge, textY + j * lineGapName, textOpts);
    }
    textY += maxLines * lineGapName + 2.5;

    // 2. Harga — price dicoret + price_promo ditonjolkan (jika promo ada),
    //    dilengkapi badge persentase diskon. Kalau promo kosong, tampilkan
    //    price saja (tidak dicoret).
    const normalPriceText = formatRupiah(p.price);
    const promoPriceText = formatRupiah(p.price_promo);
    const priceNum = parseNum(p.price);
    const promoNum = parseNum(p.price_promo);
    const discountPct = priceNum > 0 && promoNum > 0 && promoNum < priceNum
      ? Math.round((1 - promoNum / priceNum) * 100)
      : 0;

    if (promoPriceText) {
      if (normalPriceText) {
        doc.setFontSize(priceSize);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(normalPriceText, textRightEdge, textY, textOpts);
        const strikeW = doc.getTextWidth(normalPriceText);
        // Garis coret melewati TENGAH digit — offset dihitung proporsional
        // terhadap tinggi font (pt→mm, ~0.32× tinggi di atas baseline),
        // bukan angka mm tetap (sebelumnya kelihatan "melayang" di atas teks
        // untuk font kecil).
        const strikeY = textY - priceSize * 0.3528 * 0.32;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.25);
        doc.line(textRightEdge - strikeW, strikeY, textRightEdge, strikeY);
        textY += 4.8;
      }

      if (discountPct > 0) {
        const badgeText = `-${discountPct}%`;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        const badgeW = doc.getTextWidth(badgeText) + 2.8;
        const badgeH = 4;
        doc.setFillColor(220, 38, 38);
        doc.roundedRect(textRightEdge - badgeW, textY - badgeH + 1, badgeW, badgeH, 0.8, 0.8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(badgeText, textRightEdge - badgeW / 2, textY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        textY += 5.8;
      }

      doc.setFontSize(promoSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(blue.r, blue.g, blue.b);
      doc.text(promoPriceText, textRightEdge, textY, textOpts);
      doc.setTextColor(0, 0, 0);
      textY += 5.5;
    } else if (normalPriceText) {
      doc.setFontSize(promoSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(blue.r, blue.g, blue.b);
      doc.text(normalPriceText, textRightEdge, textY, textOpts);
      doc.setTextColor(0, 0, 0);
      textY += 5.5;
    }

    // 3. Stock — angka, bukan TRUE/FALSE.
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Stock: ${p.stock.toLocaleString('id-ID')}`, textRightEdge, textY, textOpts);
    doc.setTextColor(0, 0, 0);
    textY += 4.5;

    // 4. Warna — bulat kecil (dot), sama seperti E-Catalog biasa. Rata
    //    kanan: dot digambar dari kanan ke kiri supaya sejajar dengan
    //    teks/harga di atasnya.
    if (p.color) {
      const colors = p.color.split(';').map((c: string) => c.trim()).filter(Boolean).slice(0, 6);
      if (colors.length > 0) {
        const dotR = 1.5;
        const dotGap = 4.2;
        const dotsWidth = (colors.length - 1) * dotGap + dotR * 2;
        const dotY = textY + dotR;
        for (let k = 0; k < colors.length; k++) {
          const dotX = textRightEdge - dotsWidth + dotR + k * dotGap;
          const rgb = hexToRgb(getColorHex(colors[k]));
          doc.setFillColor(rgb.r, rgb.g, rgb.b);
          doc.circle(dotX, dotY, dotR, 'F');
          doc.setDrawColor(140, 140, 140);
          doc.setLineWidth(0.15);
          doc.circle(dotX, dotY, dotR, 'S');
        }
      }
    }
  }
}
