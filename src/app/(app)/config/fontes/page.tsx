import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageDb } from "@/server/page-db";
import { getSourceStates } from "@/server/sources/settings";
import { getStatus } from "@/server/status";
import { SOURCES_COPY } from "./copy";
import { SourceRow } from "./source-row";

export const metadata: Metadata = { title: "Fontes de vaga" };

export default async function FontesPage() {
  const db = await pageDb();
  const run = getStatus(db, 0).run;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SOURCES_COPY.title}</CardTitle>
        <CardDescription>{SOURCES_COPY.description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {getSourceStates(db).map((s) => (
          <SourceRow key={s.id} source={s} lastCount={run?.perSource[s.id]?.count ?? null} />
        ))}
      </CardContent>
    </Card>
  );
}
