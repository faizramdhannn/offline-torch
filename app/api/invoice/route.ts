import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

// ── Helpers ────────────────────────────────────────────────────────────────────
function terbilang(n: number): string {
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas',
    'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];

  function toWords(num: number): string {
    if (num === 0) return '';
    if (num < 20) return satuan[num];
    if (num < 100) {
      const tens = Math.floor(num / 10);
      const ones = num % 10;
      const tensWord = tens === 2 ? 'Dua Puluh' : tens === 3 ? 'Tiga Puluh' : tens === 4 ? 'Empat Puluh' :
        tens === 5 ? 'Lima Puluh' : tens === 6 ? 'Enam Puluh' : tens === 7 ? 'Tujuh Puluh' :
        tens === 8 ? 'Delapan Puluh' : 'Sembilan Puluh';
      return ones === 0 ? tensWord : `${tensWord} ${satuan[ones]}`;
    }
    if (num < 200) return `Seratus${num % 100 === 0 ? '' : ' ' + toWords(num % 100)}`;
    if (num < 1000) return `${satuan[Math.floor(num / 100)]} Ratus${num % 100 === 0 ? '' : ' ' + toWords(num % 100)}`;
    if (num < 2000) return `Seribu${num % 1000 === 0 ? '' : ' ' + toWords(num % 1000)}`;
    if (num < 1000000) return `${toWords(Math.floor(num / 1000))} Ribu${num % 1000 === 0 ? '' : ' ' + toWords(num % 1000)}`;
    if (num < 1000000000) return `${toWords(Math.floor(num / 1000000))} Juta${num % 1000000 === 0 ? '' : ' ' + toWords(num % 1000000)}`;
    return `${toWords(Math.floor(num / 1000000000))} Miliar${num % 1000000000 === 0 ? '' : ' ' + toWords(num % 1000000000)}`;
  }

  if (n === 0) return 'Nol Rupiah';
  return toWords(n).trim() + ' Rupiah';
}

// GET – list all invoices or a single invoice with its items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const invoices = await getSheetData('invoices');
    const filtered = invoices.filter((r: any) => r.invoice_id);

    if (id) {
      const invoice = filtered.find((r: any) => r.invoice_id === id);
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const allItems = await getSheetData('invoice_items');
      const items = allItems.filter((r: any) => r.invoice_id === id);
      return NextResponse.json({ invoice, items });
    }

    // Sort newest first
    const sorted = filtered.sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

// POST – create new invoice + items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_address,
      invoice_date,
      items,
      tax_percent = 0,   // 11 jika PPN aktif, 0 jika tidak
      created_by,
      doc_type = 'invoice',
      manual_invoice_number = null,
      signature_store = '',
      signature_pic = '',
    } = body;

    if (!customer_name || !invoice_date || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Tentukan nomor dokumen ──────────────────────────────────────────────
    let invoiceNumber: string;

    if (doc_type === 'quotation') {
      invoiceNumber = '';
    } else {
      if (!manual_invoice_number || !manual_invoice_number.trim()) {
        return NextResponse.json({ error: 'Nomor invoice wajib diisi' }, { status: 400 });
      }
      invoiceNumber = manual_invoice_number.trim();
    }

    const invoice_id = Date.now().toString();
    const now = new Date().toISOString();

    // ── Kalkulasi ──────────────────────────────────────────────────────────
    // grand_total = subtotal + tax_amount (jika PPN aktif)
    // grand_total = subtotal              (jika PPN tidak aktif)
    const subtotal = items.reduce((s: number, it: any) => s + (Number(it.qty) * Number(it.unit_price)), 0);
    const tax_amount = Number(tax_percent) > 0
      ? Math.round(subtotal * (Number(tax_percent) / 100))
      : 0;
    const grand_total = subtotal + tax_amount;
    const amount_in_words = terbilang(grand_total);

    // Kolom: invoice_id, invoice_number, invoice_date, customer_name, customer_address,
    //        subtotal, tax_percent, tax_amount, grand_total, amount_in_words,
    //        status, created_at, doc_type, signature_store, signature_pic, created_by
    const invoiceRow = [
      invoice_id,
      invoiceNumber,
      invoice_date,
      customer_name,
      customer_address || '',
      subtotal,
      tax_percent,
      tax_amount,
      grand_total,
      amount_in_words,
      'draft',
      now,
      doc_type,
      signature_store || '',
      signature_pic || '',
      created_by || '',
    ];
    await appendSheetData('invoices', [invoiceRow]);

    // Save invoice items
    const itemRows = items.map((it: any) => {
      const total = Number(it.qty) * Number(it.unit_price);
      return [
        `${invoice_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        invoice_id,
        it.product_name,
        it.variant || '',
        it.qty,
        it.unit_price,
        total,
        total,
      ];
    });
    await appendSheetData('invoice_items', itemRows);

    return NextResponse.json({ success: true, invoice_id, invoice_number: invoiceNumber });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

// PUT – update invoice status or fields
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      invoice_id, status, customer_name, customer_address, invoice_date,
      items, tax_percent, updated_by,
    } = body;

    const invoices = await getSheetData('invoices');
    const idx = invoices.findIndex((r: any) => r.invoice_id === invoice_id);
    if (idx === -1) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const existing = invoices[idx];
    const now = new Date().toISOString();

    let subtotal = Number(existing.subtotal);
    let tax_amount = Number(existing.tax_amount);
    let grand_total = Number(existing.grand_total);
    let amount_in_words = existing.amount_in_words;
    const effectiveTax = tax_percent !== undefined ? Number(tax_percent) : Number(existing.tax_percent);

    // Recalculate if items provided
    if (items && items.length > 0) {
      subtotal = items.reduce((s: number, it: any) => s + Number(it.qty) * Number(it.unit_price), 0);
      tax_amount = effectiveTax > 0 ? Math.round(subtotal * (effectiveTax / 100)) : 0;
      grand_total = subtotal + tax_amount; // grand_total = subtotal + tax_amount
      amount_in_words = terbilang(grand_total);

      const allItems = await getSheetData('invoice_items');
      const oldItemIndexes = allItems
        .map((r: any, i: number) => ({ r, i }))
        .filter(({ r }: any) => r.invoice_id === invoice_id);

      for (const { i } of oldItemIndexes) {
        await updateSheetRow('invoice_items', i + 2, Array(8).fill(''));
      }

      const newItemRows = items.map((it: any) => {
        const total = Number(it.qty) * Number(it.unit_price);
        return [
          `${invoice_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          invoice_id,
          it.product_name,
          it.variant || '',
          it.qty,
          it.unit_price,
          total,
          total,
        ];
      });
      await appendSheetData('invoice_items', newItemRows);
    }

    const updatedRow = [
      invoice_id,
      existing.invoice_number,
      invoice_date ?? existing.invoice_date,
      customer_name ?? existing.customer_name,
      customer_address ?? existing.customer_address,
      subtotal,
      effectiveTax,
      tax_amount,
      grand_total,
      amount_in_words,
      status ?? existing.status,
      existing.created_at,
      existing.doc_type || 'invoice',
      existing.signature_store || '',
      existing.signature_pic || '',
      existing.created_by || '',
    ];

    await updateSheetRow('invoices', idx + 2, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

// DELETE – soft delete (set status to deleted)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const invoices = await getSheetData('invoices');
    const idx = invoices.findIndex((r: any) => r.invoice_id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const e = invoices[idx];
    const updatedRow = [
      e.invoice_id, e.invoice_number, e.invoice_date, e.customer_name,
      e.customer_address, e.subtotal, e.tax_percent, e.tax_amount,
      e.grand_total, e.amount_in_words, 'deleted', e.created_at,
      e.doc_type || 'invoice',
      e.signature_store || '',
      e.signature_pic || '',
      e.created_by || '',
    ];
    await updateSheetRow('invoices', idx + 2, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}