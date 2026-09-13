import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';

interface BadgeInput {
  key: string;
  label: string;
}

function daysSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function buildAnalysisAndMessage(input: {
  customer_name?: string;
  store_name?: string;
  total_order?: number;
  badges?: BadgeInput[];
  last_purchase_iso?: string;
}) {
  const name = input.customer_name?.trim() || 'Kak';
  const store = input.store_name || 'Torch';
  const totalOrder = input.total_order || 0;
  const badgeKeys = (input.badges || []).map((b) => b.key);
  const days = daysSince(input.last_purchase_iso);

  const analysisPoints: string[] = [];
  let tone: 'welcome' | 'winback' | 'loyalty' | 'reengage' = 'reengage';

  if (badgeKeys.includes('champion')) {
    analysisPoints.push(`${name} adalah customer Champion (${totalOrder}x order) — prioritas jaga hubungan baik.`);
    tone = 'loyalty';
  } else if (badgeKeys.includes('potential_loyalist')) {
    analysisPoints.push(`${name} sudah order ${totalOrder}x — berpotensi jadi loyal customer, cocok didorong repeat order.`);
    tone = 'loyalty';
  } else if (badgeKeys.includes('new_customer')) {
    analysisPoints.push(`${name} baru order 1x — momen bagus untuk perkenalan lebih jauh & follow akun.`);
    tone = 'welcome';
  }

  if (badgeKeys.includes('bulk_order')) {
    analysisPoints.push('Pernah bulk order dalam 1 transaksi — potensial untuk penawaran kerja sama/reseller.');
  }

  if (days !== null) {
    if (days > 90) {
      analysisPoints.push(`Sudah ${days} hari sejak order terakhir — cocok pesan "win-back" dengan promo comeback.`);
      tone = 'winback';
    } else if (days > 30) {
      analysisPoints.push(`${days} hari sejak order terakhir — masih dalam jangkauan wajar, tapi baik untuk disapa ulang.`);
    } else {
      analysisPoints.push(`Baru ${days} hari sejak order terakhir — cocok ucapan terima kasih / cek kepuasan produk.`);
    }
  }

  if (analysisPoints.length === 0) {
    analysisPoints.push('Belum ada data order yang cukup — gunakan pesan sapaan umum.');
  }

  const analysis = analysisPoints.join(' ');

  let message: string;
  switch (tone) {
    case 'welcome':
      message = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih sudah belanja di ${store}. Semoga produknya sesuai harapan ya!\n\nKalau ada pertanyaan seputar produk atau butuh bantuan, jangan sungkan hubungi kami di sini ya. Kami juga sering ada info promo/produk baru, boleh banget follow akun sosial media kami supaya nggak ketinggalan \u{1F60A}`;
      break;
    case 'loyalty':
      message = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih banyak sudah jadi pelanggan setia ${store}. Kami sangat menghargai kepercayaan Kakak selama ini.\n\nSebagai apresiasi, kalau Kakak butuh rekomendasi produk baru atau ada promo khusus, kami akan info duluan ke Kakak ya. Ada yang bisa kami bantu hari ini?`;
      break;
    case 'winback':
      message = `Halo Kak ${name}! \u{1F44B}\n\nSudah lama nih kami nggak dengar kabar dari Kakak di ${store}. Kami kangen! \u{1F60A}\n\nKebetulan ada promo spesial buat Kakak yang mau belanja lagi. Mau kami infokan detailnya?`;
      break;
    default:
      message = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih sudah menjadi pelanggan ${store}. Ada yang bisa kami bantu hari ini?`;
  }

  return { analysis, message };
}

export async function POST(request: NextRequest) {
  try {
    await ensureCustomerSchema();
    const body = await request.json();
    const {
      phone_number,
      store_name,
      customer_name,
      total_order,
      badges,
      last_purchase_iso,
      username,
    } = body;

    if (!phone_number) {
      return NextResponse.json({ error: 'phone_number wajib diisi' }, { status: 400 });
    }

    const { analysis, message } = buildAnalysisAndMessage({
      customer_name,
      store_name,
      total_order,
      badges,
      last_purchase_iso,
    });

    const rows = await sql`
      INSERT INTO customer_wa_followups (phone_number, store_name, analysis, message, created_by)
      VALUES (${phone_number}, ${store_name || ''}, ${analysis}, ${message}, ${username || ''})
      RETURNING id, analysis, message, created_at
    `;

    return NextResponse.json({ success: true, ...rows[0] });
  } catch (error) {
    console.error('Error generating followup message:', error);
    return NextResponse.json({ error: 'Gagal membuat pesan followup' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureCustomerSchema();
    const body = await request.json();
    const { id, message } = body;
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    }

    await sql`
      UPDATE customer_wa_followups
      SET sent_at = now(), message = COALESCE(${message ?? null}, message)
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking followup message sent:', error);
    return NextResponse.json({ error: 'Gagal update status kirim' }, { status: 500 });
  }
}
