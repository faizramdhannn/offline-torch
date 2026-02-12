import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel, ShadingType } from 'docx';
import { google } from 'googleapis';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  try {
    const credentials = JSON.parse(credsEnv);
    if (!credentials.client_email) throw new Error('GOOGLE_CREDENTIALS missing client_email field');
    if (!credentials.private_key) throw new Error('GOOGLE_CREDENTIALS missing private_key field');
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
    throw error;
  }
}

async function downloadImageFromDrive(fileUrl: string): Promise<Buffer | null> {
  try {
    const fileIdMatch = fileUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) return null;
    const fileId = fileIdMatch[1];
    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRupiah(value: string | number): string {
  const number = typeof value === 'string'
    ? parseInt(value.replace(/[^0-9]/g, ''))
    : value;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
}

const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
};

// Export Type 1: Original (with images)
async function generateExport1(data: any[], username: string, dateFrom: string, dateTo: string): Promise<Buffer> {
  const totalValue = data.reduce((sum: number, item: any) => {
    const numValue = typeof item.value === 'string'
      ? parseInt(item.value.replace(/[^0-9]/g, ''))
      : parseInt(item.value);
    return sum + numValue;
  }, 0);

  const dateRange = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'All Dates';
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: `Petty Cash (${username})`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: dateRange,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })],
          width: { size: 1350, type: WidthType.DXA },
          borders: borderStyle,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })],
          width: { size: 2700, type: WidthType.DXA },
          borders: borderStyle,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true })] })],
          width: { size: 1800, type: WidthType.DXA },
          borders: borderStyle,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Photo', bold: true })] })],
          width: { size: 3176, type: WidthType.DXA },
          borders: borderStyle,
        }),
      ],
    })
  ];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const numValue = typeof item.value === 'string'
      ? parseInt(item.value.replace(/[^0-9]/g, ''))
      : parseInt(item.value);

    const rowCells = [
      new TableCell({
        children: [new Paragraph(item.date)],
        width: { size: 1350, type: WidthType.DXA },
        borders: borderStyle,
      }),
      new TableCell({
        children: [new Paragraph(toTitleCase(item.description))],
        width: { size: 2700, type: WidthType.DXA },
        borders: borderStyle,
      }),
      new TableCell({
        children: [new Paragraph(formatRupiah(numValue))],
        width: { size: 1800, type: WidthType.DXA },
        borders: borderStyle,
      }),
    ];

    if (item.link_url) {
      const imageBuffer = await downloadImageFromDrive(item.link_url);
      if (imageBuffer) {
        try {
          rowCells.push(new TableCell({
            children: [new Paragraph({
              children: [new ImageRun({ data: imageBuffer, transformation: { width: 150, height: 150 } })]
            })],
            width: { size: 3176, type: WidthType.DXA },
            borders: borderStyle,
          }));
        } catch (err) {
          rowCells.push(new TableCell({
            children: [new Paragraph('Error loading image')],
            width: { size: 3176, type: WidthType.DXA },
            borders: borderStyle,
          }));
        }
      } else {
        rowCells.push(new TableCell({
          children: [new Paragraph('Image not available')],
          width: { size: 3176, type: WidthType.DXA },
          borders: borderStyle,
        }));
      }
    } else {
      rowCells.push(new TableCell({
        children: [new Paragraph('-')],
        width: { size: 3176, type: WidthType.DXA },
        borders: borderStyle,
      }));
    }

    tableRows.push(new TableRow({ children: rowCells }));
  }

  tableRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph('')],
        columnSpan: 2,
        borders: borderStyle,
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: 'Total: ' + formatRupiah(totalValue), bold: true })]
        })],
        borders: borderStyle,
      }),
      new TableCell({
        children: [new Paragraph('')],
        borders: borderStyle,
      }),
    ],
  }));

  children.push(new Table({
    rows: tableRows,
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1350, 2700, 1800, 3176],
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children
    }]
  });

  return await Packer.toBuffer(doc);
}

// Export Type 2: Vertical format - Store repeated with categories
async function generateExport2(data: any[], username: string, dateFrom: string, dateTo: string): Promise<Buffer> {
  const dateRange = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'All Dates';
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: `Petty Cash Summary - ${username}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: dateRange,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Get unique stores and categories
  const uniqueStores = [...new Set(data.map((item: any) => item.store).filter(Boolean))].sort() as string[];
  const uniqueCategories = [...new Set(data.map((item: any) => item.category).filter(Boolean))].sort() as string[];

  if (uniqueStores.length === 0 || uniqueCategories.length === 0) {
    children.push(new Paragraph({ text: 'No data available', alignment: AlignmentType.CENTER }));
  } else {
    // Build vertical table format
    const headerBg = { fill: 'D9E1F2', type: ShadingType.CLEAR };
    
    // Column widths
    const storeColWidth = 2500;
    const categoryColWidth = 4000;
    const nominalColWidth = 2526;

    // Header row
    const headerCells = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'STORE', bold: true })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: storeColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'KATEGORI', bold: true })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: categoryColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'NOMINAL', bold: true })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: nominalColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    ];

    const tableRows: TableRow[] = [new TableRow({ tableHeader: true, children: headerCells })];

    let grandTotal = 0;

    // Data rows - each store repeated for each category
    for (const store of uniqueStores) {
      const storeData = data.filter((item: any) => item.store === store);
      
      for (const category of uniqueCategories) {
        const categoryData = storeData.filter((item: any) => item.category === category);
        const categoryTotal = categoryData.reduce((sum: number, item: any) => {
          return sum + (parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0);
        }, 0);

        grandTotal += categoryTotal;

        const rowCells = [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: toTitleCase(store) })] })],
            width: { size: storeColWidth, type: WidthType.DXA },
            borders: borderStyle,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: category })] })],
            width: { size: categoryColWidth, type: WidthType.DXA },
            borders: borderStyle,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: categoryTotal > 0 ? formatRupiah(categoryTotal) : '-' })],
              alignment: AlignmentType.RIGHT,
            })],
            width: { size: nominalColWidth, type: WidthType.DXA },
            borders: borderStyle,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
        ];

        tableRows.push(new TableRow({ children: rowCells }));
      }
    }

    // Grand total row
    const grandTotalCells = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'GRAND TOTAL', bold: true })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        columnSpan: 2,
        borders: borderStyle,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: formatRupiah(grandTotal), bold: true })],
          alignment: AlignmentType.RIGHT,
        })],
        shading: headerBg,
        width: { size: nominalColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    ];
    tableRows.push(new TableRow({ children: grandTotalCells }));

    const colWidths = [storeColWidth, categoryColWidth, nominalColWidth];
    children.push(new Table({
      rows: tableRows,
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: colWidths,
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 Portrait
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children
    }]
  });

  return await Packer.toBuffer(doc);
}

export async function POST(request: NextRequest) {
  try {
    const { data, username, dateFrom, dateTo, exportType } = await request.json();

    let buffer: Buffer;
    let filename: string;

    if (exportType === 2) {
      buffer = await generateExport2(data, username, dateFrom, dateTo);
      filename = `Petty_Cash_Summary_${username}_${Date.now()}.docx`;
    } else {
      buffer = await generateExport1(data, username, dateFrom, dateTo);
      filename = `Petty_Cash_${username}_${Date.now()}.docx`;
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating document:', error);
    return NextResponse.json(
      { error: 'Failed to generate document', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}