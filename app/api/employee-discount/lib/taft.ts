import { getSheetData } from '@/lib/sheets';

// Sama seperti resolusi taft_name di Traffic Store (app/(main)/traffic-store/page.tsx,
// userStore & taftsForStore) tapi dilakukan di server: cocokkan user_name login
// terhadap store_location di master_traffic (exact match dulu, lalu substring),
// lalu ambil daftar taft_name unik untuk store tersebut.
const STORE_NAME_MAP: Record<string, string> = {
  cirebon: 'Cirebon', jogja: 'Jogja', karawaci: 'Karawaci', karawang: 'Karawang',
  lampung: 'Lampung', lembong: 'Lembong', makassar: 'Makassar', malang: 'Malang',
  margonda: 'Margonda', medan: 'Medan', pekalongan: 'Pekalongan',
  purwokerto: 'Purwokerto', surabaya: 'Surabaya', tambun: 'Tambun',
};

export async function getEmployeeDiscountTaft(userNameRaw: string) {
  const userName = userNameRaw.toLowerCase().trim();

  const master = await getSheetData('master_traffic');

  const masterStores = [...new Set(
    master.map((m: any) => m.store_location).filter(Boolean)
  )] as string[];

  let userStore: string | null = null;
  const exactMatch = masterStores.find((s) => s.toLowerCase().trim() === userName);
  if (exactMatch) {
    userStore = exactMatch;
  } else {
    const partialMatch = masterStores.find(
      (s) => userName.includes(s.toLowerCase().trim()) || s.toLowerCase().trim().includes(userName)
    );
    if (partialMatch) {
      userStore = partialMatch;
    } else {
      const storeKeys = Object.keys(STORE_NAME_MAP);
      const mapMatch = storeKeys.find(
        (k) => userName === k || userName === k.replace(/\s/g, '') || userName.includes(k)
      );
      userStore = mapMatch ? STORE_NAME_MAP[mapMatch] : null;
    }
  }

  const taftsForStore = userStore
    ? [...new Set(
        master
          .filter((m: any) => m.store_location?.toLowerCase().trim() === (userStore as string).toLowerCase().trim())
          .map((m: any) => m.taft_name)
          .filter(Boolean)
      )]
    : [];

  return { userStore, taftsForStore };
}
