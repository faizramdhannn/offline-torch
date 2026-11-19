"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Cache data di browser (TanStack Query): halaman yang pernah dibuka tampil instan dan tidak memanggil server lagi
// selama data masih "segar" (staleTime) — hemat invocation Vercel. Tidak ada polling/refetch otomatis saat fokus.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 } } })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
