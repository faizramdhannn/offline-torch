import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('request_store');
    const filtered = data.filter((row: any) => row.id);
    const sorted = filtered.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching request store:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, requester, assigned_to, reason_request, notes, created_by } = await request.json();

    if (!date || !requester || !assigned_to || !reason_request || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    const newRow = [
      id,
      date,
      requester,
      assigned_to,
      reason_request,
      notes || '',
      'Pending',
      created_by,
      created_by,
      now,
      now,
    ];

    await appendSheetData('request_store', [newRow]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, date, requester, assigned_to, reason_request, notes, status, update_by } = body;

    const data = await getSheetData('request_store');
    const idx = data.findIndex((row: any) => row.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const existing = data[idx];
    const rowIndex = idx + 2;
    const now = new Date().toISOString();

    const updatedRow = [
      id,
      date ?? existing.date,
      requester ?? existing.requester,
      assigned_to ?? existing.assigned_to,
      reason_request ?? existing.reason_request,
      notes ?? existing.notes,
      status ?? existing.status,
      existing.created_by,
      update_by,
      existing.created_at,
      now,
    ];

    await updateSheetRow('request_store', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating request:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const data = await getSheetData('request_store');
    const idx = data.findIndex((row: any) => row.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const rowIndex = idx + 2;
    const emptyRow = Array(11).fill('');
    await updateSheetRow('request_store', rowIndex, emptyRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}