import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/server/crypto";

const key = "a".repeat(64);

describe("crypto", () => {
  it("roundtrips", () => {
    expect(decrypt(encrypt("segredo", key), key)).toBe("segredo");
  });

  it("prefixes v1", () => {
    expect(encrypt("x", key)).toMatch(/^v1:/);
  });

  it("rejects tamper", () => {
    const blob = encrypt("x", key);
    expect(() => decrypt(blob.slice(0, -2) + "AA", key)).toThrow();
  });

  it("rejects wrong key", () => {
    expect(() => decrypt(encrypt("x", key), "b".repeat(64))).toThrow();
  });
});
