import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';

// ── Colours ───────────────────────────────────────────────────────────────────
const NAVY      = '#1a3a6b';
const NAVY_MID  = '#2d5a9e';
const WHITE     = '#ffffff';
const TEXT_DARK = '#1a1a2e';
const TEXT_GRAY = '#555555';
const LIGHT_ROW = '#dce8f5';

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  return { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) };
}
function setFill(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
function setTextCol(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}
function setDrawCol(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function formatRupiah(val: number | string): string {
  const n = typeof val === 'string' ? parseInt(val.replace(/[^0-9]/g, '')) || 0 : Number(val) || 0;
  return 'Rp' + n.toLocaleString('id-ID');
}

function formatRupiahFull(val: number | string): string {
  const n = typeof val === 'string' ? parseInt(val.replace(/[^0-9]/g, '')) || 0 : Number(val) || 0;
  return 'Rp' + n.toLocaleString('id-ID') + ',00';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = ['Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function downloadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let fetchUrl = url.replace('ibb.co.com', 'ibb.co');

    const ibbMatch = fetchUrl.match(/(?:https?:\/\/)?(?:www\.)?ibb\.co\/([A-Za-z0-9]+)\/?$/);
    if (ibbMatch) {
      const code = ibbMatch[1];
      const candidates = [
        `https://i.ibb.co/${code}/image.png`,
        `https://i.ibb.co/${code}/image.jpg`,
        `https://i.ibb.co/${code}/header.png`,
        `https://i.ibb.co/${code}/header.jpg`,
      ];
      for (const candidate of candidates) {
        const img = await tryFetch(candidate);
        if (img) return img;
      }
      return null;
    }

    return await tryFetch(fetchUrl);
  } catch {
    return null;
  }
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

function setFont(doc: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') {
  doc.setFont('times', style);
}

function parseBoolField(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toUpperCase() === 'TRUE';
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json();
    if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });

    const [invoices, allItems, masterArr] = await Promise.all([
      getSheetData('invoices'),
      getSheetData('invoice_items'),
      getSheetData('master_invoice'),
    ]);

    const invoice = invoices.find((r: any) => r.invoice_id === invoice_id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (invoice.status !== 'submitted') {
      return NextResponse.json({ error: 'PDF hanya tersedia untuk invoice dengan status submitted' }, { status: 403 });
    }

    const items = allItems.filter((r: any) => r.invoice_id === invoice_id);
    const master = masterArr[0] || {};

    const useSign = parseBoolField(invoice.use_signature);
    const hasPPN  = Number(invoice.tax_percent) > 0;

    const docType     = (invoice.doc_type || 'invoice').toLowerCase();
    const isQuotation = docType === 'quotation';

    const [headerImg, signImg] = await Promise.all([
      downloadImageAsBase64(master.header_image_url || ''),
      downloadImageAsBase64(master.signature_image_url || ''),
    ]);

    // ── PDF setup ─────────────────────────────────────────────────────────────
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const W      = 210;
    const margin = 14;
    const cW     = W - margin * 2;
    let y        = 14;

    // ── HEADER ────────────────────────────────────────────────────────────────
    const logoW = 26;
    const logoH = 18;

    if (headerImg) {
      try {
        doc.addImage(headerImg, 'PNG', margin - 2, y - 1, logoW, logoH);
      } catch {}
    } else {
      setFill(doc, '#e8eef8');
      setDrawCol(doc, NAVY_MID);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, logoW, logoH, 2, 2, 'FD');
      setTextCol(doc, NAVY);
      setFont(doc, 'bold');
      doc.setFontSize(7);
      doc.text('LOGO', margin + logoW / 2, y + logoH / 2 + 2, { align: 'center' });
    }

    const companyX    = margin + logoW + 3;
    const companyMaxW = W - margin - companyX - 44;

    setTextCol(doc, NAVY);
    setFont(doc, 'bold');
    doc.setFontSize(11);
    doc.text(master.company_name || 'MAHA NAGARI NUSANTARA', companyX, y + 5);

    setTextCol(doc, TEXT_GRAY);
    setFont(doc, 'normal');
    doc.setFontSize(7.5);
    if (master.company_address) {
      const addrLines = doc.splitTextToSize(master.company_address, companyMaxW);
      doc.text(addrLines, companyX, y + 10);
    }
    if (master.company_phone) {
      doc.text(`Phone: ${master.company_phone}`, companyX, y + 15);
    }

    const docLabel = isQuotation ? 'Quotation' : 'Invoice';
    setTextCol(doc, NAVY);
    setFont(doc, 'bolditalic');
    doc.setFontSize(22);
    doc.text(docLabel, W - margin, y + 8, { align: 'right' });

    if (invoice.invoice_number) {
      setFont(doc, 'bold');
      doc.setFontSize(11);
      doc.text(`#${invoice.invoice_number}`, W - margin, y + 16, { align: 'right' });
    }

    y += logoH + 7;

    setDrawCol(doc, NAVY_MID);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 7;

    // ── KEPADA YTH ────────────────────────────────────────────────────────────
    setTextCol(doc, TEXT_DARK);
    setFont(doc, 'bold');
    doc.setFontSize(9);
    doc.text('Kepada Yth :', margin, y);
    y += 5;

    setTextCol(doc, TEXT_DARK);
    setFont(doc, 'bold');
    doc.setFontSize(9.5);
    doc.text(invoice.customer_name || '', margin, y);
    y += 5;

    if (invoice.customer_address) {
      setTextCol(doc, TEXT_GRAY);
      setFont(doc, 'normal');
      doc.setFontSize(8);
      const addrLines = doc.splitTextToSize(invoice.customer_address, cW * 0.65);
      doc.text(addrLines, margin, y);
      y += addrLines.length * 4.5;
    }

    y += 6;

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const qtyW  = 16;
    const hrgW  = 34;
    const totW  = 30;
    const deskW = cW - qtyW - hrgW - totW;

    const colX = {
      qty:  margin,
      desk: margin + qtyW,
      hrg:  margin + qtyW + deskW,
      tot:  margin + qtyW + deskW + hrgW,
    };

    const headH    = 9;
    const rowH     = 8;
    const tableTopY = y;

    // Header row
    setFill(doc, NAVY_MID);
    doc.rect(margin, y, cW, headH, 'F');

    setTextCol(doc, WHITE);
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.text('Qty',           colX.qty  + qtyW  / 2, y + 6, { align: 'center' });
    doc.text('Nama Produk',   colX.desk + deskW  / 2, y + 6, { align: 'center' });
    doc.text('Harga Satuan',  colX.hrg  + hrgW  / 2, y + 6, { align: 'center' });
    doc.text('Total',         colX.tot  + totW  / 2, y + 6, { align: 'center' });

    y += headH;

    // Item rows
    items.forEach((item: any) => {
      setFill(doc, LIGHT_ROW);
      doc.rect(margin, y, cW, rowH, 'F');

      setTextCol(doc, NAVY);
      setFont(doc, 'bold');
      doc.setFontSize(8);

      doc.text(String(item.qty || 0), colX.qty + qtyW / 2, y + 5.2, { align: 'center' });

      const descLines = doc.splitTextToSize(item.product_name || '', deskW - 4);
      doc.text(descLines[0], colX.desk + 2, y + 5.2);

      doc.text(
        formatRupiahFull(item.unit_price),
        colX.hrg + hrgW - 2,
        y + 5.2,
        { align: 'right' }
      );

      const lineTotal = item.total_price || (Number(item.qty) * Number(item.unit_price));
      doc.text(
        formatRupiah(lineTotal),
        colX.tot + totW - 2,
        y + 5.2,
        { align: 'right' }
      );

      // Border hitam tipis per baris
      setDrawCol(doc, '#000000');
      doc.setLineWidth(0.15);
      doc.rect(margin, y, cW, rowH, 'S');

      // Garis vertikal pemisah kolom
      doc.line(colX.desk, y, colX.desk, y + rowH);
      doc.line(colX.hrg,  y, colX.hrg,  y + rowH);
      doc.line(colX.tot,  y, colX.tot,  y + rowH);

      y += rowH;
    });

    // Border luar keseluruhan tabel (header + semua baris) hitam
    setDrawCol(doc, '#000000');
    doc.setLineWidth(0.3);
    doc.rect(margin, tableTopY, cW, headH + (items.length * rowH), 'S');

    // Garis vertikal pada header
    doc.setLineWidth(0.15);
    doc.line(colX.desk, tableTopY, colX.desk, tableTopY + headH + (items.length * rowH));
    doc.line(colX.hrg,  tableTopY, colX.hrg,  tableTopY + headH + (items.length * rowH));
    doc.line(colX.tot,  tableTopY, colX.tot,  tableTopY + headH + (items.length * rowH));

    y += 3;

    // ── TOTALS ────────────────────────────────────────────────────────────────
    const totBlockW = 82;
    const totBlockX = W - margin - totBlockW;
    const totLblEnd = totBlockX + 44;
    const totValEnd = W - margin - 2;
    const tRowH = 7;

    // Baris SubTotal
    setFill(doc, LIGHT_ROW);
    doc.rect(totBlockX, y, totBlockW, tRowH, 'F');
    setTextCol(doc, NAVY);
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.text('SubTotal', totLblEnd, y + 5, { align: 'right' });
    doc.text(formatRupiah(invoice.subtotal), totValEnd, y + 5, { align: 'right' });
    y += tRowH;

    // Baris PPN
    if (hasPPN) {
      setFill(doc, '#f0f4fa');
      doc.rect(totBlockX, y, totBlockW, tRowH, 'F');
      setTextCol(doc, TEXT_GRAY);
      setFont(doc, 'normal');
      doc.setFontSize(8);
      doc.text(`PPN ${invoice.tax_percent}%`, totLblEnd, y + 5, { align: 'right' });
      doc.text(formatRupiah(invoice.tax_amount), totValEnd, y + 5, { align: 'right' });
      y += tRowH;
    }

    y += 2;

    // Total Pembayaran
    setFill(doc, NAVY_MID);
    doc.rect(margin, y, cW, tRowH + 2, 'F');
    setTextCol(doc, WHITE);
    setFont(doc, 'bold');
    doc.setFontSize(9);
    doc.text('Total Pembayaran', margin + cW * 0.35, y + 6, { align: 'center' });
    doc.text(formatRupiah(invoice.grand_total), W - margin - 2, y + 6, { align: 'right' });
    y += tRowH + 2 + 8;

    // ── TERBILANG ─────────────────────────────────────────────────────────────
    if (invoice.amount_in_words) {
      setTextCol(doc, TEXT_DARK);
      setFont(doc, 'bolditalic');
      doc.setFontSize(8.5);
      const terbilangText = `Terbilang: ${invoice.amount_in_words}`;
      const tLines = doc.splitTextToSize(terbilangText, cW);
      doc.text(tLines, margin, y);
      y += tLines.length * 5 + 12;
    }

    // ── SIGNATURE ─────────────────────────────────────────────────────────────
    const sigY   = y;
    const rightX = W - margin;

    const sigStoreName = invoice.signature_store || '';
    const sigPicName   = invoice.signature_pic || '';

    // Baris 1: "Mengetahui," dan "Bandung, tanggal" sejajar
    setTextCol(doc, TEXT_DARK);
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.text('Mengetahui,', margin, sigY);
    doc.text(`Bandung, ${formatDate(invoice.invoice_date)}`, rightX, sigY, { align: 'right' });

    // Gambar tanda tangan — hanya jika useSign = true
    const imgH = 28;
    if (useSign && signImg) {
      try {
        const w = 40;
        const h = 25;
        const format = signImg.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(signImg, format, margin, sigY + 1, w, h, undefined, 'FAST');
      } catch {
        // gagal load gambar, ruang tetap tersedia
      }
    }

    // Baris 2: nama kiri & nama toko kanan sejajar
    const namY = sigY + imgH;

    setTextCol(doc, TEXT_DARK);
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.text('Achmad Odi Primandana', margin, namY);

    if (sigStoreName) {
      setFont(doc, 'bold');
      doc.setFontSize(8.5);
      setTextCol(doc, TEXT_DARK);
      doc.text(sigStoreName, rightX, namY, { align: 'right' });
    } else if (invoice.customer_name) {
      setFont(doc, 'bold');
      doc.setFontSize(8.5);
      setTextCol(doc, TEXT_DARK);
      doc.text(invoice.customer_name, rightX, namY, { align: 'right' });
    }

    // Baris 3: jabatan kiri & nama PIC kanan sejajar
    setFont(doc, 'normal');
    doc.setFontSize(8);
    setTextCol(doc, TEXT_DARK);
    doc.text('O2O Koordinator Operasional', margin, namY + 5);

    if (sigPicName) {
      setFont(doc, 'normal');
      doc.setFontSize(8);
      setTextCol(doc, TEXT_DARK);
      doc.text(sigPicName, rightX, namY + 5, { align: 'right' });
    }

    // ── Output ────────────────────────────────────────────────────────────────
    const pdfBytes = doc.output('arraybuffer');
    const filename = isQuotation
      ? `Quotation_${invoice.customer_name || invoice_id}.pdf`
      : `Invoice_${invoice.invoice_number || invoice_id}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}