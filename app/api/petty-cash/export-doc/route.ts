import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { data, username, dateFrom, dateTo } = await request.json();

    // Create temporary directory
    const tempDir = `/tmp/petty-cash-${Date.now()}`;
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Save Google credentials to temp file
    const credPath = path.join(tempDir, 'credentials.json');
    await fs.promises.writeFile(credPath, process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');

    // Create Node.js script to generate DOCX
    const scriptPath = path.join(tempDir, 'generate.js');
    const outputPath = path.join(tempDir, 'output.docx');

    const formatRupiah = (value: string) => {
      const number = parseInt(value.replace(/[^0-9]/g, ''));
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(number);
    };

    // Calculate total
    const totalValue = data.reduce((sum: number, item: any) => {
      return sum + parseInt(item.value.replace(/[^0-9]/g, ''));
    }, 0);

    const dateRange = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'All Dates';

    // Generate script content
    const scriptContent = `const { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel } = require('docx');
const fs = require('fs');
const { google } = require('googleapis');

const credentials = JSON.parse(fs.readFileSync('${credPath}', 'utf8'));

async function downloadImageFromDrive(fileUrl) {
  try {
    const fileIdMatch = fileUrl.match(/\\/d\\/([^\\/]+)/);
    if (!fileIdMatch) {
      console.error('Invalid Drive URL:', fileUrl);
      return null;
    }
    
    const fileId = fileIdMatch[1];
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\\b\\w/g, (char) => char.toUpperCase());
}

async function createDoc() {
  const data = ${JSON.stringify(data)};
  const username = ${JSON.stringify(username)};
  const dateRange = ${JSON.stringify(dateRange)};
  const totalValue = ${JSON.stringify(formatRupiah(totalValue.toString()))};

  const children = [];

  children.push(
    new Paragraph({
      text: \`Petty Cash (\${username})\`,
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

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ 
          children: [new Paragraph({ text: 'Date', bold: true })], 
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph({ text: 'Description', bold: true })], 
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph({ text: 'Value', bold: true })], 
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph({ text: 'Photo', bold: true })], 
          width: { size: 35, type: WidthType.PERCENTAGE },
          borders: borderStyle
        }),
      ],
    })
  ];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    console.log('Processing row ' + (i + 1) + '/' + data.length);

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

  tableRows.push(
    new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph('')], 
          columnSpan: 2,
          borders: borderStyle
        }),
        new TableCell({ 
          children: [new Paragraph({ text: 'Total: ' + totalValue, bold: true })],
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

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Document created successfully');
}

createDoc().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
`;

    await fs.promises.writeFile(scriptPath, scriptContent);

    // Install dependencies
    await execAsync('npm init -y && npm install docx googleapis', { cwd: tempDir });

    // Run the script with longer timeout
    console.log('Generating document...');
    await execAsync(`node ${scriptPath}`, { cwd: tempDir, timeout: 180000 });

    // Read the generated file
    const fileBuffer = await fs.promises.readFile(outputPath);

    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true });

    return new NextResponse(fileBuffer, {
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