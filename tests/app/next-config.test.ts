import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { MAX_IMPORT_BYTES } from "@/server/import/extract-text";

describe("next.config", () => {
  it("server actions accept uploads up to the import limit", () => {
    const limit = String(nextConfig.experimental?.serverActions?.bodySizeLimit ?? "1mb");
    const mb = Number(/^(\d+)mb$/i.exec(limit)?.[1] ?? 1);
    expect(mb * 1024 * 1024).toBeGreaterThan(MAX_IMPORT_BYTES);
  });
});
