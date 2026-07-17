import { google } from 'googleapis';
import { Readable } from 'stream';

// Upload foto bukti error Daily Job ke Shared Drive yang SAMA dengan
// Employee Discount (DRIVE_EMPLOYEE_DISCOUNT_FOLDER_ID), tapi dengan nesting
// 2 level (bukan 1 level seperti lib/drive.ts):
//
//   DRIVE_EMPLOYEE_DISCOUNT_FOLDER_ID
//     └── <reportType>            (delivery_note_report | sales_order_report | stock_entry_report)
//           └── <taftName>        (user.name si taft yang lapor)
//                 └── file foto

const ROOT_FOLDER_ID = process.env.DRIVE_EMPLOYEE_DISCOUNT_FOLDER_ID || '';

// Cache folderId per (parentId + folderName) supaya tidak search/create
// berulang-ulang untuk upload beruntun dari taft/report-type yang sama.
const folderCache = new Map<string, string>();

function getGoogleCredentials() {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  if (!credsEnv) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  }
  const credentials = JSON.parse(credsEnv);
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('GOOGLE_CREDENTIALS missing client_email/private_key field');
  }
  return credentials;
}

// Cari subfolder `folderName` langsung di bawah `parentId`; buat kalau belum
// ada. Sama query pattern dengan lib/drive.ts getUserFolder, dibuat generic
// supaya bisa dipanggil 2x (report-type level, lalu taft-name level).
async function getOrCreateNestedFolder(drive: any, parentId: string, folderName: string): Promise<string> {
  const cacheKey = `${parentId}/${folderName}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const searchResponse = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  let folderId: string;
  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    folderId = searchResponse.data.files[0].id!;
  } else {
    const folderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    folderId = folderResponse.data.id!;
  }

  folderCache.set(cacheKey, folderId);
  return folderId;
}

export type DailyJobReportType = 'delivery_note_report' | 'sales_order_report' | 'stock_entry_report';

export async function uploadDailyJobErrorPhoto(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  reportType: DailyJobReportType,
  taftName: string
): Promise<string> {
  const credentials = getGoogleCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    // Sama scope dengan lib/drive.ts uploadToGoogleDrive — butuh scope penuh
    // 'drive' (bukan cuma 'drive.file') karena create folder di Shared Drive.
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const drive = google.drive({ version: 'v3', auth });

  const reportTypeFolderId = await getOrCreateNestedFolder(drive, ROOT_FOLDER_ID, reportType);
  const taftFolderId = await getOrCreateNestedFolder(drive, reportTypeFolderId, taftName || 'unknown');

  let extension = '';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
  else if (mimeType.includes('png')) extension = '.png';
  else if (mimeType.includes('pdf')) extension = '.pdf';

  const fullFileName = `${fileName}${extension}`;

  const response = await drive.files.create({
    requestBody: {
      name: fullFileName,
      parents: [taftFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
}
