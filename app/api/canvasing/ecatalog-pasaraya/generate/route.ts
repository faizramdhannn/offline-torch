import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// E-Catalog Pasaraya (event "Paddy x Torch — Bayar 1/2 Harga") — sheet
// pasaraya_product. Beda dari katalog lain di app ini:
//   - Halaman 1 = COVER_IMAGE_URL dipakai APA ADANYA sebagai halaman penuh
//     (bukan template produk) — desain promosi event, bukan produk.
//   - Halaman produk berikutnya pakai HEADER_IMAGE_URL sebagai background
//     penuh tiap halaman (logo "Paddy x torch" di atas, sisanya putih untuk
//     grid produk) — sama pola dengan E-Catalog IHLS.
//   - Grid 3 kolom x 4 baris = 12 produk/halaman. Layout kartu pakai SLOT
//     TETAP (bukan proporsional ke tinggi cell) supaya jarak antar baris
//     konsisten & tidak nganga; gambar di-fit "contain" (jaga rasio asli,
//     bukan dipaksa persegi) via metadata sharp.
//   - Kolom yang dipakai HANYA: artikel (nama), category (urutan), image_url
//     (1 foto saja, tidak ada onmodel), price (dicoret), price_promo
//     (ditonjolkan sebagai harga sekarang).
//   - Semua produk masuk (tidak difilter oleh kolom stock, sesuai konfirmasi user).
//   - Diurutkan by category dulu, baru by artikel — TANPA halaman pembatas
//     kategori (beda dari E-Catalog biasa), supaya rapi tapi tetap padat.
//
// Sheet: pasaraya_product — id, sku, item_name, artikel, category, color,
// stock, onmodel_url, image_url, price, price_promo.
// ─────────────────────────────────────────────────────────────────────────────

const COVER_IMAGE_URL = 'https://i.ibb.co.com/pjMTSfCt/Untitled-design.png';
const HEADER_IMAGE_URL = 'https://i.ibb.co.com/b5MYsFB4/Untitled-design-1.png';
// Diukur langsung dari file aslinya (1080x1350px): baris ke-139 adalah baris
// terakhir yang masih ada konten logo — di bawahnya murni putih.
const HEADER_HEIGHT_RATIO = 139 / 1350;

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

// Untuk background full-page (cover/header) — cuma butuh data URL-nya.
async function downloadImage(url: string): Promise<string | null> {
  const r = await fetchImageBuffer(url);
  if (!r) return null;
  return `data:${r.mime};base64,${r.buffer.toString('base64')}`;
}

// Untuk gambar produk — sekalian ambil dimensi asli (via sharp) supaya bisa
// di-fit "contain" (jaga rasio, tidak digepengkan/di-stretch jadi persegi
// paksa seperti sebelumnya untuk produk yang bentuknya panjang/pipih).
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
    const data = await getSheetData('pasaraya_product');

    const products = (data as any[])
      .filter((item) => item.artikel || item.item_name)
      .map((p) => ({
        item_name: p.artikel || p.item_name || '',
        category: p.category || 'Lainnya',
        image_url: p.image_url || '',
        price: p.price || '',
        price_promo: p.price_promo || '',
      }))
      .sort((a, b) => {
        const catCmp = a.category.localeCompare(b.category, 'id');
        if (catCmp !== 0) return catCmp;
        return a.item_name.localeCompare(b.item_name, 'id');
      });

    const [coverImage, headerImage] = await Promise.all([
      downloadImage(COVER_IMAGE_URL),
      downloadImage(HEADER_IMAGE_URL),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [PAGE_W, PAGE_H],
      compress: true,
    });

    // Halaman 1: cover event, apa adanya.
    if (coverImage) {
      try {
        doc.addImage(coverImage, 'PNG', 0, 0, PAGE_W, PAGE_H);
      } catch {}
    }

    for (let i = 0; i < products.length; i += PRODUCTS_PER_PAGE) {
      const batch = products.slice(i, i + PRODUCTS_PER_PAGE);
      doc.addPage([PAGE_W, PAGE_H]);
      await createProductPage(doc, batch, headerImage);
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Pasaraya_E-Catalog_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating Pasaraya catalog:', error);
    return NextResponse.json({
      error: 'Failed to generate Pasaraya catalog',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

async function createProductPage(doc: jsPDF, products: any[], headerImage: string | null) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  if (headerImage) {
    try { doc.addImage(headerImage, 'PNG', 0, 0, PAGE_W, PAGE_H); } catch {}
  }

  const headerHeight = Math.round(PAGE_H * HEADER_HEIGHT_RATIO);
  const marginLR = 40;
  const marginBottom = 36;
  const contentTop = headerHeight + 36;

  const contentW = PAGE_W - marginLR * 2;
  const contentH = PAGE_H - contentTop - marginBottom;
  const cellW = contentW / COLS;
  const cellH = contentH / ROWS;

  // ── Layout per-kartu pakai SLOT TETAP (bukan proporsional ke cellH) ──────
  // supaya jarak antar baris konsisten & tidak "ngambang" — sebelumnya
  // gambar+teks proporsional ke cellH bikin sisa ruang kosong besar tiap
  // baris begitu cellH membesar (waktu baris dikurangi jadi 4).
  const NAME_SIZE = 19;
  const NAME_LINE_H = 22;
  const NAME_LINES_RESERVED = 2; // dipakai HANYA untuk hitung budget tinggi gambar (worst-case)
  const STRIKE_SIZE = 13.5;
  const PROMO_SIZE = 21;
  const GAP_IMG_TO_NAME = 14;
  const GAP_NAME_TO_PRICE = 6; // jarak nama→harga dirapatkan (sebelumnya kelihatan nganga)
  const GAP_STRIKE_TO_PROMO = 15;
  const PAD_TOP = 8;

  const nameBlockH = NAME_LINES_RESERVED * NAME_LINE_H;
  // Slot harga selalu direservasi seolah ada 2 baris (coret + promo) supaya
  // baseline harga_promo SEJAJAR di semua kartu, baik yang punya harga coret
  // maupun yang cuma tampil 1 harga saja.
  const priceBlockH = STRIKE_SIZE + GAP_STRIKE_TO_PROMO + PROMO_SIZE * 0.4;
  const textZoneH = GAP_IMG_TO_NAME + nameBlockH + GAP_NAME_TO_PRICE + priceBlockH;

  // Ukuran gambar: batasi lebar (biar tidak mepet antar kolom) DAN tinggi
  // (biar sisa slot teks + padding selalu cukup, tidak overlap ke baris berikutnya).
  const imgBoxByWidth = cellW * 0.86;
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

    // ── Gambar produk — "contain" fit (jaga rasio asli, tidak digepengkan) ──
    const imgY = cellY + PAD_TOP;
    if (img) {
      const ratio = img.width / img.height || 1;
      const drawW = ratio >= 1 ? imgBox : imgBox * ratio;
      const drawH = ratio >= 1 ? imgBox / ratio : imgBox;
      const drawX = cellCenterX - drawW / 2;
      const drawY = imgY + (imgBox - drawH) / 2;
      try { doc.addImage(img.dataUrl, 'JPEG', drawX, drawY, drawW, drawH); } catch {}
    }

    // ── Nama produk (maks 2 baris, slot selalu 2 baris) ──────────────────
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

    // ── Harga — nempel tepat di bawah nama (pakai jumlah baris NAMA
    //    SEBENARNYA, bukan slot 2-baris tetap — sebelumnya nama 1 baris
    //    tetap kasih jarak seolah 2 baris, jadi nganga jauh dari harga).
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
        // Pakai getTextDimensions (satuan dokumen — px di sini) alih-alih
        // fontSize (yang selalu dalam pt, tidak nyambung ke koordinat px)
        // supaya garis coret benar-benar melewati tengah teks, bukan
        // "melayang" di atasnya seperti sebelumnya.
        const textH = doc.getTextDimensions(normalPriceText).h;
        const strikeLineY = strikeBaseline - textH * 0.32;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.7);
        doc.line(cellCenterX - strikeW / 2, strikeLineY, cellCenterX + strikeW / 2, strikeLineY);
      }

      doc.setFontSize(PROMO_SIZE);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(219, 39, 119); // pink Torch x Paddy
      doc.text(promoPriceText, cellCenterX, promoBaseline, textOpts);
      doc.setTextColor(0, 0, 0);
    } else if (normalPriceText) {
      doc.setFontSize(PROMO_SIZE);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(219, 39, 119);
      doc.text(normalPriceText, cellCenterX, promoBaseline, textOpts);
      doc.setTextColor(0, 0, 0);
    }
  }
}
