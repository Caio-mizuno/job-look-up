import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: imagem Docker enxuta, sem node_modules completo para o app.
  output: "standalone",
  // better-sqlite3 é módulo nativo; precisa do require do Node, não do bundler.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
