"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { regenerateQueries, saveSearchQueries } from "@/app/(app)/vagas/search-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isUsableKeywords, KEYWORDS_LINK_ERROR } from "@/lib/search-keywords";
import type { SearchQuery } from "@/server/sources/types";
import { SectionHeader } from "./inputs";

export function SearchQueriesEditor({ initial }: { initial: (SearchQuery & { origin: "ai" | "user" })[] }) {
  const [items, setItems] = useState<SearchQuery[]>(initial.map(({ keywords, location }) => ({ keywords, location })));
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<SearchQuery>) => setItems(items.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const invalid = items.some((q) => !isUsableKeywords(q.keywords));

  return (
    <section className="mt-6 flex flex-col gap-3 border-t pt-6">
      <SectionHeader
        title="Consultas de busca"
        description={
          initial.some((q) => q.origin === "user")
            ? "Editadas por você: a IA não mexe nelas."
            : "Geradas pela IA a partir do seu perfil. Edite à vontade."
        }
      />
      {items.map((q, i) => (
        <div key={i} className="grid grid-cols-[1fr_10rem_2rem] gap-2">
          <Input
            aria-label="Palavras-chave"
            placeholder="Cargo ou tecnologia, ex.: desenvolvedor react"
            aria-invalid={!isUsableKeywords(q.keywords)}
            value={q.keywords}
            onChange={(e) => update(i, { keywords: e.target.value })}
          />
          <Input
            aria-label="Cidade (opcional)"
            placeholder="Cidade (opcional)"
            value={q.location ?? ""}
            onChange={(e) => update(i, { location: e.target.value || null })}
          />
          <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setItems(items.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
          {!isUsableKeywords(q.keywords) && <p className="text-destructive col-span-3 -mt-1 text-xs">{KEYWORDS_LINK_ERROR}</p>}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={items.length >= 6}
          onClick={() => setItems([...items, { keywords: "", location: null }])}
        >
          <Plus />
          Adicionar consulta
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await regenerateQueries();
              toast.success("Gerando consultas com a IA; uma nova busca começa em seguida.");
            })
          }
        >
          <Sparkles />
          Gerar com IA
        </Button>
        <Button
          className="ml-auto"
          disabled={pending || invalid}
          onClick={() =>
            start(async () => {
              const res = await saveSearchQueries(items.filter((q) => q.keywords.trim()));
              if (res.ok) toast.success("Consultas salvas");
              else toast.error(res.error);
            })
          }
        >
          Salvar consultas
        </Button>
      </div>
    </section>
  );
}
