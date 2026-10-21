import { describe, expect, it } from "vitest";
import { matchesKeywords } from "@/server/sources/match";

describe("matchesKeywords", () => {
  it("ignores accents/case and short tokens", () => {
    expect(matchesKeywords("Desenvolvedor Sênior PHP", "senior laravel")).toBe(true);
    expect(matchesKeywords("Designer", "go")).toBe(false);
  });

  it("matches whole words only", () => {
    expect(matchesKeywords("Full Stack Developer", "full stack")).toBe(true);
    expect(matchesKeywords("Javascript Engineer", "java")).toBe(false);
    expect(matchesKeywords("Next.js Developer", "next.js")).toBe(true);
  });
});
