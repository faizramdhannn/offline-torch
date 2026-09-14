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

// Tawaran khusus per collection badge (SKU-based) — sesuai koleksi yang
// pernah dibeli customer. Badge collection baru yang ditambah admin lewat
// Kelola Badge (di luar 3 ini) tetap kebagian tawaran generik lewat fallback
// di bawah, bukan diabaikan.
const COLLECTION_COPY: Record<string, { analysis: string; offer: string }> = {
  gundam: {
    analysis: 'pernah beli produk koleksi Gundam — cocok ditawarkan restock/varian baru koleksi Gundam',
    offer: 'Btw Kak, koleksi Gundam kami baru ada tambahan desain/varian baru. Mau kami kirim katalognya?',
  },
  metro_ride: {
    analysis: 'pernah beli produk koleksi Metro Ride — cocok ditawarkan item baru untuk kebutuhan commuting/aktivitas harian',
    offer: 'Ada produk baru di koleksi Metro Ride yang cocok buat aktivitas harian Kakak. Mau kami infokan?',
  },
  watch: {
    analysis: 'pernah beli produk koleksi Watch — cocok ditawarkan model/varian jam tangan terbaru',
    offer: 'Koleksi Watch kami ada model baru yang mungkin Kakak suka. Mau kami kirim pilihannya?',
  },
};

function collectionCopy(key: string, label: string) {
  return (
    COLLECTION_COPY[key] || {
      analysis: `pernah beli produk dari koleksi ${label} — cocok ditawarkan produk baru dari koleksi yang sama`,
      offer: `Ada produk baru dari koleksi ${label} yang mungkin Kakak suka. Mau kami infokan?`,
    }
  );
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
  const badges = input.badges || [];
  const badgeKeys = badges.map((b) => b.key);
  const days = daysSince(input.last_purchase_iso);

  const analysisPoints: string[] = [];
  const offerLines: string[] = [];
  let greeting: string;
  let closing: string;

  // ── Tier: menentukan nada sapaan pembuka + penutup ──
  if (badgeKeys.includes('champion')) {
    analysisPoints.push(`${name} adalah customer Champion (${totalOrder}x order) — prioritas jaga hubungan baik, cocok kasih perlakuan VIP.`);
    greeting = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih banyak sudah jadi pelanggan setia ${store}. Kami sangat menghargai kepercayaan Kakak selama ini.`;
    closing = 'Sebagai pelanggan terbaik kami, kalau ada produk baru, kami akan info duluan ke Kakak. Ada yang bisa kami bantu hari ini?';
  } else if (badgeKeys.includes('potential_loyalist')) {
    analysisPoints.push(`${name} sudah order ${totalOrder}x — berpotensi jadi loyal customer, cocok didorong repeat order dengan info promo/loyalty.`);
    greeting = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih sudah beberapa kali belanja di ${store}.`;
    closing = 'Kalau mau, kami bisa infokan promo/produk baru duluan ke Kakak. Ada yang bisa kami bantu hari ini?';
  } else if (badgeKeys.includes('new_customer')) {
    analysisPoints.push(`${name} baru order 1x — momen perkenalan, cocok ditawarkan produk lain yang senada dengan pembelian pertamanya.`);
    greeting = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih sudah belanja di ${store}. Semoga produknya sesuai harapan ya!`;
    closing = 'Kalau ada pertanyaan seputar produk atau butuh bantuan, jangan sungkan hubungi kami di sini ya \u{1F60A}';
  } else {
    greeting = `Halo Kak ${name}! \u{1F44B}\n\nTerima kasih sudah menjadi pelanggan ${store}.`;
    closing = 'Ada yang bisa kami bantu hari ini?';
  }

  // ── Recency: kalau sudah lama tidak order, ini jadi prioritas utama ──
  if (days !== null && days > 90) {
    analysisPoints.push(`Sudah ${days} hari sejak order terakhir — prioritas jadi pesan "win-back" dengan promo comeback.`);
    greeting = `Halo Kak ${name}! \u{1F44B}\n\nSudah lama nih kami nggak dengar kabar dari Kakak di ${store}. Kami kangen! \u{1F60A}`;
    offerLines.unshift('Kebetulan ada promo spesial buat Kakak yang mau belanja lagi. Mau kami infokan detailnya?');
  } else if (days !== null && days > 30) {
    analysisPoints.push(`${days} hari sejak order terakhir — masih wajar, tapi baik untuk disapa ulang.`);
  } else if (days !== null) {
    analysisPoints.push(`Baru ${days} hari sejak order terakhir — momen bagus untuk cek kepuasan produk.`);
  }

  // ── Bulk order: peluang kerja sama/reseller ──
  if (badgeKeys.includes('bulk_order')) {
    analysisPoints.push('pernah order dalam jumlah besar (>5 qty) dalam 1 transaksi — potensial untuk penawaran kerja sama/reseller/harga khusus order banyak.');
    offerLines.push('Karena Kakak pernah order dalam jumlah besar, kami bisa bantu kasih harga khusus kalau mau order banyak lagi — mau kami buatkan penawarannya?');
  }

  // ── Collection: tawaran produk spesifik sesuai koleksi yang pernah dibeli ──
  for (const b of badges) {
    if (b.key === 'new_customer' || b.key === 'potential_loyalist' || b.key === 'champion' || b.key === 'bulk_order') continue;
    const copy = collectionCopy(b.key, b.label);
    analysisPoints.push(`${name} ${copy.analysis}.`);
    offerLines.push(copy.offer);
  }

  if (analysisPoints.length === 0) {
    analysisPoints.push('Belum ada data order yang cukup — gunakan pesan sapaan umum.');
  }

  const analysis = analysisPoints.join(' ');
  const message = [greeting, ...offerLines, closing].filter(Boolean).join('\n\n');

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
