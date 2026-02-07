import { google } from 'googleapis';

const PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID || '';
const CUSTOMER_FOLDER_ID = process.env.DRIVE_CUSTOMER_FOLDER_ID || '';
const CANVASING_FOLDER_ID = process.env.DRIVE_CANVASING_FOLDER_ID || '';

const userFolderCache = new Map<string, string>();

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

async function getUserFolder(username: string, drive: any, parentFolderId: string): Promise<string> {
  const cacheKey = `${parentFolderId}_${username}`;
  if (userFolderCache.has(cacheKey)) {
    return userFolderCache.get(cacheKey)!;
  }

  const query = `name='${username}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
  
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
      parents: [parentFolderId],
    };

    const folderResponse = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
      supportsAllDrives: true,
    });

    folderId = folderResponse.data.id!;
  }

  userFolderCache.set(cacheKey, folderId);
  return folderId;
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  username: string
): Promise<string> {
  try {
    const credentials = getGoogleCredentials();
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Determine which parent folder to use
    let parentFolderId = PARENT_FOLDER_ID;
    if (username === 'customer_followup') {
      parentFolderId = CUSTOMER_FOLDER_ID;
      username = 'followup'; // Use 'followup' as folder name for customer uploads
    } else if (username === 'canvasing') {
      // For canvasing uploads, use the canvasing folder directly without subfolder
      parentFolderId = CANVASING_FOLDER_ID;
      username = 'canvasing';
    }

    const userFolderId = await getUserFolder(username, drive, parentFolderId);

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
    const credentials = getGoogleCredentials();
    
    const auth = new google.auth.GoogleAuth({
      credentials,
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