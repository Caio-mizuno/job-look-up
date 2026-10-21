import { emptyProfile, type Profile } from "@/server/profile/schema";

/** Perfil completo e pronto para busca, usado em vários testes. */
export function sampleProfile(overrides: Partial<Profile> = {}): Profile {
  const p = emptyProfile();
  return {
    ...p,
    personal: { ...p.personal, name: "Caio Mizuno", email: "caio@example.com", city: "São Paulo", state: "SP", country: "Brasil" },
    headline: "Desenvolvedor Full Stack",
    experiences: [
      {
        title: "Desenvolvedor Full Stack",
        company: "MizunoTech",
        start: "2022-01",
        end: null,
        workModel: "remote",
        description: "Plataforma multi-tenant de ingressos.",
        technologies: ["Laravel", "Next.js", "PostgreSQL", "Docker"],
      },
    ],
    skills: [
      { name: "Laravel", years: 6, level: "avancado" },
      { name: "Next.js", years: 3, level: "avancado" },
      { name: "PostgreSQL", years: 5, level: "intermediario" },
    ],
    preferences: {
      ...p.preferences,
      roles: ["Desenvolvedor Full Stack"],
      seniorities: ["senior"],
      workModels: ["remote"],
      contracts: ["clt", "pj"],
    },
    ...overrides,
  };
}
