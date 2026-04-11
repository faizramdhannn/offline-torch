import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const isTrackingEdit = searchParams.get('isTrackingEdit') === 'true';

    const data = await getSheetData('request_tracking');
    const filtered = data.filter((row: any) => row.id);
    const sorted = filtered.sort((a: any, b: any) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    if (isTrackingEdit) {
      return NextResponse.json(sorted);
    }

    // request_tracking can only see their own data
    const userFiltered = sorted.filter((row: any) => row.request_by === username);
    return NextResponse.json(userFiltered);
  } catch (error) {
    console.error('Error fetching request tracking:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date, assigned_to, expedition, sender, receiver, weight, reason, request_by,
    } = body;

    if (!date || !assigned_to || !expedition || !sender || !receiver || !weight || !reason || !request_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Columns: id, date, assigned_to, expedition, sender, receiver, weight, reason, link_tracking, request_by, update_by, created_at, update_at
    const newRow = [
      id,
      date,
      assigned_to,
      expedition,
      sender,
      receiver,
      weight,
      reason,
      '',           // link_tracking — empty on creation
      request_by,
      request_by,   // update_by same as request_by initially
      now,
      now,
    ];

    await appendSheetData('request_tracking', [newRow]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating request tracking:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let id: string, update_by: string;
    let date: string | undefined, assigned_to: string | undefined;
    let expedition: string | undefined, sender: string | undefined;
    let receiver: string | undefined, weight: string | undefined;
    let reason: string | undefined, link_tracking: string | undefined;
    let newFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = formData.get('id') as string;
      update_by = formData.get('update_by') as string;
      date = formData.get('date') as string | undefined;
      assigned_to = formData.get('assigned_to') as string | undefined;
      expedition = formData.get('expedition') as string | undefined;
      sender = formData.get('sender') as string | undefined;
      receiver = formData.get('receiver') as string | undefined;
      weight = formData.get('weight') as string | undefined;
      reason = formData.get('reason') as string | undefined;
      link_tracking = formData.get('link_tracking') as string | undefined;
      newFile = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      id = body.id;
      update_by = body.update_by;
      date = body.date;
      assigned_to = body.assigned_to;
      expedition = body.expedition;
      sender = body.sender;
      receiver = body.receiver;
      weight = body.weight;
      reason = body.reason;
      link_tracking = body.link_tracking;
    }

    const data = await getSheetData('request_tracking');
    const idx = data.findIndex((row: any) => row.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const existing = data[idx];
    const rowIndex = idx + 2;
    const now = new Date().toISOString();

    // Upload file to Drive if provided
    let finalLinkTracking = link_tracking ?? existing.link_tracking ?? '';
    if (newFile && newFile.size > 0) {
      const fileBuffer = await newFile.arrayBuffer();
      const fileName = `tracking_${id}_${Date.now()}`;
      finalLinkTracking = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        newFile.type,
        'request_tracking'
      );
    }

    const updatedRow = [
      id,
      date ?? existing.date,
      assigned_to ?? existing.assigned_to,
      expedition ?? existing.expedition,
      sender ?? existing.sender,
      receiver ?? existing.receiver,
      weight ?? existing.weight,
      reason ?? existing.reason,
      finalLinkTracking,
      existing.request_by,
      update_by,
      existing.created_at,
      now,
    ];

    await updateSheetRow('request_tracking', rowIndex, updatedRow);

    return NextResponse.json({ success: true, link_tracking: finalLinkTracking });
  } catch (error) {
    console.error('Error updating request tracking:', error);
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

    const data = await getSheetData('request_tracking');
    const idx = data.findIndex((row: any) => row.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const rowIndex = idx + 2;
    const emptyRow = Array(13).fill('');
    await updateSheetRow('request_tracking', rowIndex, emptyRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting request tracking:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}