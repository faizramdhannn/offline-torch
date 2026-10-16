import { NextRequest, NextResponse } from 'next/server';
import { actorName, sessionUser } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { displayItems } from '@/lib/invoiceTax';
import { availableActions, canEditDoc, transition } from '@/lib/invoiceFlow';
import {
  actorOf, createInvoice, getEvents, getVisibleInvoice, listInvoices, normalizeInput, numberTaken, updateInvoice, applyTransition,
} from '@/lib/invoices';

export const dynamic = 'force-dynamic';

// Invoice & Quotation (Neon). Alur: Draft → Need Approval → Approved (→ Void). Aturan akses di lib/invoiceFlow.ts:
//  - tanpa izin invoice_approval, user HANYA melihat dokumen buatannya sendiri (ditegakkan di query/server);
//  - edit hanya saat Draft; perpindahan status lewat POST /api/invoice/action.
// Akun Store/Merchant: toko penanda tangan DIKUNCI ke toko akunnya (nama akun, mis. "Torch Cirebon"); akun lain bebas memilih.
function lockSignatureStore(u: { role: string; name: string }, v: { use_signature: boolean; signature_store: string }) {
  if (u.role === 'store' || u.role === 'merchant') v.signature_store = v.use_signature ? u.name : '';
}

async function me(request: NextRequest) {
  const user = await sessionUser(request);
  return user ? { user, actor: actorOf(user) } : null;
}

// GET /api/invoice            → daftar (sesuai hak lihat)
// GET /api/invoice?id=<id>    → detail + item + riwayat + aksi yang tersedia
export async function GET(request: NextRequest) {
  try {
    const m = await me(request);
    if (!m) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const doc = await getVisibleInvoice(id, m.actor);
      if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
      const events = await getEvents(id);
      return NextResponse.json({ ...doc, items: displayItems(doc.invoice, doc.items), events, actions: availableActions(doc.invoice, m.actor), can_edit: canEditDoc(doc.invoice, m.actor) });
    }
    return NextResponse.json(await listInvoices(m.actor));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

// POST – buat Draft baru (milik user yang login)
export async function POST(request: NextRequest) {
  try {
    const m = await me(request);
    if (!m) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    const n = normalizeInput(await request.json().catch(() => ({})));
    if (!n.ok) return NextResponse.json({ error: n.error }, { status: 400 });
    lockSignatureStore(m.user, n.v);
    if (n.v.doc_type === 'invoice' && (await numberTaken(n.v.invoice_number))) {
      return NextResponse.json({ error: `Nomor ${n.v.invoice_number} sudah dipakai dokumen lain` }, { status: 409 });
    }
    const id = await createInvoice(n.v, actorName(request));
    audit(request, 'POST', `Draft ${n.v.doc_type} dibuat: ${n.v.customer_name}`, 'invoice', id);
    return NextResponse.json({ success: true, invoice_id: id, invoice_number: n.v.invoice_number });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

// PUT – ubah isi dokumen (tim toko: Draft miliknya; approver: semua status kecuali Void; Void: Super Admin)
export async function PUT(request: NextRequest) {
  try {
    const m = await me(request);
    if (!m) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const id = String(body.invoice_id || '');
    const doc = await getVisibleInvoice(id, m.actor);
    if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    if (!canEditDoc(doc.invoice, m.actor)) {
      return NextResponse.json({ error: 'Dokumen ini tidak bisa diubah (tim toko: hanya Draft miliknya; approver: semua kecuali Void; Void: Super Admin)' }, { status: 403 });
    }
    const n = normalizeInput(body);
    if (!n.ok) return NextResponse.json({ error: n.error }, { status: 400 });
    lockSignatureStore(m.user, n.v);
    if (n.v.doc_type === 'invoice' && (await numberTaken(n.v.invoice_number, id))) {
      return NextResponse.json({ error: `Nomor ${n.v.invoice_number} sudah dipakai dokumen lain` }, { status: 409 });
    }
    await updateInvoice(id, n.v, actorName(request), doc.invoice.status);
    audit(request, 'PUT', `Dokumen diubah: ${n.v.customer_name}`, 'invoice', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

// DELETE ?id= – hapus Draft (tersembunyi; dokumen yang sudah diajukan/approved tidak dihapus, gunakan Void)
export async function DELETE(request: NextRequest) {
  try {
    const m = await me(request);
    if (!m) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id') || '';
    const doc = await getVisibleInvoice(id, m.actor);
    if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    const t = transition(doc.invoice, 'delete', m.actor);
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 403 });
    await applyTransition(id, 'delete', doc.invoice.status, t.to, actorName(request), '');
    audit(request, 'DELETE', `Draft dihapus: ${doc.invoice.customer_name}`, 'invoice', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
