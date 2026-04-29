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

// ── Extract teks dari gambar via Tesseract (untuk JPG/PNG) ───────────────
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

// ── Main: ambil teks lalu parse nomor resi ────────────────────────────────
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

// ── Parser: cari nomor resi dari teks ────────────────────────────────────
function parseTrackingNumber(text: string): string {
  const normalized = text.replace(/[^\S\n]+/g, ' ').trim();

  const patterns: RegExp[] = [
    // Lion Parcel: 99LP + 10-15 digit (contoh: 99LP1777381048226)
    /\b(99LP\d{10,15})\b/i,
    // SiCepat: 999 + 9-12 digit (contoh: 999514609439)
    /\b(999\d{9,12})\b/,
    // J&T Express: JP + 10-14 digit
    /\b(JP\d{10,14})\b/i,
    // AnterAja: AA + 10-14 digit
    /\b(AA\d{10,14})\b/i,
    // Ninja Express: NVSID + 8-14 digit
    /\b(NVSID\d{8,14})\b/i,
    // JNE: 2-6 huruf kapital + 10-16 digit
    /\b([A-Z]{2,6}\d{10,16})\b/,
    // Fallback: angka panjang 12-20 digit
    /\b(\d{12,20})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Column order (14 columns):
// 0  id           1  date          2  assigned_to   3  expedition
// 4  sender       5  receiver      6  weight        7  reason
// 8  link_tracking  9  request_by  10 update_by    11 created_at
// 12 update_at    13 tracking_number
// ─────────────────────────────────────────────────────────────────────────────

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
    const { date, assigned_to, expedition, sender, receiver, weight, reason, request_by } = body;

    if (!date || !assigned_to || !expedition || !sender || !receiver || !weight || !reason || !request_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = Date.now().toString();
    const now = new Date().toISOString();

    const newRow = [
      id, date, assigned_to, expedition, sender, receiver,
      weight, reason, '', request_by, request_by, now, now, '',
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
      link_tracking = formData.get('link_tracking') as string | undefined;
      newFile = formData.get('file') as File | null;

      if (newFile && newFile.size > 0) {
        fileBuffer = await newFile.arrayBuffer();
      }
    } else {
      const body = await request.json();
      ({ id, update_by, date, assigned_to, expedition, sender, receiver, weight, reason, link_tracking } = body);
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

      // 1. Upload ke Google Drive
      const fileName = `tracking_${id}_${Date.now()}`;
      finalLinkTracking = await uploadToGoogleDrive(buf, fileName, newFile.type, 'request_tracking');

      // 2. Extract nomor resi
      const extracted = await extractTrackingNumber(buf, newFile.type);
      if (extracted) {
        trackingNumber = extracted;
        console.log(`[OCR] Success for ${id}: ${trackingNumber}`);
      } else {
        console.warn(`[OCR] Could not extract tracking number for ${id}`);
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
      finalLinkTracking,
      existing.request_by,
      update_by,
      existing.created_at,
      now,
      trackingNumber,
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
    await updateSheetRow('request_tracking', rowIndex, Array(14).fill(''));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting request tracking:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}