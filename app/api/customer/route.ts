import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureCustomerSchema } from '@/lib/neon';
import { uploadToGoogleDrive } from '@/lib/drive';

// Nama store_name pendek (lihat STORE_NAME_MAP di lib/shopifyImport.ts) untuk
// toko-toko utama yang punya akun login sendiri — dipakai untuk mendeteksi
// apakah username yang login adalah staff toko tertentu (isOwner view).
const STORE_LIST = [
  'Cirebon',
  'Jogja',
  'Karawaci',
  'Karawang',
  'Lampung',
  'Lembong',
  'Makassar',
  'Malang',
  'Margonda',
  'Medan',
  'Pekalongan',
  'Purwokerto',
  'Surabaya',
  'Tambun',
];

function formatRupiah(v: number) {
  return 'Rp' + Math.round(v).toLocaleString('id-ID');
}

function formatDate(v: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function findMatchingStore(username: string): string | undefined {
  return STORE_LIST.find((store) => {
    const storeKey = store.toLowerCase().replace(/\s+/g, '');
    const usernameKey = username.toLowerCase().replace(/\s+/g, '').replace('torch', '');
    return storeKey === usernameKey;
  });
}

// Akses lintas-toko: staff toko ini juga boleh lihat data customer toko lain
// yang disebut di sini (mis. karena toko-toko itu berdekatan/dikelola bareng).
// Hanya menambah store_name yang IKUT ditarik datanya — tidak mengubah
// identitas storeName yang ditampilkan di header halaman.
const EXTRA_STORE_ACCESS: Record<string, string[]> = {
  Margonda: ['Karawaci'],
  Surabaya: ['Malang'],
  Karawang: ['Tambun'],
};

export async function GET(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const view = searchParams.get('view') || 'list';
    const fullAccess = searchParams.get('fullAccess') === 'true';

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Pemilik akses user_setting (admin) melihat semua store, terlepas dari
    // apakah username-nya cocok dengan nama sebuah toko.
    const matchingStore = fullAccess ? undefined : findMatchingStore(username);
    const accessibleStores = matchingStore
      ? [matchingStore, ...(EXTRA_STORE_ACCESS[matchingStore] || [])]
      : undefined;

    if (view !== 'list') {
      return NextResponse.json({ data: [] });
    }

    const rows = accessibleStores
      ? await sql`
          SELECT
            o.store_name AS location_store,
            o.phone AS phone_number,
            (array_agg(o.customer_name ORDER BY o.created_at DESC NULLS LAST))[1] AS customer_name,
            (array_agg(o.email ORDER BY o.created_at DESC NULLS LAST) FILTER (WHERE o.email <> ''))[1] AS email,
            COUNT(DISTINCT o.sales_order)::int AS total_order,
            SUM(o.total)::numeric AS total_value,
            SUM((SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li))::numeric AS total_qty,
            MIN(o.created_at) AS first_purchase,
            MAX(o.created_at) AS last_purchase,
            c.followup, c.result, c.ket, c.link_url, c.update_by, c.update_at
          FROM shopify_orders o
          LEFT JOIN customer_crm c ON c.store_name = o.store_name AND c.phone_number = o.phone
          WHERE o.phone IS NOT NULL AND o.phone <> '' AND o.store_name = ANY(${accessibleStores})
          GROUP BY o.store_name, o.phone, c.followup, c.result, c.ket, c.link_url, c.update_by, c.update_at
          ORDER BY total_value DESC NULLS LAST
        `
      : await sql`
          SELECT
            o.store_name AS location_store,
            o.phone AS phone_number,
            (array_agg(o.customer_name ORDER BY o.created_at DESC NULLS LAST))[1] AS customer_name,
            (array_agg(o.email ORDER BY o.created_at DESC NULLS LAST) FILTER (WHERE o.email <> ''))[1] AS email,
            COUNT(DISTINCT o.sales_order)::int AS total_order,
            SUM(o.total)::numeric AS total_value,
            SUM((SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li))::numeric AS total_qty,
            MIN(o.created_at) AS first_purchase,
            MAX(o.created_at) AS last_purchase,
            c.followup, c.result, c.ket, c.link_url, c.update_by, c.update_at
          FROM shopify_orders o
          LEFT JOIN customer_crm c ON c.store_name = o.store_name AND c.phone_number = o.phone
          WHERE o.phone IS NOT NULL AND o.phone <> ''
          GROUP BY o.store_name, o.phone, c.followup, c.result, c.ket, c.link_url, c.update_by, c.update_at
          ORDER BY total_value DESC NULLS LAST
        `;

    // ─── Badges: tier (jumlah order), bulk order (>5 qty dalam 1 sales_order),
    // dan collection (SKU cocok dengan master collection, ex: Gundam/Metro Ride).
    // Hanya key badge yang dikirim ke frontend (bukan label/logo penuh) supaya
    // payload tidak membengkak — frontend resolve key -> label/logo dari
    // GET /api/customer/badges yang di-fetch sekali saja. ──
    const badgeDefs = await sql`SELECT id, badge_key, label, badge_type, logo_url, sku_list FROM customer_badges ORDER BY sort_order ASC`;
    const collectionBadges = badgeDefs.filter((b: any) => b.badge_type === 'collection' && Array.isArray(b.sku_list) && b.sku_list.length > 0);

    const bulkKey = (s: string, p: string) => `${s}||${p}`;
    const bulkSet = new Set<string>();
    const bulkRows = await sql`
      SELECT DISTINCT o.store_name, o.phone
      FROM shopify_orders o
      WHERE o.phone IS NOT NULL AND o.phone <> ''
        AND (SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li) > 5
    `;
    bulkRows.forEach((r: any) => bulkSet.add(bulkKey(r.store_name, r.phone)));

    const collectionSets = new Map<string, Set<string>>();
    for (const badge of collectionBadges) {
      const skus: string[] = (badge.sku_list as string[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (skus.length === 0) continue;
      const matchRows = await sql`
        SELECT DISTINCT o.store_name, o.phone
        FROM shopify_orders o, jsonb_array_elements(o.line_items) li
        WHERE o.phone IS NOT NULL AND o.phone <> ''
          AND upper(li->>'sku') = ANY(${skus})
      `;
      const set = new Set<string>();
      matchRows.forEach((r: any) => set.add(bulkKey(r.store_name, r.phone)));
      collectionSets.set(badge.badge_key, set);
    }

    const data = rows.map((r: any) => {
      const totalOrder = Number(r.total_order) || 0;
      const totalValue = Number(r.total_value) || 0;
      const totalQty = Number(r.total_qty) || 0;
      const key = bulkKey(r.location_store, r.phone_number);

      const badges: string[] = [];
      if (totalOrder === 1) badges.push('new_customer');
      else if (totalOrder >= 2 && totalOrder <= 5) badges.push('potential_loyalist');
      else if (totalOrder > 5) badges.push('champion');
      if (bulkSet.has(key)) badges.push('bulk_order');
      collectionSets.forEach((set, badgeKey) => {
        if (set.has(key)) badges.push(badgeKey);
      });

      return {
        phone_number: r.phone_number || '',
        customer_name: r.customer_name || '',
        email: r.email || '',
        location_store: r.location_store || '',
        total_order: String(totalOrder),
        total_qty: String(totalQty),
        total_value: formatRupiah(totalValue),
        total_value_num: totalValue,
        first_purchase: formatDate(r.first_purchase),
        last_purchase: formatDate(r.last_purchase),
        last_purchase_iso: r.last_purchase || '',
        average_value: formatRupiah(totalOrder ? totalValue / totalOrder : 0),
        followup: r.followup ? 'TRUE' : 'FALSE',
        result: r.result || '',
        ket: r.ket || '',
        link_url: r.link_url || '',
        update_by: r.update_by || '',
        update_at: r.update_at || '',
        badges,
      };
    });

    if (matchingStore) {
      return NextResponse.json({ isOwner: true, storeName: matchingStore, view: 'list', data });
    }
    return NextResponse.json({ isOwner: false, view: 'list', data });
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureCustomerSchema();

    const formData = await request.formData();
    const storeNameField = formData.get('storeName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const username = formData.get('username') as string;
    const followup = formData.get('followup') === 'true';
    const result = formData.get('result') as string;
    const ket = formData.get('ket') as string;
    const file = formData.get('file') as File | null;

    if (!storeNameField || !phoneNumber) {
      return NextResponse.json({ error: 'Store name and phone number are required' }, { status: 400 });
    }

    const existing = await sql`
      SELECT link_url, update_at FROM customer_crm WHERE store_name = ${storeNameField} AND phone_number = ${phoneNumber}
    `;
    const current = existing[0];

    let linkUrl = current?.link_url || '';

    if (file) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `${dateStr}_${storeNameField}_${phoneNumber}_followup`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        'customer_followup'
      );
    }

    // Only set update_at the first time this customer row is touched.
    let updateAt = current?.update_at || '';
    if (!updateAt || updateAt.trim() === '') {
      updateAt = new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    await sql`
      INSERT INTO customer_crm (store_name, phone_number, followup, result, ket, link_url, update_by, update_at)
      VALUES (${storeNameField}, ${phoneNumber}, ${followup}, ${result || ''}, ${ket || ''}, ${linkUrl}, ${username}, ${updateAt})
      ON CONFLICT (store_name, phone_number) DO UPDATE SET
        followup = EXCLUDED.followup,
        result = EXCLUDED.result,
        ket = EXCLUDED.ket,
        link_url = EXCLUDED.link_url,
        update_by = EXCLUDED.update_by,
        update_at = EXCLUDED.update_at
    `;

    return NextResponse.json({ success: true, link_url: linkUrl });
  } catch (error) {
    console.error('Error updating customer data:', error);
    return NextResponse.json({ error: 'Failed to update customer data' }, { status: 500 });
  }
}
