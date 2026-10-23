export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Conta quantas palavras (≥ 3 letras) das palavras-chave aparecem inteiras no texto; compila uma vez para listas grandes. */
export function keywordMatcher(keywords: string): (text: string) => number {
  const tokens = [
    ...new Set(
      normalizeText(keywords)
        .split(/\s+/)
        .filter((t) => t.length >= 3),
    ),
  ].map((t) => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`));
  return (text) => {
    const hay = normalizeText(text);
    return tokens.filter((re) => re.test(hay)).length;
  };
}

/** Filtro local para fontes sem busca: casa se qualquer palavra (≥ 3 letras) aparece inteira no texto. */
export function matchesKeywords(text: string, keywords: string): boolean {
  return keywordMatcher(keywords)(text) > 0;
}
