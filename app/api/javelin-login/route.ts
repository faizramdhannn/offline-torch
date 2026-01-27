import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const SHEET_NAME = 'system_config';

// Get Javelin configuration status
export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData(SHEET_NAME);
    
    const cookieEntry = data.find((row: any) => row.config_key === 'javelin_cookie');
    const credentialsEntry = data.find((row: any) => row.config_key === 'javelin_credentials');
    
    let credentials = { username: '', password: '' };
    if (credentialsEntry && credentialsEntry.config_value) {
      try {
        credentials = JSON.parse(credentialsEntry.config_value);
      } catch (e) {
        console.error('Failed to parse credentials:', e);
      }
    }
    
    return NextResponse.json({
      success: true,
      hasCookies: !!cookieEntry?.config_value,
      hasCredentials: !!(credentials.username && credentials.password),
      username: credentials.username || '',
      lastCookieUpdate: cookieEntry?.updated_at || '',
      lastCredentialsUpdate: credentialsEntry?.updated_at || '',
    });
  } catch (error) {
    console.error('Failed to get Javelin status:', error);
    return NextResponse.json(
      { error: 'Failed to get Javelin status' },
      { status: 500 }
    );
  }
}

// Save credentials for future auto-refresh
export async function POST(request: NextRequest) {
  try {
    const { username, password, updatedBy } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (!updatedBy) {
      return NextResponse.json(
        { error: 'UpdatedBy is required' },
        { status: 400 }
      );
    }

    // Save credentials to Google Sheets
    const data = await getSheetData(SHEET_NAME);
    const credIndex = data.findIndex((row: any) => row.config_key === 'javelin_credentials');
    
    const credentials = JSON.stringify({ username, password });
    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (credIndex !== -1) {
      // Update existing
      const rowIndex = credIndex + 2;
      const updatedRow = ['javelin_credentials', credentials, updatedBy, now];
      await updateSheetRow(SHEET_NAME, rowIndex, updatedRow);
    } else {
      // Create new
      const newRow = ['javelin_credentials', credentials, updatedBy, now];
      await appendSheetData(SHEET_NAME, [newRow]);
    }

    return NextResponse.json({
      success: true,
      message: 'Javelin credentials saved successfully',
    });
  } catch (error) {
    console.error('Javelin credentials save error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save Javelin credentials',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}