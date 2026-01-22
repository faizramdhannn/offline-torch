import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel } from 'docx';
import { google } from 'googleapis';

async function downloadImageFromDrive(fileUrl: string): Promise<Buffer | null> {
  try {
    const fileIdMatch = fileUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      console.error('Invalid Drive URL:', fileUrl);
      return null;
    }
    
    const fileId = fileIdMatch[1];
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}'),
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

function formatRupiah(value: string): string {
  const number = parseInt(value.replace(/[^0-9]/g, ''));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
}

export async function POST(request: NextRequest) {
  try {
    const { data, username, dateFrom, dateTo } = await request.json();

    // Calculate total
    const totalValue = data.reduce((sum: number, item: any) => {
      return sum + parseInt(item.value.replace(/[^0-9]/g, ''));
    }, 0);

    const dateRange = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'All Dates';

    const children = [];

    // Title
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

    const borderStyle = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    };

    // Table header
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Date', bold: true })]
            })], 
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Description', bold: true })]
            })], 
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Value', bold: true })]
            })], 
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Photo', bold: true })]
            })], 
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
        ],
      })
    ];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      console.log(`Processing row ${i + 1}/${data.length}`);

      const rowCells = [
        new TableCell({ 
          children: [new Paragraph(item.date)],
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph(toTitleCase(item.description))],
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph(item.value)],
          borders: borderStyle
        }),
      ];

      // Handle image
      if (item.link_url) {
        const imageBuffer = await downloadImageFromDrive(item.link_url);
        
        if (imageBuffer) {
          try {
            rowCells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imageBuffer,
                        transformation: { width: 150, height: 150 },
                      })
                    ]
                  })
                ],
                borders: borderStyle
              })
            );
          } catch (err) {
            console.error('Error creating ImageRun:', err);
            rowCells.push(new TableCell({ 
              children: [new Paragraph('Error loading image')],
              borders: borderStyle
            }));
          }
        } else {
          rowCells.push(new TableCell({ 
            children: [new Paragraph('Image not available')],
            borders: borderStyle
          }));
        }
      } else {
        rowCells.push(new TableCell({ 
          children: [new Paragraph('-')],
          borders: borderStyle
        }));
      }

      tableRows.push(new TableRow({ children: rowCells }));
    }

    // Total row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph('')], 
            columnSpan: 2,
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Total: ' + formatRupiah(totalValue.toString()), bold: true })]
            })],
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph('')],
            borders: borderStyle
          }),
        ],
      })
    );

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );

    // Create document
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

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Petty_Cash_${username}_${Date.now()}.docx"`,
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