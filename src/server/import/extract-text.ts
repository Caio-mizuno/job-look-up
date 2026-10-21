import { extractText as pdfText, getDocumentProxy } from "unpdf";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_CHARS = 40_000;
const MIN_USEFUL_CHARS = 50;

export class ImportError extends Error {
  constructor(public readonly code: "unsupported" | "too_large" | "no_text") {
    super(code);
  }
}

export async function extractText(file: { name: string; bytes: Uint8Array }): Promise<string> {
  if (file.bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportError("too_large");
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  let text: string;
  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
    text = (await pdfText(pdf, { mergePages: true })).text;
  } else if (["md", "markdown", "txt"].includes(ext)) {
    text = new TextDecoder("utf-8").decode(file.bytes);
  } else {
    throw new ImportError("unsupported");
  }

  // PDF escaneado vira imagem: sem texto extraível, a IA não tem o que ler.
  if (text.replace(/\s+/g, "").length < MIN_USEFUL_CHARS) throw new ImportError("no_text");
  return text.slice(0, MAX_IMPORT_CHARS);
}
