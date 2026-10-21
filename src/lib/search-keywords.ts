/** Palavra-chave de busca é cargo ou tecnologia: link ou e-mail vira busca sem sentido nos sites de vaga. */
export function isUsableKeywords(keywords: string): boolean {
  return !/https?:\/\/|\bwww\.|\.com(\.br)?\b|\S+@\S+\.\S+/i.test(keywords);
}

export const KEYWORDS_LINK_ERROR = "Use cargo ou tecnologia (ex.: desenvolvedor react), não link nem e-mail.";
