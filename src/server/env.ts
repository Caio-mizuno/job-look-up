import { z } from "zod";

const EnvSchema = z.object({
  APP_KEY: z.string().regex(/^[0-9a-f]{64}$/, "APP_KEY precisa ter 64 caracteres hex (rode make setup)"),
  BRIDGE_TOKEN: z.string().min(32, "BRIDGE_TOKEN precisa ter ao menos 32 caracteres (rode make setup)"),
  DATA_DIR: z.string().default("./data"),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Lido de forma preguiçosa: testes e o build do Next não têm .env carregado. */
export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}
