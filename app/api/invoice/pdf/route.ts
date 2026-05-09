import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';

// ── Colours matching the Maha Nagari invoice style ─────────────────────────────
const NAVY = '#1a2b4a';
const NAVY_LIGHT = '#2d4a7a';
const ACCENT = '#c8a96e';   // gold accent
const GRAY_BG = '#f5f7fa';
const GRAY_LINE = '#e2e8f0';
const TEXT_MAIN = '#1a2b4a';
const TEXT_MUTED = '#6b7280';
const WHITE = '#ffffff';

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
  const n = typeof val === 'string' ? parseInt(val.replace(/[^0-9]/g, '')) || 0 : val;
  return 'Rp' + n.toLocaleString('id-ID');
}

async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json();
    if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });

    // Fetch data
    const [invoices, allItems, masterArr] = await Promise.all([
      getSheetData('invoices'),
      getSheetData('invoice_items'),
      getSheetData('master_invoice'),
    ]);

    const invoice = invoices.find((r: any) => r.invoice_id === invoice_id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const items = allItems.filter((r: any) => r.invoice_id === invoice_id);
    const master = masterArr[0] || {};

    const usePPN = master.default_use_ppn === 'TRUE';
    const useSign = master.default_use_signature === 'TRUE';
    const headerUrl = master.header_image_url || 'https://ibb.co.com/GQQJffVc';
    const signUrl = master.signature_image_url || '';

    // Fetch images concurrently
    const [headerImg, signImg] = await Promise.all([
      downloadImageAsBase64(headerUrl),
      signUrl ? downloadImageAsBase64(signUrl) : Promise.resolve(null),
    ]);

    // ── Build PDF ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const W = 210;
    const margin = 18;
    const contentW = W - margin * 2;
    let y = 0;

    // ── Header band ──────────────────────────────────────────────────────────
    setFill(doc, NAVY);
    doc.rect(0, 0, W, 36, 'F');

    // Accent stripe
    setFill(doc, ACCENT);
    doc.rect(0, 36, W, 2.5, 'F');

    // Header image
    if (headerImg) {
      try { doc.addImage(headerImg, 'PNG', margin, 4, 70, 28); } catch {}
    } else {
      // Fallback: company name text
      setTextCol(doc, WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(master.company_name || 'MAHA NAGARI NUSANTARA', margin, 20);
    }

    // "INVOICE" label top-right
    setTextCol(doc, ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('INVOICE', W - margin, 18, { align: 'right' });

    setTextCol(doc, '#d4c5a0');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`#${invoice.invoice_number}`, W - margin, 27, { align: 'right' });

    y = 46;

    // ── Info section ─────────────────────────────────────────────────────────
    // Left: Kepada (customer info)
    setTextCol(doc, TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('KEPADA YTH:', margin, y);

    setTextCol(doc, TEXT_MAIN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(invoice.customer_name || '', margin, y + 5);

    if (invoice.customer_address) {
      setTextCol(doc, TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const addrLines = doc.splitTextToSize(invoice.customer_address, 80);
      doc.text(addrLines, margin, y + 11);
    }

    // Right: Invoice meta box
    const boxX = W - margin - 70;
    const boxW = 70;
    setFill(doc, GRAY_BG);
    setDrawCol(doc, GRAY_LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, y - 2, boxW, 28, 2, 2, 'FD');

    const metaRows = [
      ['No. Invoice', invoice.invoice_number],
      ['Tanggal', formatDate(invoice.invoice_date)],
      ['Status', (invoice.status || 'draft').toUpperCase()],
    ];
    metaRows.forEach(([label, val], i) => {
      const ry = y + 2 + i * 8;
      setTextCol(doc, TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(label, boxX + 4, ry);
      setTextCol(doc, TEXT_MAIN);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(val || '-', boxX + boxW - 4, ry, { align: 'right' });
      if (i < metaRows.length - 1) {
        setDrawCol(doc, GRAY_LINE);
        doc.setLineWidth(0.2);
        doc.line(boxX + 4, ry + 3, boxX + boxW - 4, ry + 3);
      }
    });

    // Company info (right side under box)
    if (master.company_address || master.company_phone) {
      setTextCol(doc, TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      let cy = y + 30;
      if (master.company_address) {
        const lines = doc.splitTextToSize(master.company_address, 70);
        doc.text(lines, boxX, cy, { align: 'left' });
        cy += lines.length * 4;
      }
      if (master.company_phone) {
        doc.text(`Phone: ${master.company_phone}`, boxX, cy);
        cy += 4;
      }
      if (master.company_email) {
        doc.text(master.company_email, boxX, cy);
      }
    }

    y += 34;

    // ── Divider ───────────────────────────────────────────────────────────────
    setDrawCol(doc, GRAY_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, y, W - margin, y);
    y += 6;

    // ── Items table header ────────────────────────────────────────────────────
    setFill(doc, NAVY);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, 'F');

    const cols = {
      no:    { x: margin + 2,              w: 8 },
      name:  { x: margin + 11,             w: usePPN ? 70 : 76 },
      variant:{ x: margin + 11 + (usePPN ? 70 : 76), w: 24 },
      qty:   { x: margin + 11 + (usePPN ? 70 : 76) + 24, w: 14 },
      price: { x: margin + 11 + (usePPN ? 70 : 76) + 38, w: 30 },
      total: { x: margin + 11 + (usePPN ? 70 : 76) + 68, w: contentW - 11 - (usePPN ? 70 : 76) - 68 },
    };

    setTextCol(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('No', cols.no.x, y + 5.5);
    doc.text('Deskripsi', cols.name.x, y + 5.5);
    doc.text('Variant', cols.variant.x, y + 5.5);
    doc.text('Qty', cols.qty.x + cols.qty.w / 2, y + 5.5, { align: 'center' });
    doc.text('Harga Satuan', cols.price.x + cols.price.w, y + 5.5, { align: 'right' });
    doc.text('Total', W - margin - 2, y + 5.5, { align: 'right' });

    y += 10;

    // ── Item rows ─────────────────────────────────────────────────────────────
    items.forEach((item: any, idx: number) => {
      const rowH = 9;
      if (idx % 2 === 0) {
        setFill(doc, '#f9fafb');
        doc.rect(margin, y - 1, contentW, rowH, 'F');
      }

      setTextCol(doc, TEXT_MAIN);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      doc.text(String(idx + 1), cols.no.x, y + 5);

      const nameLines = doc.splitTextToSize(item.product_name || '', cols.name.w - 2);
      doc.text(nameLines[0], cols.name.x, y + 5);
      doc.text(item.variant || '-', cols.variant.x, y + 5);

      doc.text(String(item.qty || 0), cols.qty.x + cols.qty.w / 2, y + 5, { align: 'center' });
      doc.text(formatRupiah(item.unit_price), cols.price.x + cols.price.w, y + 5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatRupiah(item.total_price), W - margin - 2, y + 5, { align: 'right' });

      // Row bottom line
      setDrawCol(doc, GRAY_LINE);
      doc.setLineWidth(0.15);
      doc.line(margin, y + rowH - 1, W - margin, y + rowH - 1);

      y += rowH;
    });

    y += 4;

    // ── Totals box ────────────────────────────────────────────────────────────
    const totalsX = W - margin - 68;
    const totalsW = 68;

    setFill(doc, GRAY_BG);
    setDrawCol(doc, GRAY_LINE);
    doc.setLineWidth(0.3);

    const rows: [string, string][] = [
      ['Sub Total', formatRupiah(invoice.subtotal)],
    ];
    if (usePPN) {
      rows.push([`PPN ${invoice.tax_percent}%`, formatRupiah(invoice.tax_amount)]);
    }

    const totalBlockH = rows.length * 8 + 12;
    doc.roundedRect(totalsX, y, totalsW, totalBlockH, 2, 2, 'FD');

    rows.forEach(([label, val], i) => {
      const ry = y + 5 + i * 8;
      setTextCol(doc, TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(label, totalsX + 4, ry);
      setTextCol(doc, TEXT_MAIN);
      doc.setFont('helvetica', 'bold');
      doc.text(val, totalsX + totalsW - 4, ry, { align: 'right' });
    });

    // Grand total band
    const grandY = y + totalBlockH - 10;
    setFill(doc, NAVY);
    doc.roundedRect(totalsX, grandY, totalsW, 10, 2, 2, 'F');
    setTextCol(doc, WHITE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('TOTAL PEMBAYARAN', totalsX + 4, grandY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(formatRupiah(invoice.grand_total), totalsX + totalsW - 4, grandY + 6.5, { align: 'right' });

    // Terbilang
    y += totalBlockH + 4;
    setFill(doc, '#fffbf0');
    setDrawCol(doc, ACCENT);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');

    setTextCol(doc, TEXT_MUTED);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text('Terbilang:', margin + 4, y + 6.5);
    setTextCol(doc, TEXT_MAIN);
    doc.setFont('helvetica', 'bold-italic');
    const terbilangText = doc.splitTextToSize(invoice.amount_in_words || '', contentW - 30);
    doc.text(terbilangText[0], margin + 23, y + 6.5);

    y += 16;

    // ── Signature ─────────────────────────────────────────────────────────────
    if (useSign && signImg) {
      try {
        doc.addImage(signImg, 'PNG', W - margin - 45, y, 40, 20);
        y += 22;
        setDrawCol(doc, TEXT_MAIN);
        doc.setLineWidth(0.4);
        doc.line(W - margin - 45, y, W - margin, y);
        setTextCol(doc, TEXT_MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(master.company_name || '', W - margin - 22, y + 5, { align: 'center' });
      } catch {}
    }

    // ── Footer band ───────────────────────────────────────────────────────────
    setFill(doc, NAVY);
    doc.rect(0, 285, W, 12, 'F');
    setFill(doc, ACCENT);
    doc.rect(0, 283, W, 2, 'F');

    setTextCol(doc, '#a0aec0');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      master.company_address ? `${master.company_name} | ${master.company_address}` : (master.company_name || ''),
      W / 2, 290, { align: 'center' }
    );
    if (master.company_phone) {
      doc.text(`Phone: ${master.company_phone}`, W / 2, 294, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice_${invoice.invoice_number}.pdf"`,
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