import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const SHEET_NAME = 'system_config';

// Save or retrieve manual cookie
export async function POST(request: NextRequest) {
  try {
    const { cookie, username } = await request.json();

    if (!cookie) {
      return NextResponse.json(
        { error: 'Cookie is required' },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get current data
    const data = await getSheetData(SHEET_NAME);
    const cookieIndex = data.findIndex((row: any) => row.config_key === 'javelin_cookie');
    
    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (cookieIndex !== -1) {
      // Update existing entry
      const rowIndex = cookieIndex + 2; // +2 for header and 0-based index
      
      const updatedRow = [
        'javelin_cookie',
        cookie,
        username,
        now
      ];

      await updateSheetRow(SHEET_NAME, rowIndex, updatedRow);
    } else {
      // Create new entry
      const newRow = [
        'javelin_cookie',
        cookie,
        username,
        now
      ];

      await appendSheetData(SHEET_NAME, [newRow]);
    }

    return NextResponse.json({
      success: true,
      message: 'Javelin cookie saved successfully',
      lastUpdated: now,
    });
  } catch (error) {
    console.error('Error saving Javelin cookie:', error);
    return NextResponse.json(
      { error: 'Failed to save Javelin cookie' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData(SHEET_NAME);
    const cookieEntry = data.find((row: any) => row.config_key === 'javelin_cookie');
    
    if (cookieEntry) {
      return NextResponse.json({
        success: true,
        cookie: cookieEntry.config_value || '',
        lastUpdated: cookieEntry.updated_at || '',
        updatedBy: cookieEntry.updated_by || '',
      });
    } else {
      return NextResponse.json({
        success: true,
        cookie: '',
        lastUpdated: '',
        updatedBy: '',
      });
    }
  } catch (error) {
    console.error('Error fetching Javelin cookie:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Javelin cookie' },
      { status: 500 }
    );
  }
}