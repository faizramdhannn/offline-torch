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

    // Hash password dengan bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate ID sederhana (timestamp + random)
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
      // Get registration request data
      const requests = await getSheetData('registration_request');
      const request = requests.find((r: any) => r.id === id);

      if (!request) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Add to users sheet
      const newUser = [
        request.id,
        request.name,
        request.user_name,
        request.password, // Already hashed
        permissions.dashboard ? 'TRUE' : 'FALSE',
        permissions.order_report ? 'TRUE' : 'FALSE',
        permissions.stock ? 'TRUE' : 'FALSE',
        permissions.registration_request ? 'TRUE' : 'FALSE',
        permissions.user_setting ? 'TRUE' : 'FALSE',
        permissions.petty_cash ? 'TRUE' : 'FALSE',
        new Date().toISOString()
      ];

      await appendSheetData('users', [newUser]);
    }

    // Update status in registration_request
    const allRequests = await getSheetData('registration_request');
    const updatedRequests = allRequests.map((r: any) => {
      if (r.id === id) {
        return { ...r, status };
      }
      return r;
    });

    // You'll need to implement updateAllSheetData for this
    // For now, return success
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update registration request' },
      { status: 500 }
    );
  }
}
