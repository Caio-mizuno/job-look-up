export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Filtro local para fontes sem busca: casa se qualquer palavra (≥ 3 letras) aparece inteira no texto. */
export function matchesKeywords(text: string, keywords: string): boolean {
  const hay = normalizeText(text);
  const tokens = normalizeText(keywords)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  return tokens.some((t) => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`).test(hay));
}
