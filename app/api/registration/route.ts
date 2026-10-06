import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { createUser } from '@/lib/users';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('registration_request');
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch registration requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, username, password } = await request.json();
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    const requestAt = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const newRequest = [id, name, username, hashedPassword, 'pending', requestAt];
    await appendSheetData('registration_request', [newRequest]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create registration request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, permissions } = await request.json();

    const requests = await getSheetData('registration_request', { skipCache: true });
    const requestIndex = requests.findIndex((r: any) => r.id === id);

    if (requestIndex === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const requestData = requests[requestIndex];
    const rowIndex = requestIndex + 2;

    if (status === 'approved') {
      await createUser(
        { id: requestData.id, name: requestData.name, user_name: requestData.user_name, password: requestData.password },
        permissions || {}
      );

      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'approved',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);

    } else if (status === 'rejected') {
      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'rejected',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update registration request' }, { status: 500 });
  }
}