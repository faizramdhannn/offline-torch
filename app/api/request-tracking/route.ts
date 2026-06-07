import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(pdfBuffer));
    const combined = Array.isArray(text) ? text.join('\n') : text;
    console.log('[unpdf] Extracted text (preview):', combined.substring(0, 400));
    return combined;
  } catch (e) {
    console.error('[unpdf] extractTextFromPdf error:', e);
    return '';
  }
}

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const Tesseract = await import('tesseract.js');
    const { data: { text } } = await Tesseract.default.recognize(imageBuffer, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`[Tesseract] Progress: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });
    console.log('[Tesseract] Raw text (preview):', text.substring(0, 400));
    return text;
  } catch (e) {
    console.error('[Tesseract] extractTextFromImage error:', e);
    return '';
  }
}

async function extractTrackingNumber(fileBuffer: Buffer, mimeType: string): Promise<string> {
  let text = '';
  if (mimeType === 'application/pdf') {
    text = await extractTextFromPdf(fileBuffer);
  } else {
    text = await extractTextFromImage(fileBuffer);
  }
  if (!text) {
    console.warn('[OCR] No text extracted from file');
    return '';
  }
  const trackingNumber = parseTrackingNumber(text);
  console.log('[OCR] Extracted tracking number:', trackingNumber || '(not found)');
  return trackingNumber;
}

function parseTrackingNumber(text: string): string {
  const normalized = text.replace(/[^\S\n]+/g, ' ').trim();
  const patterns: RegExp[] = [
    /\b(99LP\d{10,15})\b/i,
    /\b(999\d{9,12})\b/,
    /\b(JP\d{10,14})\b/i,
    /\b(AA\d{10,14})\b/i,
    /\b(NVSID\d{8,14})\b/i,
    /\b([A-Z]{2,6}\d{10,16})\b/,
    /\b(\d{12,20})\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return '';
}

async function sendTelegramNotification(sender: string, trackingNumber: string): Promise<void> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
  const message = `Request pickup "${sender}" dengan no Resi "${trackingNumber}"`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
    });
    const result = await res.json();
    if (!result.ok) console.error('[Telegram] Failed to send:', result);
    else console.log('[Telegram] Message sent successfully');
  } catch (e) {
    console.error('[Telegram] Error sending notification:', e);
  }
}

// ─── Column order (16 columns) ────────────────────────────────────────────
// 0  id             1  date          2  assigned_to    3  expedition
// 4  sender         5  receiver      6  weight         7  reason
// 8  type_reason    9  sales_order   10 link_tracking  11 tracking_number
// 12 request_by    13 update_by     14 created_at     15 update_at
// ─────────────────────────────────────────────────────────────────────────

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

    if (isTrackingEdit) return NextResponse.json(sorted);

    // Tampilkan jika request_by === username ATAU sender === username (store name match)
    const userFiltered = sorted.filter(
      (row: any) => row.request_by === username || row.sender === username,
    );
    return NextResponse.json(userFiltered);
  } catch (error) {
    console.error('Error fetching request tracking:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, assigned_to, expedition, sender, receiver, weight, reason, type_reason, sales_order, request_by } = body;

    if (!date || !assigned_to || !expedition || !sender || !receiver || !weight || !reason || !type_reason || !request_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    const newRow = [
      id, date, assigned_to, expedition, sender, receiver,
      weight, reason, type_reason, sales_order ?? '',
      '', '', request_by, request_by, now, now,
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
    let reason: string | undefined, type_reason: string | undefined;
    let sales_order: string | undefined, link_tracking: string | undefined;
    let newFile: File | null = null;
    let fileBuffer: ArrayBuffer | null = null;

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
      type_reason = formData.get('type_reason') as string | undefined;
      sales_order = formData.get('sales_order') as string | undefined;
      link_tracking = formData.get('link_tracking') as string | undefined;
      newFile = formData.get('file') as File | null;
      if (newFile && newFile.size > 0) {
        fileBuffer = await newFile.arrayBuffer();
      }
    } else {
      const body = await request.json();
      ({ id, update_by, date, assigned_to, expedition, sender, receiver, weight, reason, type_reason, sales_order, link_tracking } = body);
    }

    const data = await getSheetData('request_tracking');
    const idx = data.findIndex((row: any) => row.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const existing = data[idx];
    const rowIndex = idx + 2;
    const now = new Date().toISOString();

    let finalLinkTracking = link_tracking ?? existing.link_tracking ?? '';
    let trackingNumber: string = existing.tracking_number ?? '';

    if (newFile && newFile.size > 0 && fileBuffer) {
      const buf = Buffer.from(fileBuffer);
      const fileName = `tracking_${id}_${Date.now()}`;
      finalLinkTracking = await uploadToGoogleDrive(buf, fileName, newFile.type, 'request_tracking');

      const extracted = await extractTrackingNumber(buf, newFile.type);
      if (extracted) {
        trackingNumber = extracted;
        console.log(`[OCR] Success for ${id}: ${trackingNumber}`);
      } else {
        console.warn(`[OCR] Could not extract tracking number for ${id}`);
      }

      const currentExpedition = expedition ?? existing.expedition ?? '';
      if (currentExpedition.toLowerCase() === 'lion') {
        const senderName = sender ?? existing.sender ?? '';
        await sendTelegramNotification(senderName, trackingNumber || '-');
      }
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
      type_reason ?? existing.type_reason ?? '',
      sales_order ?? existing.sales_order ?? '',
      finalLinkTracking,
      trackingNumber,
      existing.request_by,
      update_by,
      existing.created_at,
      now,
    ];

    await updateSheetRow('request_tracking', rowIndex, updatedRow);

    return NextResponse.json({
      success: true,
      link_tracking: finalLinkTracking,
      tracking_number: trackingNumber,
    });
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
    await updateSheetRow('request_tracking', rowIndex, Array(16).fill(''));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting request tracking:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}