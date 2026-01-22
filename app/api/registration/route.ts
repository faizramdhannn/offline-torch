import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('registration_request');
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch registration requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, username, password } = await request.json();

    const hashedPassword = await bcrypt.hash(password, 10);

    const id = Date.now().toString();
    const requestAt = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newRequest = [
      id,
      name,
      username,
      hashedPassword,
      'pending',
      requestAt
    ];

    await appendSheetData('registration_request', [newRequest]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create registration request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, permissions } = await request.json();

    if (status === 'approved') {
      const requests = await getSheetData('registration_request');
      const requestData = requests.find((r: any) => r.id === id);

      if (!requestData) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      const newUser = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        permissions.dashboard ? 'TRUE' : 'FALSE',
        permissions.order_report ? 'TRUE' : 'FALSE',
        permissions.stock ? 'TRUE' : 'FALSE',
        permissions.registration_request ? 'TRUE' : 'FALSE',
        permissions.user_setting ? 'TRUE' : 'FALSE',
        permissions.petty_cash ? 'TRUE' : 'FALSE',
        permissions.petty_cash_add ? 'TRUE' : 'FALSE',
        permissions.petty_cash_export ? 'TRUE' : 'FALSE',
        permissions.order_report_import ? 'TRUE' : 'FALSE',
        permissions.order_report_export ? 'TRUE' : 'FALSE',
        new Date().toISOString()
      ];

      await appendSheetData('users', [newUser]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update registration request' },
      { status: 500 }
    );
  }
}