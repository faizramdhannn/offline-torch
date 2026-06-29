import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import { google } from "googleapis";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanvasingExportRow {
  visit_at?: string;
  store?: string;
  name?: string;
  contact_person?: string;
  canvasser?: string;
  category?: string;
  result_status?: string;
  notes?: string;
  image_url?: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatStoreName(storeName: string): string {
  const cleanName = storeName.toLowerCase().replace("torch", "").trim();
  return `Torch ${toTitleCase(cleanName)}`;
}

// ── Google credentials ────────────────────────────────────────────────────────

export function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) throw new Error("GOOGLE_CREDENTIALS environment variable is not set");

  try {
    const credentials = JSON.parse(credsEnv);
    if (!credentials.client_email)
      throw new Error("GOOGLE_CREDENTIALS missing client_email field");
    if (!credentials.private_key)
      throw new Error("GOOGLE_CREDENTIALS missing private_key field");
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("GOOGLE_CREDENTIALS is not valid JSON");
    throw error;
  }
}

// ── Drive image downloader ────────────────────────────────────────────────────

export async function downloadImageFromDrive(
  fileUrl: string
): Promise<Buffer | null> {
  try {
    const fileIdMatch = fileUrl.match(/\/d\/([^/]+)/);
    if (!fileIdMatch) {
      console.error("Invalid Drive URL:", fileUrl);
      return null;
    }

    const fileId = fileIdMatch[1];
    const credentials = getGoogleCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const response = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

// ── Border style (shared across all cells) ────────────────────────────────────

const BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left:   { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right:  { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

// ── Header row ────────────────────────────────────────────────────────────────

const COLUMNS: { label: string; width: number }[] = [
  { label: "Tanggal",      width: 10 },
  { label: "Store",        width: 10 },
  { label: "Nama Tempat",  width: 15 },
  { label: "CP",           width: 10 },
  { label: "Canvasser",    width: 10 },
  { label: "Kategori",     width: 10 },
  { label: "Status",       width:  8 },
  { label: "Insight",      width: 20 },
  { label: "Dokumentasi",  width:  7 },
];

function buildHeaderRow(): TableRow {
  return new TableRow({
    tableHeader: true,
    children: COLUMNS.map(
      (col) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: col.label, bold: true })],
            }),
          ],
          width: { size: col.width, type: WidthType.PERCENTAGE },
          borders: BORDER,
        })
    ),
  });
}

// ── Data row ──────────────────────────────────────────────────────────────────

function cell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ text, style: "normal" })],
    borders: BORDER,
    verticalAlign: AlignmentType.CENTER,
  });
}

async function buildDataRow(item: CanvasingExportRow): Promise<TableRow> {
  const dataCells: TableCell[] = [
    cell(item.visit_at || "-"),
    cell(toTitleCase(item.store || "-")),
    cell(toTitleCase(item.name || "-")),
    cell(item.contact_person || "-"),
    cell(toTitleCase(item.canvasser || "-")),
    cell(toTitleCase(item.category || "-")),
    cell(item.result_status || "-"),
    cell(item.notes || "-"),
  ];

  // Image cell
  if (item.image_url) {
    const imageUrls = item.image_url.split(";").filter((u) => u.trim());

    if (imageUrls.length > 0) {
      const imageBuffer = await downloadImageFromDrive(imageUrls[0]);

      if (imageBuffer) {
        try {
          dataCells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      transformation: { width: 80, height: 80 },
                    }),
                  ],
                }),
              ],
              borders: BORDER,
              verticalAlign: AlignmentType.CENTER,
            })
          );
        } catch (err) {
          console.error("Error creating ImageRun:", err);
          dataCells.push(cell("Error loading"));
        }
      } else {
        dataCells.push(cell("N/A"));
      }
    } else {
      dataCells.push(cell("-"));
    }
  } else {
    dataCells.push(cell("-"));
  }

  return new TableRow({ children: dataCells });
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Builds and returns a DOCX buffer for the given canvasing data.
 * Called by the API route — keeps the route handler thin.
 */
export async function buildCanvasingDoc(
  data: CanvasingExportRow[],
  storeName: string
): Promise<Buffer> {
  const formattedStoreName = formatStoreName(storeName);

  // Title paragraph
  const title = new Paragraph({
    text: formattedStoreName,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });

  // Build table rows
  const tableRows: TableRow[] = [buildHeaderRow()];

  for (let i = 0; i < data.length; i++) {
    console.log(`Processing row ${i + 1}/${data.length}`);
    tableRows.push(await buildDataRow(data[i]));
  }

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Assemble document (A4 landscape)
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 16838, // A4 landscape width in twips
              height: 11906,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
            pageNumbers: { start: 1, formatType: "decimal" },
          },
        },
        children: [title, table],
      },
    ],
  });

  return Packer.toBuffer(doc);
}