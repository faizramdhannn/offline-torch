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

// Export Type 2: Vertical format - Store repeated with categories (with logo and budget info)
async function generateExport2(data: any[], username: string, dateFrom: string, dateTo: string): Promise<Buffer> {
  const children: any[] = [];

  // Download logo
  let logoBuffer: Buffer | null = null;
  try {
    const logoUrl = 'https://cdn.shopify.com/s/files/1/1615/1301/files/torch_new_png_colour_f32e423a-2e1b-4c20-9e98-877401f730fa.png?v=1770873924';
    const response = await fetch(logoUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      logoBuffer = Buffer.from(arrayBuffer);
    }
  } catch (error) {
    console.error('Error downloading logo:', error);
  }

  // Header with logo and title side by side
  if (logoBuffer) {
    try {
      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: logoBuffer,
                          transformation: { width: 150, height: 80 },
                        })
                      ],
                      alignment: AlignmentType.LEFT,
                    })
                  ],
                  width: { size: 2000, type: WidthType.DXA },
                  borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  verticalAlign: AlignmentType.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      text: 'PETTY CASH REPORT',
                      heading: HeadingLevel.HEADING_1,
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      text: 'OFFLINE/STORE',
                      heading: HeadingLevel.HEADING_2,
                      alignment: AlignmentType.CENTER,
                    })
                  ],
                  width: { size: 7026, type: WidthType.DXA },
                  borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  verticalAlign: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
          width: { size: 9026, type: WidthType.DXA },
        }),
        new Paragraph({ text: '', spacing: { after: 300 } })
      );
    } catch (err) {
      console.error('Error adding logo:', err);
    }
  } else {
    // Fallback if logo fails
    children.push(
      new Paragraph({
        text: 'PETTY CASH REPORT',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        text: 'OFFLINE/STORE',
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );
  }

  // Get current month name
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentMonth = dateFrom ? monthNames[new Date(dateFrom).getMonth()] : monthNames[new Date().getMonth()];

  // Calculate totals for later use
  const pemakaianDana = data.reduce((sum: number, item: any) => {
    return sum + (parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0);
  }, 0);

  // Budget info table - empty values for manual input
  const budgetTableRows = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Anggaran', bold: true })] })],
          width: { size: 2000, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: borderStyle.left, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ':' })] })],
          width: { size: 300, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: currentMonth })] })],
          width: { size: 3726, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Rp' })], alignment: AlignmentType.RIGHT })],
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: 'E7E6E6', type: ShadingType.CLEAR },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: borderStyle.right },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Pemakaian Dana', bold: true })] })],
          width: { size: 2000, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: borderStyle.left, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ':' })] })],
          width: { size: 300, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: currentMonth })] })],
          width: { size: 3726, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Rp' })], alignment: AlignmentType.RIGHT })],
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: 'E7E6E6', type: ShadingType.CLEAR },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: borderStyle.right },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Sisa Dana', bold: true })] })],
          width: { size: 2000, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: borderStyle.left, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ':' })] })],
          width: { size: 300, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: currentMonth })] })],
          width: { size: 3726, type: WidthType.DXA },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Rp' })], alignment: AlignmentType.RIGHT })],
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: 'C5E0B4', type: ShadingType.CLEAR },
          borders: { top: borderStyle.top, bottom: borderStyle.bottom, left: { style: BorderStyle.NONE, size: 0 }, right: borderStyle.right },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      ],
    }),
  ];

  children.push(
    new Table({
      rows: budgetTableRows,
      width: { size: 9026, type: WidthType.DXA },
    }),
    new Paragraph({ text: '', spacing: { after: 300 } })
  );

  // Get unique stores and categories
  const uniqueStores = [...new Set(data.map((item: any) => item.store).filter(Boolean))].sort() as string[];
  const uniqueCategories = [...new Set(data.map((item: any) => item.category).filter(Boolean))].sort() as string[];

  if (uniqueStores.length === 0 || uniqueCategories.length === 0) {
    children.push(new Paragraph({ text: 'No data available', alignment: AlignmentType.CENTER }));
  } else {
    // Build vertical table format
    const headerBg = { fill: '000000', type: ShadingType.CLEAR };
    
    // Column widths
    const storeColWidth = 2500;
    const categoryColWidth = 4000;
    const nominalColWidth = 2526;

    // Header row with black background and white text - only once
    const headerCells = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'STORE', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: storeColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'KATEGORI', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: categoryColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'NOMINAL', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: headerBg,
        width: { size: nominalColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      }),
    ];

    const tableRows: TableRow[] = [new TableRow({ children: headerCells })];

    // Data rows - each store repeated for each category
    for (const store of uniqueStores) {
      const storeData = data.filter((item: any) => item.store === store);
      
      for (const category of uniqueCategories) {
        const categoryData = storeData.filter((item: any) => item.category === category);
        const categoryTotal = categoryData.reduce((sum: number, item: any) => {
          return sum + (parseInt((item.value || '0').replace(/[^0-9]/g, '')) || 0);
        }, 0);

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

    // Total row with yellow background
    const totalBg = { fill: 'FFD966', type: ShadingType.CLEAR };
    const totalCells = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL BIAYA', bold: true })], alignment: AlignmentType.CENTER })],
        shading: totalBg,
        columnSpan: 2,
        borders: borderStyle,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: formatRupiah(pemakaianDana), bold: true })],
          alignment: AlignmentType.RIGHT,
        })],
        shading: totalBg,
        width: { size: nominalColWidth, type: WidthType.DXA },
        borders: borderStyle,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      }),
    ];
    tableRows.push(new TableRow({ children: totalCells }));

    const colWidths = [storeColWidth, categoryColWidth, nominalColWidth];
    children.push(new Table({
      rows: tableRows,
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: colWidths,
    }));
  }

  // Note section
  children.push(
    new Paragraph({ text: '', spacing: { before: 300, after: 200 } }),
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Note:', italics: true })] })],
              borders: borderStyle,
              margins: { top: 400, bottom: 400, left: 200, right: 200 },
            }),
          ],
        }),
      ],
      width: { size: 9026, type: WidthType.DXA },
    })
  );

  // Signature section - no borders, smaller size
  children.push(
    new Paragraph({ text: '', spacing: { before: 300, after: 100 } }),
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Diajukan:', bold: true })], alignment: AlignmentType.CENTER })],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Disetujui:', bold: true })], alignment: AlignmentType.CENTER })],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ text: '', spacing: { before: 400, after: 400 } }),
              ],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
            new TableCell({
              children: [
                new Paragraph({ text: '', spacing: { before: 400, after: 400 } }),
              ],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: 'Achmad Odi', bold: true, underline: {} })], alignment: AlignmentType.CENTER, spacing: { after: 50 } }),
                new Paragraph({ children: [new TextRun({ text: 'O2O Operasional', size: 20 })], alignment: AlignmentType.CENTER }),
              ],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: 'Dicky Rahmad', bold: true, underline: {} })], alignment: AlignmentType.CENTER, spacing: { after: 50 } }),
                new Paragraph({ children: [new TextRun({ text: 'Head Of Retail Sales & E-Commers', size: 20 })], alignment: AlignmentType.CENTER }),
              ],
              width: { size: 4513, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            }),
          ],
        }),
      ],
      width: { size: 9026, type: WidthType.DXA },
    })
  );

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