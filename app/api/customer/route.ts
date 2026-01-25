import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

const STORE_SHEETS = [
  'Torch Cirebon',
  'Torch Jogja',
  'Torch Karawaci',
  'Torch Karawang',
  'Torch Lampung',
  'Torch Lembong',
  'Torch Makassar',
  'Torch Malang',
  'Torch Margonda',
  'Torch Medan',
  'Torch Pekalongan',
  'Torch Purwokerto',
  'Torch Surabaya',
  'Torch Tambun',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Check if username matches a store sheet
    const matchingSheet = STORE_SHEETS.find(
      sheet => sheet.toLowerCase().replace(/\s+/g, '') === username.toLowerCase().replace(/\s+/g, '')
    );

    if (matchingSheet) {
      // User owns this sheet, return only their data
      const data = await getSheetData(matchingSheet);
      return NextResponse.json({
        isOwner: true,
        storeName: matchingSheet,
        data: data,
      });
    } else {
      // User doesn't own a sheet, return all data
      const allData: any[] = [];
      
      for (const sheet of STORE_SHEETS) {
        try {
          const sheetData = await getSheetData(sheet);
          const dataWithStore = sheetData.map((item: any) => ({
            ...item,
            location_store: sheet,
          }));
          allData.push(...dataWithStore);
        } catch (error) {
          console.error(`Error fetching ${sheet}:`, error);
        }
      }
      
      return NextResponse.json({
        isOwner: false,
        data: allData,
      });
    }
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const storeName = formData.get('storeName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const username = formData.get('username') as string;
    const followupText = formData.get('followupText') as string;
    const file = formData.get('file') as File | null;
    const rowIndex = parseInt(formData.get('rowIndex') as string);

    if (!storeName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Store name and phone number are required' },
        { status: 400 }
      );
    }

    // Get current data
    const data = await getSheetData(storeName);
    const rowData = data[rowIndex - 2]; // -2 because rowIndex is 1-based and includes header
    
    if (!rowData) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }

    let linkUrl = rowData.link_url || '';

    // Upload file if present
    if (file) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `${dateStr}_${storeName}_${phoneNumber}_followup`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        'customer_followup'
      );
    }

    // Update the row
    const updateAt = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedRow = [
      rowData.phone_number,
      rowData.customer_name,
      rowData.location_store,
      rowData.total_order,
      rowData.total_value,
      rowData.average_value,
      followupText || rowData.followup || '', // Use provided followup text or keep existing
      linkUrl,
      username,
      updateAt,
    ];

    await updateSheetRow(storeName, rowIndex, updatedRow);

    return NextResponse.json({ success: true, link_url: linkUrl });
  } catch (error) {
    console.error('Error updating customer data:', error);
    return NextResponse.json(
      { error: 'Failed to update customer data' },
      { status: 500 }
    );
  }
}