import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

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

    const data = await getSheetData('canvasing_store');
    
    // Check if user owns a store (username matches store column)
    const userStore = data.find((item: any) => 
      item.store.toLowerCase() === username.toLowerCase()
    );
    
    if (userStore) {
      // User owns a store - show only their data
      const filteredData = data.filter((item: any) => 
        item.store.toLowerCase() === username.toLowerCase()
      );
      return NextResponse.json({
        isOwner: true,
        storeName: username,
        data: filteredData,
      });
    } else {
      // User doesn't own a store - show all data (admin view)
      return NextResponse.json({
        isOwner: false,
        data: data,
      });
    }
  } catch (error) {
    console.error('Error fetching canvasing data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch canvasing data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const store = formData.get('store') as string;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const sub_category = formData.get('sub_category') as string;
    const canvasser = formData.get('canvasser') as string;
    const visit_at = formData.get('visit_at') as string;
    const result_status = formData.get('result_status') as string;
    const notes = formData.get('notes') as string;
    const username = formData.get('username') as string;
    
    // Handle multiple files
    const files: File[] = [];
    let fileIndex = 0;
    while (formData.has(`file_${fileIndex}`)) {
      const file = formData.get(`file_${fileIndex}`) as File;
      if (file) files.push(file);
      fileIndex++;
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    // Upload files to Google Drive
    let imageUrls: string[] = [];
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${id}_${i + 1}_${name.replace(/\s+/g, '_')}`;
        const fileBuffer = await file.arrayBuffer();
        const url = await uploadToGoogleDrive(
          Buffer.from(fileBuffer),
          fileName,
          file.type,
          'canvasing'
        );
        imageUrls.push(url);
      }
    }
    
    // Join URLs with semicolon separator
    const image_url = imageUrls.join(';');

    const newEntry = [
      id,
      store,
      name,
      category,
      sub_category,
      canvasser,
      visit_at,
      result_status,
      notes,
      image_url,
      now,
      now,
    ];

    await appendSheetData('canvasing_store', [newEntry]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating canvasing entry:', error);
    return NextResponse.json(
      { error: 'Failed to create canvasing entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const sub_category = formData.get('sub_category') as string;
    const canvasser = formData.get('canvasser') as string;
    const visit_at = formData.get('visit_at') as string;
    const result_status = formData.get('result_status') as string;
    const notes = formData.get('notes') as string;
    const keepExistingImages = formData.get('keepExistingImages') === 'true';
    
    // Handle multiple new files
    const files: File[] = [];
    let fileIndex = 0;
    while (formData.has(`file_${fileIndex}`)) {
      const file = formData.get(`file_${fileIndex}`) as File;
      if (file) files.push(file);
      fileIndex++;
    }

    // Get existing entry
    const entries = await getSheetData('canvasing_store');
    const entryIndex = entries.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const entry = entries[entryIndex];
    const rowIndex = entryIndex + 2;
    
    let image_url = entry.image_url || '';
    
    // Upload new files if present
    if (files.length > 0) {
      let imageUrls: string[] = [];
      
      // Keep existing images if requested
      if (keepExistingImages && image_url) {
        imageUrls = image_url.split(';').filter((url: string) => url.trim());
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${id}_${imageUrls.length + i + 1}_${name.replace(/\s+/g, '_')}`;
        const fileBuffer = await file.arrayBuffer();
        const url = await uploadToGoogleDrive(
          Buffer.from(fileBuffer),
          fileName,
          file.type,
          'canvasing'
        );
        imageUrls.push(url);
      }
      
      image_url = imageUrls.join(';');
    }

    const now = new Date().toISOString();
    
    const updatedEntry = [
      id,
      entry.store, // Keep original store
      name,
      category,
      sub_category,
      canvasser,
      visit_at,
      result_status,
      notes,
      image_url,
      entry.created_at, // Keep original created_at
      now, // Update update_at
    ];

    await updateSheetRow('canvasing_store', rowIndex, updatedEntry);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating canvasing entry:', error);
    return NextResponse.json(
      { error: 'Failed to update canvasing entry' },
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

    // Get all entries
    const entries = await getSheetData('canvasing_store');
    const entryIndex = entries.findIndex((item: any) => item.id === id);
    
    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const rowIndex = entryIndex + 2;
    
    // Clear the row
    const updatedRow = Array(12).fill('');
    
    await updateSheetRow('canvasing_store', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting canvasing entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete canvasing entry' },
      { status: 500 }
    );
  }
}