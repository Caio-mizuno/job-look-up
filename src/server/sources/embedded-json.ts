/**
 * Objeto JSON embutido num script (`x = {...};`): lê de `from` até a chave que fecha, respeitando strings.
 * Devolve null quando não há objeto ali ou ele não é JSON válido.
 */
export function readEmbeddedJson(text: string, from: number): unknown {
  if (text[from] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(from, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
