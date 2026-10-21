import * as cheerio from "cheerio";

const BLOCKS = "p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, tr, section, article, header, footer, blockquote, pre";

/** HTML raspado vira texto puro: nunca renderizamos HTML de terceiros. */
export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return normalizeLines(html);
  const $ = cheerio.load(`<body>${html}</body>`);
  $("script, style, noscript, iframe, svg").remove();
  $("br").replaceWith("\n");
  $(BLOCKS).each((_, el) => {
    $(el).prepend("\n").append("\n");
  });
  return normalizeLines($("body").text());
}

function normalizeLines(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
