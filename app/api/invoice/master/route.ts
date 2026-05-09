import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

// GET – fetch master invoice settings
export async function GET() {
  try {
    const data = await getSheetData('master_invoice');
    const master = data[0] || null;
    return NextResponse.json(master);
  } catch (error) {
    console.error('Error fetching master invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch master invoice' }, { status: 500 });
  }
}

// POST – create or update master invoice settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      header_image_url, company_name, company_address, company_phone,
      company_email, signature_image_url, default_use_signature,
      default_use_ppn, ppn_percentage, invoice_prefix, next_invoice_number,
      updated_by,
    } = body;

    const now = new Date().toISOString();
    const existing = await getSheetData('master_invoice');

    if (existing.length === 0) {
      // Create new
      const id = Date.now().toString();
      const row = [
        id, header_image_url || '', company_name || '', company_address || '',
        company_phone || '', company_email || '', signature_image_url || '',
        default_use_signature ? 'TRUE' : 'FALSE',
        default_use_ppn ? 'TRUE' : 'FALSE',
        ppn_percentage || 11, invoice_prefix || 'INV',
        next_invoice_number || 1, updated_by || '', now,
      ];
      await appendSheetData('master_invoice', [row]);
      return NextResponse.json({ success: true, id });
    } else {
      // Update existing
      const m = existing[0];
      const row = [
        m.id,
        header_image_url ?? m.header_image_url,
        company_name ?? m.company_name,
        company_address ?? m.company_address,
        company_phone ?? m.company_phone,
        company_email ?? m.company_email,
        signature_image_url ?? m.signature_image_url,
        (default_use_signature !== undefined ? default_use_signature : m.default_use_signature === 'TRUE') ? 'TRUE' : 'FALSE',
        (default_use_ppn !== undefined ? default_use_ppn : m.default_use_ppn === 'TRUE') ? 'TRUE' : 'FALSE',
        ppn_percentage ?? m.ppn_percentage,
        invoice_prefix ?? m.invoice_prefix,
        next_invoice_number ?? m.next_invoice_number,
        updated_by || m.updated_by,
        now,
      ];
      await updateSheetRow('master_invoice', 2, row);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Error saving master invoice:', error);
    return NextResponse.json({ error: 'Failed to save master invoice' }, { status: 500 });
  }
}