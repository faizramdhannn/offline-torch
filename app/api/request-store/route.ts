import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

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
    // Support multipart/form-data (with image) or JSON (without image)
    const contentType = request.headers.get('content-type') || '';

    let date: string, requester: string, assigned_to: string;
    let reason_request: string, notes: string, created_by: string;
    let sales_order = '', delivery_note = '', sales_invoice = '';
    let image_url = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      date = formData.get('date') as string;
      requester = formData.get('requester') as string;
      assigned_to = formData.get('assigned_to') as string;
      reason_request = formData.get('reason_request') as string;
      notes = (formData.get('notes') as string) || '';
      created_by = formData.get('created_by') as string;
      sales_order = (formData.get('sales_order') as string) || '';
      delivery_note = (formData.get('delivery_note') as string) || '';
      sales_invoice = (formData.get('sales_invoice') as string) || '';

      const file = formData.get('image') as File | null;
      if (file && file.size > 0) {
        const fileBuffer = await file.arrayBuffer();
        const fileName = `request_${Date.now()}`;
        image_url = await uploadToGoogleDrive(
          Buffer.from(fileBuffer),
          fileName,
          file.type,
          'request_store'
        );
      }
    } else {
      const body = await request.json();
      ({ date, requester, assigned_to, reason_request, created_by } = body);
      notes = body.notes || '';
      sales_order = body.sales_order || '';
      delivery_note = body.delivery_note || '';
      sales_invoice = body.sales_invoice || '';
      image_url = body.image_url || '';
    }

    if (!date || !requester || !assigned_to || !reason_request || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    // 15 columns: id, date, requester, assigned_to, reason_request, notes,
    //             status, created_by, update_by, created_at, update_at,
    //             sales_order, delivery_note, sales_invoice, image_url
    const newRow = [
      id,
      date,
      requester,
      assigned_to,
      reason_request,
      notes,
      'Pending',
      created_by,
      created_by,
      now,
      now,
      sales_order,
      delivery_note,
      sales_invoice,
      image_url,
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
    // Support multipart/form-data (with image) or JSON
    const contentType = request.headers.get('content-type') || '';

    let id: string, update_by: string;
    let date: string | undefined, requester: string | undefined;
    let assigned_to: string | undefined, reason_request: string | undefined;
    let notes: string | undefined, status: string | undefined;
    let sales_order: string | undefined, delivery_note_val: string | undefined;
    let sales_invoice: string | undefined, image_url: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = formData.get('id') as string;
      update_by = formData.get('update_by') as string;
      date = formData.get('date') as string | undefined;
      requester = formData.get('requester') as string | undefined;
      assigned_to = formData.get('assigned_to') as string | undefined;
      reason_request = formData.get('reason_request') as string | undefined;
      notes = formData.get('notes') as string | undefined;
      status = formData.get('status') as string | undefined;
      sales_order = formData.get('sales_order') as string | undefined;
      delivery_note_val = formData.get('delivery_note') as string | undefined;
      sales_invoice = formData.get('sales_invoice') as string | undefined;
      image_url = formData.get('image_url') as string | undefined;

      const file = formData.get('image') as File | null;
      if (file && file.size > 0) {
        const fileBuffer = await file.arrayBuffer();
        const fileName = `request_${id}_${Date.now()}`;
        image_url = await uploadToGoogleDrive(
          Buffer.from(fileBuffer),
          fileName,
          file.type,
          'request_store'
        );
      }
    } else {
      const body = await request.json();
      id = body.id;
      update_by = body.update_by;
      date = body.date;
      requester = body.requester;
      assigned_to = body.assigned_to;
      reason_request = body.reason_request;
      notes = body.notes;
      status = body.status;
      sales_order = body.sales_order;
      delivery_note_val = body.delivery_note;
      sales_invoice = body.sales_invoice;
      image_url = body.image_url;
    }

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
      sales_order ?? existing.sales_order ?? '',
      delivery_note_val ?? existing.delivery_note ?? '',
      sales_invoice ?? existing.sales_invoice ?? '',
      image_url ?? existing.image_url ?? '',
    ];

    await updateSheetRow('request_store', rowIndex, updatedRow);

    return NextResponse.json({ success: true, image_url: image_url ?? existing.image_url ?? '' });
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
    const emptyRow = Array(15).fill('');
    await updateSheetRow('request_store', rowIndex, emptyRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}