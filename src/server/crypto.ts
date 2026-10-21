import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function keyBuffer(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("chave precisa ter 32 bytes (64 hex)");
  return key;
}

export function encrypt(plain: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuffer(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(blob: string, keyHex: string): string {
  const [version, iv, tag, ct] = blob.split(":");
  if (version !== "v1" || !iv || !tag || ct === undefined) throw new Error("formato de segredo inválido");
  const decipher = createDecipheriv(ALGO, keyBuffer(keyHex), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
