import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // lib/neon.ts butuh DATABASE_URL saat di-import (tidak benar-benar konek).
    env: { DATABASE_URL: "postgres://test:test@localhost/test", AUTH_SECRET: "test-secret-for-vitest" },
  },
});
