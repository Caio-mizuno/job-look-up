import type { Metadata } from "next";
import { CredentialsManager } from "@/components/credentials/credentials-manager";
import { listCredentials } from "@/server/credentials/repo";
import { pageDb } from "@/server/page-db";
import { SOURCES } from "@/server/sources/registry";
import { deleteCredentialAction, revealPasswordAction, saveCredentialAction } from "./actions";

export const metadata: Metadata = { title: "Credenciais" };

export default async function CredenciaisPage() {
  const db = await pageDb();
  // A lista vai para o navegador sem senha; ela só sai pelo revealPasswordAction.
  return (
    <CredentialsManager
      items={listCredentials(db)}
      suggestions={SOURCES.map((s) => ({ label: s.label, homepage: s.homepage }))}
      actions={{ save: saveCredentialAction, remove: deleteCredentialAction, reveal: revealPasswordAction }}
    />
  );
}
