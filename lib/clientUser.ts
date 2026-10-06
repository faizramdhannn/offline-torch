import { PERMISSION_KEYS, type UserRow } from "./users";

// Bentuk user yang disimpan di browser (login + penyegaran lewat /api/auth/me).
export function toClientUser(user: UserRow) {
  const out: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    user_name: user.user_name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    photo_url: user.photo_url,
    role: user.role,
    is_super_admin: user.role === "super_admin",
  };
  for (const k of PERMISSION_KEYS) out[k] = user[k] === "TRUE";
  return out;
}
