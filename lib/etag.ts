import { createHash } from "crypto";
import { NextResponse } from "next/server";

// JSON dengan ETag: bila isi sama dengan yang sudah dimiliki browser (If-None-Match),
// balas 304 tanpa body — menghemat Fast Origin Transfer pada data besar yang sering di-poll.
// `private, no-cache` = browser wajib validasi ulang, tapi tidak mengunduh ulang bila belum berubah.
export function jsonWithEtag(request: Request, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status, headers: { ...headers, "Content-Type": "application/json" } });
}
