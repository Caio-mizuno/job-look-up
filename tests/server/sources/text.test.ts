import { describe, expect, it } from "vitest";
import { htmlToText } from "@/server/sources/text";

describe("htmlToText", () => {
  it("strips tags and keeps list lines", () => {
    expect(htmlToText("<ul><li>A</li><li>B</li></ul><script>x</script>")).toBe("A\nB");
  });

  it("turns br and paragraphs into lines and collapses spaces", () => {
    expect(htmlToText("<p>Olá   mundo</p><p>linha<br>dois</p>")).toBe("Olá mundo\nlinha\ndois");
  });

  it("keeps plain text as is", () => {
    expect(htmlToText("Texto simples\ncom quebra")).toBe("Texto simples\ncom quebra");
  });
});
