// Siapa yang boleh melihat satu baris Request Shipment (untuk user tanpa izin tracking_edit):
// pembuat request (request_by), toko pengirim (sender), dan toko penerima (receiver).
// Murni (tanpa DB) supaya bisa dites.

// "Torch Cirebon", "torch cirebon", "cirebon", "cirebon." → "cirebon": nama toko & user_name akun toko sering beda awalan "Torch".
export function normStore(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/^\s*torch\b/, "")
    .replace(/[^a-z0-9]+/g, "");
}

// Penerima berformat "Nama toko\nHP\nAlamat" (dari daftar toko) atau teks bebas; nama = baris pertama.
export function receiverStoreName(receiver: unknown): string {
  return String(receiver ?? "").split(/\r?\n/)[0].trim();
}

export function canSeeShipment(row: { request_by?: unknown; sender?: unknown; receiver?: unknown }, userName: string): boolean {
  const me = normStore(userName);
  if (!me) return false;
  return (
    String(row.request_by ?? "") === userName ||
    normStore(row.request_by) === me ||
    normStore(row.sender) === me ||
    normStore(receiverStoreName(row.receiver)) === me
  );
}
