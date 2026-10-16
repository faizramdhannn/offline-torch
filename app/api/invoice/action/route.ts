import { NextRequest, NextResponse } from 'next/server';
import { actorName, sessionUser } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { notifyUser, notifyUsersWithPermission } from '@/lib/notifications';
import { transition, type InvoiceAction } from '@/lib/invoiceFlow';
import { actorOf, applyTransition, getVisibleInvoice } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

const ACTIONS: InvoiceAction[] = ['submit', 'recall', 'approve', 'reject', 'void', 'restore', 'delete'];

// POST { invoice_id, action, note? } — perpindahan status dokumen. Izin & kepemilikan diperiksa di sini (invoiceFlow),
// bukan di UI: tombol yang tidak boleh akan ditolak server walau dipanggil manual.
export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    const actor = actorOf(user);
    const b = await request.json().catch(() => ({}));
    const id = String(b.invoice_id || '');
    const action = String(b.action || '') as InvoiceAction;
    const note = String(b.note || '').trim().slice(0, 500);
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });

    const doc = await getVisibleInvoice(id, actor);
    if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    const inv = doc.invoice;
    const t = transition(inv, action, actor, note);
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 403 });

    // Syarat tambahan sebelum diajukan: dokumen lengkap (nomor untuk invoice, minimal satu item).
    if (action === 'submit') {
      if (inv.doc_type === 'invoice' && !inv.invoice_number) return NextResponse.json({ error: 'Nomor invoice wajib diisi sebelum diajukan' }, { status: 400 });
      if (!doc.items.length) return NextResponse.json({ error: 'Minimal satu item sebelum diajukan' }, { status: 400 });
    }

    const by = actorName(request);
    await applyTransition(id, action, inv.status, t.to, by, note);
    audit(request, 'PUT', `Dokumen ${inv.invoice_number || inv.customer_name}: ${action} (${inv.status} → ${t.to})${note ? ` — ${note}` : ''}`, 'invoice', id);

    // Notifikasi dalam aplikasi
    const label = inv.invoice_number || inv.customer_name;
    try {
      if (action === 'submit') {
        await notifyUsersWithPermission('invoice_approval', {
          type: 'invoice_need_approval', title: 'Invoice perlu di-approve',
          message: `${inv.doc_type === 'quotation' ? 'Quotation' : 'Invoice'} ${label} (${inv.customer_name}) diajukan ${by} dan menunggu approval.`,
          sourceFeature: 'invoice', sourceId: id, createdBy: by,
        });
      } else if (inv.created_by && inv.created_by !== by && (action === 'approve' || action === 'reject' || action === 'void' || action === 'restore')) {
        const text = { approve: 'sudah di-approve. Word/PDF bisa diunduh.', reject: `dikembalikan ke Draft: ${note}`, void: `di-void: ${note}`, restore: `dikembalikan ke Approved: ${note}` }[action];
        await notifyUser(inv.created_by, {
          type: `invoice_${action}`, title: action === 'approve' ? 'Invoice di-approve' : action === 'reject' ? 'Invoice dikembalikan' : action === 'restore' ? 'Invoice dipulihkan' : 'Invoice di-void',
          message: `${inv.doc_type === 'quotation' ? 'Quotation' : 'Invoice'} ${label} (${inv.customer_name}) ${text}`,
          sourceFeature: 'invoice', sourceId: id, createdBy: by,
        });
      }
    } catch (err) {
      console.error('Failed to send invoice notification:', err);
    }
    return NextResponse.json({ success: true, status: t.to });
  } catch (error) {
    console.error('Error invoice action:', error);
    return NextResponse.json({ error: 'Gagal memproses aksi' }, { status: 500 });
  }
}
