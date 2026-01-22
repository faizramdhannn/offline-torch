import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('petty_cash');
    return NextResponse.json(data);
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
        store // Pass username to create/use user folder
      );
    }

    const createdAt = now.toISOString();
    
    const newEntry = [
      id,
      date,
      description,
      category,
      value,
      store,
      ket,
      transfer ? 'TRUE' : 'FALSE',
      linkUrl,
      createdAt,
      createdAt // update_at same as created_at initially
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
