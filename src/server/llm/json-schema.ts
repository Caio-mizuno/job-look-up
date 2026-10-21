import { z } from "zod";

type Json = { [k: string]: unknown };

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (k === "$schema") continue;
    out[k] = strictify(v);
  }
  // Structured outputs exigem objetos fechados.
  if (out.type === "object" && out.additionalProperties === undefined) out.additionalProperties = false;
  return out;
}

/** JSON Schema da entrada do zod (aceita transforms como o clamp da nota). */
export function toStrictJsonSchema(schema: z.ZodType): object {
  return strictify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })) as object;
}
