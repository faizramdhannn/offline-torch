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
const EXTRA_STORE_ACCESS: Record<string, string[]> = {
  Margonda: ['Karawaci'],
  Surabaya: ['Malang'],
  Karawang: ['Tambun'],
};

const SORT_COLUMNS: Record<string, string> = {
  phone_number: 'phone_number',
  customer_name: 'customer_name',
  email: 'email',
  location_store: 'location_store',
  total_order: 'total_order',
  total_qty: 'total_qty',
  total_value_num: 'total_value',
  first_purchase: 'first_purchase',
  last_purchase: 'last_purchase',
};

const TIER_KEYS = ['new_customer', 'potential_loyalist', 'champion'];

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

    const matchingStore = fullAccess ? undefined : findMatchingStore(username);
    const accessibleStores = matchingStore
      ? [matchingStore, ...(EXTRA_STORE_ACCESS[matchingStore] || [])]
      : undefined;

    // Daftar store untuk dropdown filter — TIDAK ikut dipersempit oleh
    // search/badge/value/order filter lain (supaya opsi dropdown-nya stabil),
    // hanya dibatasi oleh store yang memang boleh diakses user ini.
    const storesResult = accessibleStores
      ? await sql`SELECT DISTINCT store_name FROM shopify_orders WHERE store_name = ANY(${accessibleStores}) AND phone IS NOT NULL AND phone <> ''`
      : await sql`SELECT DISTINCT store_name FROM shopify_orders WHERE phone IS NOT NULL AND phone <> ''`;
    const availableStores = (storesResult as any[]).map((r) => r.store_name).filter(Boolean).sort();

    if (view !== 'list') {
      return NextResponse.json({ data: [] });
    }

    // ─── Query params: search, filter, sort, pagination ─────────────────────
    // Ini menggantikan pendekatan lama "tarik SEMUA customer sekaligus lalu
    // filter/sort/paginate di browser" — dengan data sudah 89rb+ order,
    // respons lama bisa >16MB dan >18 detik (bikin loading macet/timeout di
    // koneksi lambat). Sekarang filter/sort/pagination dikerjakan di SQL, dan
    // browser cuma menerima 1 halaman (default 25 baris) sekali fetch.
    const q = (searchParams.get('q') || '').trim();
    const storeFilter = searchParams.get('stores')?.split(',').filter(Boolean) || [];
    const badgeFilter = searchParams.get('badges')?.split(',').filter(Boolean) || [];
    const vmin = searchParams.get('vmin') ? parseFloat(searchParams.get('vmin')!) : null;
    const vmax = searchParams.get('vmax') ? parseFloat(searchParams.get('vmax')!) : null;
    const omin = searchParams.get('omin') ? parseFloat(searchParams.get('omin')!) : null;
    const omax = searchParams.get('omax') ? parseFloat(searchParams.get('omax')!) : null;
    const sortKey = SORT_COLUMNS[searchParams.get('sortKey') || ''] || 'total_value';
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25));
    const offset = (page - 1) * limit;

    const storeScope = accessibleStores
      ? (storeFilter.length > 0 ? storeFilter.filter((s) => accessibleStores.includes(s)) : accessibleStores)
      : (storeFilter.length > 0 ? storeFilter : null);

    // ─── Badge membership: hitung sekali, di-scope ke storeScope kalau ada
    // (bukan seluruh tabel) — dipakai untuk badge di tiap baris DAN untuk
    // filter "hanya tampilkan customer dengan badge X". ──
    const badgeDefs = await sql`SELECT badge_key, label, badge_type, sku_list FROM customer_badges ORDER BY sort_order ASC`;
    const collectionBadges = badgeDefs.filter((b: any) => b.badge_type === 'collection' && Array.isArray(b.sku_list) && b.sku_list.length > 0);
    const bulkKey = (s: string, p: string) => `${s}||${p}`;

    const bulkRows = storeScope
      ? await sql`
          SELECT DISTINCT o.store_name, o.phone
          FROM shopify_orders o
          WHERE o.phone IS NOT NULL AND o.phone <> '' AND o.store_name = ANY(${storeScope})
            AND (SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li) > 5
        `
      : await sql`
          SELECT DISTINCT o.store_name, o.phone
          FROM shopify_orders o
          WHERE o.phone IS NOT NULL AND o.phone <> ''
            AND (SELECT COALESCE(SUM((li->>'quantity')::numeric), 0) FROM jsonb_array_elements(o.line_items) li) > 5
        `;
    const bulkSet = new Set<string>(bulkRows.map((r: any) => bulkKey(r.store_name, r.phone)));

    const collectionSets = new Map<string, Set<string>>();
    for (const badge of collectionBadges) {
      const skus: string[] = (badge.sku_list as string[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (skus.length === 0) continue;
      const matchRows = storeScope
        ? await sql`
            SELECT DISTINCT o.store_name, o.phone
            FROM shopify_orders o, jsonb_array_elements(o.line_items) li
            WHERE o.phone IS NOT NULL AND o.phone <> '' AND o.store_name = ANY(${storeScope})
              AND upper(li->>'sku') = ANY(${skus})
          `
        : await sql`
            SELECT DISTINCT o.store_name, o.phone
            FROM shopify_orders o, jsonb_array_elements(o.line_items) li
            WHERE o.phone IS NOT NULL AND o.phone <> ''
              AND upper(li->>'sku') = ANY(${skus})
          `;
      const set = new Set<string>();
      matchRows.forEach((r: any) => set.add(bulkKey(r.store_name, r.phone)));
      collectionSets.set(badge.badge_key, set);
    }

    function badgesForRow(store: string, phone: string, totalOrder: number): string[] {
      const key = bulkKey(store, phone);
      const badges: string[] = [];
      if (totalOrder === 1) badges.push('new_customer');
      else if (totalOrder >= 2 && totalOrder <= 5) badges.push('potential_loyalist');
      else if (totalOrder > 5) badges.push('champion');
      if (bulkSet.has(key)) badges.push('bulk_order');
      collectionSets.forEach((set, badgeKey) => {
        if (set.has(key)) badges.push(badgeKey);
      });
      return badges;
    }

    // ─── Bangun query dinamis (raw SQL + params) untuk filter/sort/pagination ──
    // PENTING: tiap placeholder diberi cast eksplisit (::text[], ::numeric,
    // ::int, dst). Tanpa ini Postgres bisa gagal dengan "could not determine
    // data type of parameter $N" untuk parameter yang cuma dipakai di posisi
    // yang tidak cukup memberi petunjuk tipe (mis. LIMIT/OFFSET) — kejadian
    // nyata di production untuk endpoint ini sebelum fix ini.
    const params: any[] = [];
    const ph = (v: any, cast: string) => {
      params.push(v);
      return `$${params.length}::${cast}`;
    };

    let baseWhere = `o.phone IS NOT NULL AND o.phone <> ''`;
    if (storeScope) baseWhere += ` AND o.store_name = ANY(${ph(storeScope, 'text[]')})`;

    let outerWhere = '1=1';
    if (q) {
      const likeParam = ph(`%${q}%`, 'text');
      outerWhere += ` AND (phone_number ILIKE ${likeParam} OR customer_name ILIKE ${likeParam})`;
    }
    if (vmin !== null) outerWhere += ` AND total_value >= ${ph(vmin, 'numeric')}`;
    if (vmax !== null) outerWhere += ` AND total_value <= ${ph(vmax, 'numeric')}`;
    if (omin !== null) outerWhere += ` AND total_order >= ${ph(omin, 'numeric')}`;
    if (omax !== null) outerWhere += ` AND total_order <= ${ph(omax, 'numeric')}`;

    if (badgeFilter.length > 0) {
      const wantNew = badgeFilter.includes('new_customer');
      const wantPot = badgeFilter.includes('potential_loyalist');
      const wantChamp = badgeFilter.includes('champion');
      const nonTierKeys = badgeFilter.filter((k) => !TIER_KEYS.includes(k));
      const unionKeys = new Set<string>();
      for (const k of nonTierKeys) {
        const set = k === 'bulk_order' ? bulkSet : collectionSets.get(k);
        set?.forEach((v) => unionKeys.add(v));
      }
      const conditions: string[] = [];
      if (wantNew) conditions.push(`total_order = 1`);
      if (wantPot) conditions.push(`total_order BETWEEN 2 AND 5`);
      if (wantChamp) conditions.push(`total_order > 5`);
      if (nonTierKeys.length > 0) {
        conditions.push(`(location_store || '||' || phone_number) = ANY(${ph(Array.from(unionKeys), 'text[]')})`);
      }
      outerWhere += conditions.length > 0 ? ` AND (${conditions.join(' OR ')})` : ' AND FALSE';
    }

    const aggCte = `
      WITH agg AS (
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
        WHERE ${baseWhere}
        GROUP BY o.store_name, o.phone, c.followup, c.result, c.ket, c.link_url, c.update_by, c.update_at
      )
    `;

    const countQuery = `${aggCte} SELECT COUNT(*)::int AS total FROM agg WHERE ${outerWhere}`;
    const countParams = [...params];

    const limitPh = ph(limit, 'int');
    const offsetPh = ph(offset, 'int');
    const dataQuery = `
      ${aggCte}
      SELECT * FROM agg WHERE ${outerWhere}
      ORDER BY ${sortKey} ${sortDir} NULLS LAST
      LIMIT ${limitPh} OFFSET ${offsetPh}
    `;

    // ─── Badge summary stats (kartu ringkasan di atas filter) — dihitung di
    // SQL atas SELURUH baris yang cocok filter (bukan cuma 1 halaman), tanpa
    // perlu kirim baris mentahnya ke browser. ──
    const tierStatsQuery = `
      ${aggCte}
      SELECT
        COUNT(*) FILTER (WHERE total_order = 1)::int AS new_count,
        COALESCE(SUM(total_order) FILTER (WHERE total_order = 1), 0)::numeric AS new_order,
        COALESCE(SUM(total_qty) FILTER (WHERE total_order = 1), 0)::numeric AS new_qty,
        COALESCE(SUM(total_value) FILTER (WHERE total_order = 1), 0)::numeric AS new_value,
        COUNT(*) FILTER (WHERE total_order BETWEEN 2 AND 5)::int AS pot_count,
        COALESCE(SUM(total_order) FILTER (WHERE total_order BETWEEN 2 AND 5), 0)::numeric AS pot_order,
        COALESCE(SUM(total_qty) FILTER (WHERE total_order BETWEEN 2 AND 5), 0)::numeric AS pot_qty,
        COALESCE(SUM(total_value) FILTER (WHERE total_order BETWEEN 2 AND 5), 0)::numeric AS pot_value,
        COUNT(*) FILTER (WHERE total_order > 5)::int AS champ_count,
        COALESCE(SUM(total_order) FILTER (WHERE total_order > 5), 0)::numeric AS champ_order,
        COALESCE(SUM(total_qty) FILTER (WHERE total_order > 5), 0)::numeric AS champ_qty,
        COALESCE(SUM(total_value) FILTER (WHERE total_order > 5), 0)::numeric AS champ_value
      FROM agg WHERE ${outerWhere}
    `;

    const nonTierBadgeDefs = badgeDefs.filter((b: any) => !TIER_KEYS.includes(b.badge_key));
    const nonTierStatsQueries = nonTierBadgeDefs.map((b: any) => {
      const set = b.badge_key === 'bulk_order' ? bulkSet : collectionSets.get(b.badge_key);
      const keys = set ? Array.from(set) : [];
      // PENTING: pakai countParams (snapshot SEBELUM limitPh/offsetPh
      // ditambahkan ke `params`), bukan `params` langsung — query stats ini
      // tidak pernah mereferensikan placeholder limit/offset, jadi kalau ikut
      // disisipkan tetap membuat Postgres gagal infer tipenya ("could not
      // determine data type of parameter $N") karena placeholder itu tidak
      // dipakai sama sekali di teks query.
      const keyParams = [...countParams, keys];
      const keyPh = `$${keyParams.length}::text[]`;
      const query = `
        ${aggCte}
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM(total_order), 0)::numeric AS sum_order,
          COALESCE(SUM(total_qty), 0)::numeric AS sum_qty,
          COALESCE(SUM(total_value), 0)::numeric AS sum_value
        FROM agg WHERE ${outerWhere} AND (location_store || '||' || phone_number) = ANY(${keyPh})
      `;
      return { badge: b, query, keyParams };
    });

    const [countResult, rows, tierStatsResult, ...nonTierStatsResults] = await Promise.all([
      sql(countQuery, countParams) as Promise<any[]>,
      sql(dataQuery, params) as Promise<any[]>,
      sql(tierStatsQuery, countParams) as Promise<any[]>,
      ...nonTierStatsQueries.map((q) => sql(q.query, q.keyParams) as Promise<any[]>),
    ]);

    const total = countResult[0]?.total || 0;

    const ts = tierStatsResult[0] || {};
    const stats: { key: string; count: number; totalOrder: number; totalQty: number; totalValue: number }[] = [];
    if (Number(ts.new_count) > 0) {
      stats.push({ key: 'new_customer', count: Number(ts.new_count), totalOrder: Number(ts.new_order), totalQty: Number(ts.new_qty), totalValue: Number(ts.new_value) });
    }
    if (Number(ts.pot_count) > 0) {
      stats.push({ key: 'potential_loyalist', count: Number(ts.pot_count), totalOrder: Number(ts.pot_order), totalQty: Number(ts.pot_qty), totalValue: Number(ts.pot_value) });
    }
    if (Number(ts.champ_count) > 0) {
      stats.push({ key: 'champion', count: Number(ts.champ_count), totalOrder: Number(ts.champ_order), totalQty: Number(ts.champ_qty), totalValue: Number(ts.champ_value) });
    }
    nonTierBadgeDefs.forEach((b: any, i: number) => {
      const r = nonTierStatsResults[i]?.[0];
      if (r && Number(r.count) > 0) {
        stats.push({ key: b.badge_key, count: Number(r.count), totalOrder: Number(r.sum_order), totalQty: Number(r.sum_qty), totalValue: Number(r.sum_value) });
      }
    });

    const data = rows.map((r: any) => {
      const totalOrder = Number(r.total_order) || 0;
      const totalValue = Number(r.total_value) || 0;
      const totalQty = Number(r.total_qty) || 0;

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
        badges: badgesForRow(r.location_store, r.phone_number, totalOrder),
      };
    });

    const responsePayload = {
      isOwner: !!matchingStore,
      storeName: matchingStore || '',
      view: 'list',
      data,
      page,
      limit,
      total,
      stats,
      stores: availableStores,
    };

    return NextResponse.json(responsePayload);
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
