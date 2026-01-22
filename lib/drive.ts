import { google } from 'googleapis';

const PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID || '';

const userFolderCache = new Map<string, string>();

async function getUserFolder(username: string, drive: any): Promise<string> {
  if (userFolderCache.has(username)) {
    return userFolderCache.get(username)!;
  }

  const query = `name='${username}' and mimeType='application/vnd.google-apps.folder' and '${PARENT_FOLDER_ID}' in parents and trashed=false`;
  
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
    const folderMetadata = {
      name: username,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [PARENT_FOLDER_ID],
    };

    const folderResponse = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
      supportsAllDrives: true,
    });

    folderId = folderResponse.data.id!;
  }

  userFolderCache.set(username, folderId);
  return folderId;
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  username: string
): Promise<string> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    const userFolderId = await getUserFolder(username, drive);

    let extension = '';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
    else if (mimeType.includes('png')) extension = '.png';
    else if (mimeType.includes('pdf')) extension = '.pdf';
    
    const fullFileName = `${fileName}${extension}`;

    const fileMetadata = {
      name: fullFileName,
      parents: [userFolderId],
    };

    const media = {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
}

export async function getFileContentFromDrive(fileId: string): Promise<Buffer> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    throw error;
  }
}