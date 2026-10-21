import { createHash, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/server/env";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compara hashes de tamanho fixo em tempo constante: não vaza o token por timing. */
export function verifyBridgeAuth(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(getEnv().BRIDGE_TOKEN));
}
