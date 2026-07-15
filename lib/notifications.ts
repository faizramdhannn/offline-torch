import { getSheetData, appendSheetData } from '@/lib/sheets';

// Sheet `notifications` (A-J): id, scope, target_user, type, title, message,
// source_feature, source_id, created_by, created_at
//   - scope 'all'  → tampil ke SEMUA user (dipakai untuk notifikasi custom
//                     yang ditambahkan admin/akses user_setting).
//   - scope 'user'  → hanya tampil ke satu user (target_user), dipakai untuk
//                     notifikasi otomatis per-event (misal "invoice kamu
//                     di-approve") yang memang beda-beda per user login.
// Sheet `notification_reads` (A-C): id, notification_id, user_name — satu
// baris = satu user sudah membaca satu notifikasi tertentu (read state
// per-item, sesuai keputusan produk: tandai dibaca saat notifikasi itu
// sendiri diklik, bukan otomatis semua saat dropdown dibuka).

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

export interface CreateNotificationInput {
  scope: 'all' | 'user';
  targetUser?: string; // wajib kalau scope === 'user'
  type: string; // slug bebas, misal 'invoice_approved', 'employee_discount_created', 'custom'
  title: string;
  message: string;
  sourceFeature?: string; // misal 'invoice', 'employee_discount', 'material_issue'
  sourceId?: string;
  createdBy?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const id = `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const row = [
    id,
    input.scope,
    input.scope === 'user' ? (input.targetUser || '') : '',
    input.type,
    input.title,
    input.message,
    input.sourceFeature || '',
    input.sourceId || '',
    input.createdBy || '',
    toJakartaTimestamp(),
  ];
  await appendSheetData('notifications', [row]);
  return id;
}

// Kirim notifikasi personal ke SEMUA user yang punya flag permission TRUE
// (misal semua yang punya invoice_master, buat kasih tahu ada dokumen baru
// yang perlu di-approve). Dikirim sebagai baris terpisah per user (scope
// 'user'), bukan 'all', supaya tidak nyasar ke user lain yang tidak relevan.
export async function notifyUsersWithPermission(
  permissionKey: string,
  input: Omit<CreateNotificationInput, 'scope' | 'targetUser'>
) {
  try {
    const users = await getSheetData('users');
    const targets = users.filter((u: any) => u[permissionKey] === 'TRUE' && u.user_name);
    if (targets.length === 0) return;

    const now = toJakartaTimestamp();
    const rows = targets.map((u: any) => {
      const id = `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      return [
        id,
        'user',
        u.user_name,
        input.type,
        input.title,
        input.message,
        input.sourceFeature || '',
        input.sourceId || '',
        input.createdBy || '',
        now,
      ];
    });
    await appendSheetData('notifications', rows);
  } catch (err) {
    // Notifikasi gagal tidak boleh menggagalkan aksi utama (create/approve dll).
    console.error('Failed to notify users with permission', permissionKey, err);
  }
}

// Dipakai di titik-titik trigger (approve invoice, approve employee discount,
// dll) — dibungkus try/catch di pemanggil supaya kegagalan kirim notifikasi
// tidak pernah menggagalkan aksi utamanya.
export async function notifyUser(
  targetUser: string,
  input: Omit<CreateNotificationInput, 'scope' | 'targetUser'>
) {
  if (!targetUser) return;
  await createNotification({ ...input, scope: 'user', targetUser });
}
