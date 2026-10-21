#!/usr/bin/env node
// Gera as fixtures de PDF usadas nos testes de importação (rodar uma vez; o resultado é versionado).
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const dir = new URL("../tests/fixtures/import/", import.meta.url);

const withText = await PDFDocument.create();
const font = await withText.embedFont(StandardFonts.Helvetica);
const page = withText.addPage([595, 842]);
const lines = [
  "Caio Mizuno - Desenvolvedor Full Stack",
  "caio@example.com - Sao Paulo, SP",
  "Experiencia: MizunoTech (2022 - atual) - Laravel, Next.js, PostgreSQL, Redis, Docker.",
  "Plataforma multi-tenant de ingressos com PDV, totem e integracao com gateways de pagamento.",
  "Habilidades: PHP, Laravel, TypeScript, React, Next.js, Vue, PostgreSQL, Docker.",
];
lines.forEach((line, i) => page.drawText(line, { x: 40, y: 800 - i * 18, size: 11, font }));
writeFileSync(new URL("cv-text.pdf", dir), await withText.save());

const imageOnly = await PDFDocument.create();
imageOnly.addPage([595, 842]);
writeFileSync(new URL("cv-image-only.pdf", dir), await imageOnly.save());

console.log("fixtures geradas em tests/fixtures/import/");
