import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, ImportError } from "@/server/import/extract-text";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../../fixtures/import/${name}`, import.meta.url)));
const text = (s: string) => new TextEncoder().encode(s);
const long = "Desenvolvedor Laravel com experiência em Next.js e PostgreSQL. ".repeat(3);

async function code(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ImportError ? e.code : String(e);
  }
}

describe("extractText", () => {
  it("reads md and txt", async () => {
    expect(await extractText({ name: "perfil.md", bytes: text(`# Caio\n${long}`) })).toContain("Laravel");
    expect(await extractText({ name: "cv.TXT", bytes: text(long) })).toContain("Next.js");
  });

  it("reads pdf text", async () => {
    const out = await extractText({ name: "cv.pdf", bytes: fixture("cv-text.pdf") });
    expect(out).toContain("Laravel");
    expect(out).toContain("MizunoTech");
  });

  it("unsupported .docx", async () => {
    expect(await code(extractText({ name: "cv.docx", bytes: text(long) }))).toBe("unsupported");
  });

  it("too_large over 5MB", async () => {
    expect(await code(extractText({ name: "cv.txt", bytes: new Uint8Array(5 * 1024 * 1024 + 1) }))).toBe("too_large");
  });

  it("no_text for image-only pdf", async () => {
    expect(await code(extractText({ name: "scan.pdf", bytes: fixture("cv-image-only.pdf") }))).toBe("no_text");
  });

  it("truncates to 40000 chars", async () => {
    const out = await extractText({ name: "big.md", bytes: text("a".repeat(50_000)) });
    expect(out).toHaveLength(40_000);
  });
});
