import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, PageOrientation, HeadingLevel } from 'docx';
import { google } from 'googleapis';

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  
  if (!credsEnv) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  }

  try {
    const credentials = JSON.parse(credsEnv);
    
    if (!credentials.client_email) {
      throw new Error('GOOGLE_CREDENTIALS missing client_email field');
    }
    if (!credentials.private_key) {
      throw new Error('GOOGLE_CREDENTIALS missing private_key field');
    }
    
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('GOOGLE_CREDENTIALS is not valid JSON');
    }
    throw error;
  }
}

async function downloadImageFromDrive(fileUrl: string): Promise<Buffer | null> {
  try {
    const fileIdMatch = fileUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      console.error('Invalid Drive URL:', fileUrl);
      return null;
    }
    
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

function formatStoreName(storeName: string): string {
  // Convert store name like "margonda" to "Torch Margonda"
  const cleanName = storeName.toLowerCase().replace('torch', '').trim();
  return `Torch ${toTitleCase(cleanName)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { data, storeName } = await request.json();

    const formattedStoreName = formatStoreName(storeName);

    const children = [];

    // Title
    children.push(
      new Paragraph({
        text: formattedStoreName,
        heading: HeadingLevel.HEADING_1,
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
              children: [new TextRun({ text: 'Tanggal', bold: true })]
            })], 
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Store', bold: true })]
            })], 
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Nama Tempat', bold: true })]
            })], 
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'CP', bold: true })]
            })], 
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Canvasser', bold: true })]
            })], 
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Kategori', bold: true })]
            })], 
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Status', bold: true })]
            })], 
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Insight', bold: true })]
            })], 
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: borderStyle
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: 'Dokumentasi', bold: true })]
            })], 
            width: { size: 7, type: WidthType.PERCENTAGE },
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
          children: [new Paragraph({ text: item.visit_at || '-', style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: toTitleCase(item.store || '-'), style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: toTitleCase(item.name || '-'), style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: item.contact_person || '-', style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: toTitleCase(item.canvasser || '-'), style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: toTitleCase(item.category || '-'), style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: item.result_status || '-', style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({ 
          children: [new Paragraph({ text: item.notes || '-', style: 'normal' })],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }),
      ];

      // Handle images
      if (item.image_url) {
        const imageUrls = item.image_url.split(';').filter((url: string) => url.trim());
        
        if (imageUrls.length > 0) {
          const imageBuffer = await downloadImageFromDrive(imageUrls[0]);
          
          if (imageBuffer) {
            try {
              rowCells.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: imageBuffer,
                          transformation: { width: 80, height: 80 },
                        })
                      ]
                    })
                  ],
                  borders: borderStyle,
                  verticalAlign: AlignmentType.CENTER
                })
              );
            } catch (err) {
              console.error('Error creating ImageRun:', err);
              rowCells.push(new TableCell({ 
                children: [new Paragraph('Error loading')],
                borders: borderStyle,
                verticalAlign: AlignmentType.CENTER
              }));
            }
          } else {
            rowCells.push(new TableCell({ 
              children: [new Paragraph('N/A')],
              borders: borderStyle,
              verticalAlign: AlignmentType.CENTER
            }));
          }
        } else {
          rowCells.push(new TableCell({ 
            children: [new Paragraph('-')],
            borders: borderStyle,
            verticalAlign: AlignmentType.CENTER
          }));
        }
      } else {
        rowCells.push(new TableCell({ 
          children: [new Paragraph('-')],
          borders: borderStyle,
          verticalAlign: AlignmentType.CENTER
        }));
      }

      tableRows.push(new TableRow({ children: rowCells }));
    }

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );

    // Create document with landscape orientation
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { 
              width: 16838,  // A4 width in landscape
              height: 11906  // A4 height in landscape
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
            pageNumbers: {
              start: 1,
              formatType: 'decimal'
            }
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
        'Content-Disposition': `attachment; filename="Canvasing_${storeName}_${Date.now()}.docx"`,
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