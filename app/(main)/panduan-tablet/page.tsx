"use client";

// Panduan setup tablet toko untuk dikirim ke staf (halaman statis: tanpa panggilan ke server).
const STEPS: { title: string; body: string }[] = [
  { title: "Colok charger", body: "Tablet harus selalu tercolok listrik. Layar menyala terus akan menguras baterai." },
  { title: "Buka aplikasi di Chrome", body: "Buka alamat aplikasi (offline-torch.vercel.app) di Chrome, lalu login dengan akun toko." },
  { title: "Pasang ikon di layar utama", body: "Ketuk menu ⋮ di Chrome → Add to Home screen. Setelah itu buka aplikasi dari ikon tersebut supaya tampil layar penuh." },
  { title: "Ketuk layar sekali", body: "Setelah aplikasi terbuka, ketuk layar satu kali agar musik diizinkan berbunyi. Kalau muncul tombol \"Ketuk untuk memulai musik\", ketuk tombol itu." },
  { title: "Jangan matikan layar", body: "Boleh diredupkan, tapi jangan ditekan tombol power. Jangan menutup aplikasi dan jangan pindah ke aplikasi lain, karena musik bisa berhenti." },
  { title: "Volume tablet", body: "Atur volume tablet sekitar 70%. Naik-turun volume selanjutnya diatur dari pusat." },
];

const OPTIONAL: { title: string; body: string }[] = [
  { title: "Layar tidak mati sendiri (opsional)", body: "Pengaturan → Tentang tablet → ketuk Nomor build 7 kali → Developer options → aktifkan \"Stay awake\". Layar tetap menyala selama tablet dicolok." },
  { title: "Kunci aplikasi (opsional)", body: "Pengaturan → Keamanan → App pinning (Android) atau Guided Access (iPad) agar aplikasi tidak tertutup tidak sengaja." },
];

export default function PanduanTabletPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="text-lg font-semibold text-gray-800">Panduan Setup Tablet Toko</h1>
      <p className="mb-5 text-xs text-gray-500">Lakukan sekali saat tablet pertama dipasang, atau setelah tablet restart.</p>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">{i + 1}</span>
            <div>
              <p className="text-sm font-medium text-gray-800">{s.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-700">Tambahan</h2>
      <div className="space-y-3">
        {OPTIONAL.map((s) => (
          <div key={s.title} className="rounded-xl border border-dashed border-gray-300 p-4">
            <p className="text-sm font-medium text-gray-700">{s.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-gray-400">Kalau musik berhenti: buka aplikasi lagi dan ketuk layar sekali. Kalau tetap tidak bunyi, hubungi pusat.</p>
    </div>
  );
}
