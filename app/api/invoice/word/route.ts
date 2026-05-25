import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function parseBoolField(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toUpperCase() === 'TRUE';
  return false;
}

// ── Image fetch (sama persis dengan pdf/route.ts) ─────────────────────────────
async function downloadImageAsBase64(url: string): Promise<{ data: Buffer; mimeType: string } | null> {
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

async function tryFetch(url: string): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf), mimeType: ct };
  } catch {
    return null;
  }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY     = '1a3a6b';
const NAVY_MID = '2d5a9e';
const LIGHT_ROW = 'dce8f5';
const WHITE    = 'ffffff';
const TEXT_GRAY = '555555';
const AMBER_TEXT = '7b5800';
const AMBER_BG   = 'fffbe6';
const AMBER_BORDER = 'f0c040';

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const noBorder   = { style: BorderStyle.NONE,   size: 0, color: 'ffffff' };

const tableBorders = {
  top: thinBorder, bottom: thinBorder,
  left: thinBorder, right: thinBorder,
};
const noBorders = {
  top: noBorder, bottom: noBorder,
  left: noBorder, right: noBorder,
};

// A4 content width: 11906 − 720×2 = 10466 DXA
const PAGE_WIDTH = 10466;
const COL_QTY   = 800;
const COL_PRICE = 2400;
const COL_TOTAL = 2000;
const COL_DESC  = PAGE_WIDTH - COL_QTY - COL_PRICE - COL_TOTAL;

// ── Cell builders ─────────────────────────────────────────────────────────────
function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: NAVY_MID, type: ShadingType.CLEAR },
    borders: tableBorders,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 18, font: 'Times' })],
    })],
  });
}

function dataCell(
  text: string,
  width: number,
  opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; shade?: boolean } = {}
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts.shade ? LIGHT_ROW : WHITE, type: ShadingType.CLEAR },
    borders: tableBorders,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold ?? false, size: 18, font: 'Times', color: NAVY })],
    })],
  });
}

function totalRow(label: string, value: string, isGrand = false): TableRow {
  const fill      = isGrand ? NAVY_MID : (label.includes('Sub') ? LIGHT_ROW : 'f0f4fa');
  const textColor = isGrand ? WHITE : NAVY;
  const sz        = isGrand ? 20 : 18;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: PAGE_WIDTH - 2400, type: WidthType.DXA },
        borders: isGrand ? tableBorders : noBorders,
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: label, bold: true, size: sz, font: 'Times', color: textColor })],
        })],
      }),
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        borders: isGrand ? tableBorders : noBorders,
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: value, bold: isGrand, size: sz, font: 'Times', color: textColor })],
        })],
      }),
    ],
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
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
      return NextResponse.json({ error: 'Word hanya tersedia untuk invoice dengan status submitted' }, { status: 403 });
    }

    const items      = allItems.filter((r: any) => r.invoice_id === invoice_id);
    const master     = masterArr[0] || {};
    const isQuotation = (invoice.doc_type || 'invoice').toLowerCase() === 'quotation';
    const docLabel   = isQuotation ? 'QUOTATION' : 'INVOICE';
    const hasPPN     = Number(invoice.tax_percent) > 0;
    const useSign    = parseBoolField(invoice.use_signature);

    // Fetch images — sama persis dengan pdf/route.ts
    const [headerImgResult, signImgResult] = await Promise.all([
      downloadImageAsBase64(master.header_image_url || ''),
      downloadImageAsBase64(master.signature_image_url || ''),
    ]);

    const children: any[] = [];

    // ── HEADER: logo kiri | doc label kanan ───────────────────────────────────
    // Kolom kiri: logo + info perusahaan
    const logoH_emu  = 685800;  // ≈ 18 mm dalam EMU (1mm = 36000 EMU)
    const logoW_emu  = 952500;  // ≈ 26 mm
    const LEFT_COL   = PAGE_WIDTH - 3200;
    const RIGHT_COL  = 3200;

    const companyChildren: any[] = [];

    if (headerImgResult) {
      companyChildren.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new ImageRun({
            data: headerImgResult.data,
            transformation: { width: Math.round(logoW_emu / 9144), height: Math.round(logoH_emu / 9144) },
          }),
        ],
      }));
    } else {
      // Fallback teks jika gambar gagal
      companyChildren.push(new Paragraph({
        children: [new TextRun({ text: '[LOGO]', size: 14, color: NAVY_MID, font: 'Times' })],
        spacing: { after: 60 },
      }));
    }

    companyChildren.push(new Paragraph({
      children: [new TextRun({ text: master.company_name || 'MAHA NAGARI NUSANTARA', bold: true, size: 22, color: NAVY, font: 'Times' })],
      spacing: { after: 40 },
    }));
    if (master.company_address) {
      companyChildren.push(new Paragraph({
        children: [new TextRun({ text: master.company_address, size: 15, color: TEXT_GRAY, font: 'Times' })],
        spacing: { after: 20 },
      }));
    }
    if (master.company_phone) {
      companyChildren.push(new Paragraph({
        children: [new TextRun({ text: `Phone: ${master.company_phone}`, size: 15, color: TEXT_GRAY, font: 'Times' })],
        spacing: { after: 20 },
      }));
    }
    if (master.company_email) {
      companyChildren.push(new Paragraph({
        children: [new TextRun({ text: master.company_email, size: 15, color: TEXT_GRAY, font: 'Times' })],
      }));
    }

    // Kolom kanan: doc label + nomor
    const rightChildren: any[] = [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60 },
        children: [new TextRun({ text: docLabel, bold: true, italics: true, size: 52, color: NAVY, font: 'Times' })],
      }),
    ];
    if (invoice.invoice_number) {
      rightChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `#${invoice.invoice_number}`, bold: true, size: 22, color: NAVY_MID, font: 'Times' })],
      }));
    }

    children.push(new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: [LEFT_COL, RIGHT_COL],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      rows: [new TableRow({
        children: [
          new TableCell({ borders: noBorders, width: { size: LEFT_COL, type: WidthType.DXA }, children: companyChildren }),
          new TableCell({ borders: noBorders, width: { size: RIGHT_COL, type: WidthType.DXA }, children: rightChildren }),
        ],
      })],
    }));

    // Divider
    children.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY_MID, space: 1 } },
      children: [],
    }));

    // ── KEPADA YTH ────────────────────────────────────────────────────────────
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Kepada Yth :', bold: true, size: 18, color: TEXT_GRAY, font: 'Times' })],
    }));
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: invoice.customer_name || '', bold: true, size: 20, color: NAVY, font: 'Times' })],
    }));
    if (invoice.customer_address) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: invoice.customer_address, size: 16, color: TEXT_GRAY, font: 'Times' })],
      }));
    }

    children.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));

    // ── ITEMS TABLE ────────────────────────────────────────────────────────────
    const itemRows = items.map((item: any) => {
      const lineTotal = item.total_price || (Number(item.qty) * Number(item.unit_price));
      return new TableRow({
        children: [
          dataCell(String(item.qty || 0), COL_QTY, { align: AlignmentType.CENTER, shade: true }),
          dataCell(item.product_name || '', COL_DESC, { shade: true }),
          dataCell(formatRupiahFull(item.unit_price), COL_PRICE, { align: AlignmentType.RIGHT, shade: true }),
          dataCell(formatRupiah(lineTotal), COL_TOTAL, { align: AlignmentType.RIGHT, bold: true, shade: true }),
        ],
      });
    });

    children.push(new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: [COL_QTY, COL_DESC, COL_PRICE, COL_TOTAL],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Qty', COL_QTY),
            headerCell('Nama Produk', COL_DESC),
            headerCell('Harga Satuan', COL_PRICE),
            headerCell('Total', COL_TOTAL),
          ],
        }),
        ...itemRows,
      ],
    }));

    children.push(new Paragraph({ spacing: { before: 100 }, children: [] }));

    // ── TOTALS ────────────────────────────────────────────────────────────────
    const totalRows: TableRow[] = [totalRow('SubTotal', formatRupiah(invoice.subtotal))];
    if (hasPPN) {
      totalRows.push(totalRow(
        `PPN ${invoice.tax_percent}% (info)`,
        formatRupiah(invoice.tax_amount)
      ));
    }
    totalRows.push(totalRow('Total Pembayaran', formatRupiah(invoice.grand_total), true));

    children.push(new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: [PAGE_WIDTH - 2400, 2400],
      rows: totalRows,
    }));

    // ── TERBILANG ─────────────────────────────────────────────────────────────
    if (invoice.amount_in_words) {
      children.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
      children.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        shading: { fill: AMBER_BG, type: ShadingType.CLEAR },
        border: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: AMBER_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: AMBER_BORDER },
          left:   { style: BorderStyle.SINGLE, size: 4, color: AMBER_BORDER },
          right:  { style: BorderStyle.SINGLE, size: 4, color: AMBER_BORDER },
        },
        children: [
          new TextRun({ text: 'Terbilang: ', bold: true, italics: true, size: 17, font: 'Times', color: AMBER_TEXT }),
          new TextRun({ text: invoice.amount_in_words, italics: true, size: 17, font: 'Times', color: AMBER_TEXT }),
        ],
      }));
    }

    // ── SIGNATURE ────────────────────────────────────────────────────────────
    children.push(new Paragraph({ spacing: { before: 320 }, children: [] }));

    const sigStoreName = invoice.signature_store || '';
    const sigPicName   = invoice.signature_pic   || '';

    // Baris 1: "Mengetahui," kiri | "Bandung, tanggal" kanan
    const SIG_L = Math.floor(PAGE_WIDTH / 2);
    const SIG_R = PAGE_WIDTH - SIG_L;

    // Baris gambar tanda tangan (kiri saja, sesuai PDF)
    const sigImageChildren: any[] = [];
    if (useSign && signImgResult) {
      try {
        sigImageChildren.push(new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [
            new ImageRun({
              data: signImgResult.data,
              transformation: { width: 105, height: 66 }, // ≈ 40mm × 25mm dalam pixel (96dpi)
            }),
          ],
        }));
      } catch {
        sigImageChildren.push(new Paragraph({ spacing: { before: 700 }, children: [] }));
      }
    } else {
      // Ruang kosong setara tinggi gambar
      sigImageChildren.push(new Paragraph({ spacing: { before: 700 }, children: [] }));
    }

    children.push(new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: [SIG_L, SIG_R],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      rows: [
        // Row 1: header teks
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: SIG_L, type: WidthType.DXA },
              children: [new Paragraph({
                children: [new TextRun({ text: 'Mengetahui,', bold: true, size: 18, font: 'Times', color: NAVY })],
              })],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: SIG_R, type: WidthType.DXA },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `Bandung, ${formatDate(invoice.invoice_date)}`, bold: true, size: 18, font: 'Times', color: NAVY })],
              })],
            }),
          ],
        }),
        // Row 2: gambar tanda tangan kiri | ruang kosong kanan
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: SIG_L, type: WidthType.DXA },
              children: sigImageChildren,
            }),
            new TableCell({
              borders: noBorders,
              width: { size: SIG_R, type: WidthType.DXA },
              children: [new Paragraph({ spacing: { before: useSign && signImgResult ? 20 : 700 }, children: [] })],
            }),
          ],
        }),
        // Row 3: nama kiri | nama toko kanan
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: SIG_L, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Achmad Odi Primandana', bold: true, size: 18, font: 'Times', color: NAVY })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Area Supervisor', size: 16, font: 'Times', color: TEXT_GRAY })],
                }),
              ],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: SIG_R, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({
                    text: sigStoreName || invoice.customer_name || '',
                    bold: true, size: 18, font: 'Times', color: NAVY,
                  })],
                }),
                ...(sigPicName ? [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: sigPicName, size: 16, font: 'Times', color: TEXT_GRAY })],
                })] : []),
              ],
            }),
          ],
        }),
      ],
    }));

    // ── Build & output ────────────────────────────────────────────────────────
    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Times', size: 18 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = isQuotation
      ? `Quotation_${invoice.customer_name || invoice_id}.docx`
      : `Invoice_${invoice.invoice_number || invoice_id}.docx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice Word:', error);
    return NextResponse.json(
      { error: 'Failed to generate Word', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}