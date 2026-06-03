import { google } from 'googleapis';
import { Readable } from 'stream';

const ATTENDANCE_FOLDER_ID = process.env.DRIVE_ATTENDANCE_FOLDER_ID || '';

// Cache store sub-folder IDs to avoid repeated API calls
const storeFolderCache = new Map<string, string>();

function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

/**
 * Get or create a sub-folder for a store inside the attendance folder.
 */
async function getStoreFolderId(drive: any, storeName: string): Promise<string> {
  if (storeFolderCache.has(storeName)) {
    return storeFolderCache.get(storeName)!;
  }

  // Search for existing folder
  const safeStoreName = storeName.replace(/'/g, "\\'");
  const query = `name='${safeStoreName}' and mimeType='application/vnd.google-apps.folder' and '${ATTENDANCE_FOLDER_ID}' in parents and trashed=false`;

  const searchRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  let folderId: string;

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    folderId = searchRes.data.files[0].id!;
  } else {
    // Create new folder
    const createRes = await drive.files.create({
      requestBody: {
        name: storeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ATTENDANCE_FOLDER_ID],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    folderId = createRes.data.id!;
  }

  storeFolderCache.set(storeName, folderId);
  return folderId;
}

/**
 * Convert base64 data URL to Buffer.
 * Compresses JPEG quality to keep file size small.
 */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URL format');
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  return { buffer, mimeType };
}

/**
 * Upload a selfie photo to Google Drive.
 *
 * @param dataUrl   Base64 data URL of the image (from canvas.toDataURL)
 * @param fileName  File name WITHOUT extension, e.g. "Open_Lembong_20250601"
 * @param storeName Store name used as sub-folder
 * @returns         Google Drive web view URL
 */
export async function uploadAttendanceSelfie(
  dataUrl: string,
  fileName: string,
  storeName: string
): Promise<string> {
  if (!ATTENDANCE_FOLDER_ID) {
    throw new Error('DRIVE_ATTENDANCE_FOLDER_ID environment variable is not set');
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const { buffer, mimeType } = dataUrlToBuffer(dataUrl);

  // Determine extension
  let ext = '.jpg';
  if (mimeType.includes('png')) ext = '.png';
  else if (mimeType.includes('webp')) ext = '.webp';

  const fullFileName = `${fileName}${ext}`;

  // Get/create store sub-folder
  const folderId = await getStoreFolderId(drive, storeName);

  // Upload file
  const fileStream = Readable.from(buffer);
  const uploadRes = await drive.files.create({
    requestBody: {
      name: fullFileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fileStream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  // Make file publicly readable (optional — remove if you want private)
  try {
    await drive.permissions.create({
      fileId: uploadRes.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission setting is best-effort
  }

  return uploadRes.data.webViewLink ||
    `https://drive.google.com/file/d/${uploadRes.data.id}/view`;
}