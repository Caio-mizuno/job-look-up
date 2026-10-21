import { describe, expect, it } from "vitest";
import { isUsableKeywords } from "@/lib/search-keywords";

describe("isUsableKeywords", () => {
  it("accepts roles and technologies, including dotted names", () => {
    for (const k of ["desenvolvedor react", "Node.js", "Socket.io", "ASP.NET", "engenheiro de dados sênior"]) {
      expect(isUsableKeywords(k)).toBe(true);
    }
  });

  it("rejects links and e-mails", () => {
    for (const k of [
      "https://www.linkedin.com/in/caio-mizuno/",
      "www.linkedin.com/in/caio-mizuno",
      "linkedin.com/in/caio-mizuno",
      "caio@gmail.com",
    ]) {
      expect(isUsableKeywords(k)).toBe(false);
    }
  });
});
