"use client";

import { Copy, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { RevealResult } from "@/app/(app)/config/credenciais/actions";
import { Button } from "@/components/ui/button";
import { CREDENTIALS_COPY } from "./copy";

const C = CREDENTIALS_COPY.password;
// A senha à mostra some sozinha: não fica aberta na tela esquecida.
const AUTO_HIDE_MS = 30_000;

export type RevealPassword = (id: number) => Promise<RevealResult>;

/** Senha mascarada; só busca o texto no servidor quando a pessoa pede. */
export function PasswordField({ id, reveal }: { id: number; reveal: RevealPassword }) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shown === null) return;
    const t = setTimeout(() => setShown(null), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [shown]);

  const fetchPassword = async (): Promise<string | null> => {
    setBusy(true);
    try {
      const res = await reveal(id);
      if (res.ok) return res.password;
      toast.error(res.error);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (shown !== null) return setShown(null);
    setShown(await fetchPassword());
  };

  const copy = async () => {
    const password = shown ?? (await fetchPassword());
    if (password === null) return;
    await navigator.clipboard.writeText(password);
    toast.success(C.copied);
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 flex-1 font-mono text-sm break-all" data-testid={`password-${id}`}>
        {shown ?? C.masked}
      </span>
      <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={shown === null ? C.show : C.hide} onClick={() => void toggle()}>
        {shown === null ? <Eye /> : <EyeOff />}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={C.copy} onClick={() => void copy()}>
        <Copy />
      </Button>
    </div>
  );
}
