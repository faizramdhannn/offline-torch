import { createHash } from "crypto";
import { NextResponse } from "next/server";

// JSON dengan ETag: bila isi sama dengan yang sudah dimiliki browser (If-None-Match),
// balas 304 tanpa body — menghemat Fast Origin Transfer pada data besar yang sering di-poll.
// `private, no-cache` = browser wajib validasi ulang, tapi tidak mengunduh ulang bila belum berubah.
// `memo` (opt-in): data yang SAMA (referensi array/objek sama, mis. hasil olahan yang di-cache) tidak di-stringify &
// di-hash ulang — hemat CPU untuk balasan besar. Pakai hanya bila objek itu tidak pernah diubah setelah dikirim.
const memoStore = new WeakMap<object, { body: string; etag: string }>();
export function jsonWithEtag(request: Request, data: unknown, status = 200, memo = false) {
  let hit = memo && data && typeof data === "object" ? memoStore.get(data as object) : undefined;
  if (!hit) {
    const body = JSON.stringify(data);
    hit = { body, etag: `"${createHash("sha1").update(body).digest("base64url")}"` };
    if (memo && data && typeof data === "object") memoStore.set(data as object, hit);
  }
  const { body, etag } = hit;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status, headers: { ...headers, "Content-Type": "application/json" } });
}
