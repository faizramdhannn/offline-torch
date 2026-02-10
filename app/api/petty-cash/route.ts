import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const isAdmin = searchParams.get('isAdmin') === 'true';
    
    const data = await getSheetData('petty_cash');
    
    // Sort by update_at (newest first)
    const sortedData = data.sort((a: any, b: any) => {
      const dateA = new Date(a.update_at || a.created_at).getTime();
      const dateB = new Date(b.update_at || b.created_at).getTime();
      return dateB - dateA;
    });
    
    // Filter based on user permissions
    if (!isAdmin && username) {
      const filteredData = sortedData.filter((item: any) => item.store === username);
      return NextResponse.json(filteredData);
    }
    
    return NextResponse.json(sortedData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch petty cash data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const value = formData.get('value') as string;
    const store = formData.get('store') as string;
    const ket = formData.get('ket') as string || '';
    const transfer = formData.get('transfer') === 'true';
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string;

    // Generate ID (short numeric ID)
    const id = Date.now().toString().slice(-8);
    
    // Format date
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    let linkUrl = '';
    
    // Upload file to Google Drive if present
    if (file) {
      const fileName = `${date.replace(/ /g, '_')}_${category}_${store}_${id}`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        store
      );
    }

    const createdAt = now.toISOString();
    
    // Extract raw number from value (remove Rp, dots, commas, spaces)
    const rawValue = value.replace(/[^0-9]/g, '');
    
    const newEntry = [
      id,
      date,
      description,
      category,
      rawValue, // Save as raw number only (e.g., "100000" instead of "Rp 100.000")
      store,
      ket,
      transfer ? 'TRUE' : 'FALSE',
      linkUrl,
      username,
      createdAt,
      createdAt
    ];

    await appendSheetData('petty_cash', [newEntry]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to create petty cash entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const value = formData.get('value') as string;
    const store = formData.get('store') as string; // Use the store from form (original store)
    const ket = formData.get('ket') as string || '';
    const transfer = formData.get('transfer') === 'true';
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string; // This is update_by

    // Get all petty cash data to find the row index
    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const entry = pettyCashData[entryIndex];
    const rowIndex = entryIndex + 2; // +2 for header and 0-based index
    
    let linkUrl = entry.link_url || '';
    
    // Upload new file if present
    if (file) {
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const date = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
      const fileName = `${date.replace(/ /g, '_')}_${category}_${store}_${id}`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        store
      );
    }

    const now = new Date().toISOString();
    
    // Extract raw number from value
    const rawValue = value.replace(/[^0-9]/g, '');
    
    const updatedEntry = [
      id,
      entry.date, // Keep original date
      description,
      category,
      rawValue, // Save as raw number only
      store, // Keep original store (not username)
      ket,
      transfer ? 'TRUE' : 'FALSE',
      linkUrl,
      username, // Update by (this changes)
      entry.created_at, // Keep original created_at
      now // Update the update_at
    ];

    await updateSheetRow('petty_cash', rowIndex, updatedEntry);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to update petty cash entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Get all petty cash data
    const pettyCashData = await getSheetData('petty_cash');
    const entryIndex = pettyCashData.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const rowIndex = entryIndex + 2;
    
    // Mark as deleted by updating status or removing
    // For now, we'll actually delete the row by clearing it
    const entry = pettyCashData[entryIndex];
    const updatedRow = Array(12).fill(''); // Clear all columns
    
    await updateSheetRow('petty_cash', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting petty cash entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete petty cash entry' },
      { status: 500 }
    );
  }
}