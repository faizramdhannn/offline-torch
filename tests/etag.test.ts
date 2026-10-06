import { describe, it, expect } from "vitest";
import { jsonWithEtag } from "@/lib/etag";

describe("jsonWithEtag", () => {
  it("balas 200 + ETag, lalu 304 tanpa body bila If-None-Match sama", async () => {
    const data = [{ a: 1 }, { a: 2 }];
    const first = jsonWithEtag(new Request("http://x/api/y"), data);
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag")!;
    expect(first.headers.get("cache-control")).toContain("private");
    expect(await first.json()).toEqual(data);

    const second = jsonWithEtag(new Request("http://x/api/y", { headers: { "if-none-match": etag } }), data);
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("data berubah → ETag berbeda dan 200", () => {
    const e1 = jsonWithEtag(new Request("http://x"), { v: 1 }).headers.get("etag")!;
    const r = jsonWithEtag(new Request("http://x", { headers: { "if-none-match": e1 } }), { v: 2 });
    expect(r.status).toBe(200);
    expect(r.headers.get("etag")).not.toBe(e1);
  });
});
