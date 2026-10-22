import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: imagem Docker enxuta, sem node_modules completo para o app.
  output: "standalone",
  // better-sqlite3 é módulo nativo; precisa do require do Node, não do bundler.
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  experimental: {
    // Import de currículo e upload de CV vão até 5 MB (+ overhead do multipart).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
