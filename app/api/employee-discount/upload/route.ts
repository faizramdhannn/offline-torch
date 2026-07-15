import { NextRequest, NextResponse } from 'next/server';
import { uploadToGoogleDrive } from '@/lib/drive';

// Upload foto (kamera atau file) untuk Employee Discount ke Shared Drive
// (DRIVE_EMPLOYEE_DISCOUNT_FOLDER_ID), 1 subfolder per user_name. Dipanggil
// terpisah dari CRUD utama — frontend upload dulu untuk dapat link_drive,
// baru kirim link itu sebagai field biasa lewat POST/PUT /api/employee-discount.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userName = (formData.get('userName') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!userName) {
      return NextResponse.json({ error: 'Missing userName' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `ED-${Date.now()}`;

    const url = await uploadToGoogleDrive(buffer, fileName, file.type || 'image/jpeg', `employee_discount:${userName}`);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('POST employee-discount/upload error:', error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
