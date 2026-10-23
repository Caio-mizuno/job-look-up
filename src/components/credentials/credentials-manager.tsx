"use client";

import { ExternalLink, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SaveCredentialResult } from "@/app/(app)/config/credenciais/actions";
import { CopyField } from "@/components/applications/application-kit";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { safeHttpUrl } from "@/lib/safe-url";
import type { CredentialInput, CredentialSummary } from "@/server/credentials/repo";
import { CREDENTIALS_COPY } from "./copy";
import { PasswordField, type RevealPassword } from "./password-field";

const C = CREDENTIALS_COPY;

export type CredentialActions = {
  save: (input: CredentialInput) => Promise<SaveCredentialResult>;
  remove: (id: number) => Promise<void>;
  reveal: RevealPassword;
};

/** Sites de vaga do app: o nome sugere o endereço do login. */
export type SiteSuggestion = { label: string; homepage: string };

type Form = { site: string; url: string; username: string; password: string; notes: string };
const EMPTY: Form = { site: "", url: "", username: "", password: "", notes: "" };

export function CredentialsManager({
  items,
  suggestions,
  actions,
}: {
  items: CredentialSummary[];
  suggestions: SiteSuggestion[];
  actions: CredentialActions;
}) {
  const [editing, setEditing] = useState<CredentialSummary | "new" | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{C.title}</CardTitle>
        <CardDescription>{C.description}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus />
            {C.add}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRound />
              </EmptyMedia>
              <EmptyTitle>{C.empty}</EmptyTitle>
              <EmptyDescription>{C.emptyHint}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <CredentialRow key={item.id} item={item} actions={actions} onEdit={() => setEditing(item)} />
            ))}
          </div>
        )}
      </CardContent>
      <CredentialDialog
        editing={editing}
        suggestions={suggestions}
        save={actions.save}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </Card>
  );
}

function CredentialRow({ item, actions, onEdit }: { item: CredentialSummary; actions: CredentialActions; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const href = item.url ? safeHttpUrl(item.url) : null;

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const remove = async () => {
    if (!confirming) return setConfirming(true);
    await actions.remove(item.id);
    toast.success(C.toast.removed);
  };

  return (
    <div className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,12rem)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">{item.site}</p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1 text-xs"
          >
            <span className="truncate">{new URL(href).hostname}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        )}
      </div>
      <CopyField label={C.row.login} value={item.username} />
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] uppercase tracking-wide">{C.row.password}</p>
        <PasswordField id={item.id} reveal={actions.reveal} />
      </div>
      <div className="flex gap-1 sm:justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil />
          {C.row.edit}
        </Button>
        <Button type="button" variant={confirming ? "destructive" : "ghost"} size="sm" onClick={() => void remove()}>
          <Trash2 />
          {confirming ? C.row.confirmRemove : C.row.remove}
        </Button>
      </div>
      {item.notes && <p className="text-muted-foreground text-xs sm:col-span-4">{item.notes}</p>}
    </div>
  );
}

function CredentialDialog({
  editing,
  suggestions,
  save,
  onOpenChange,
}: {
  editing: CredentialSummary | "new" | null;
  suggestions: SiteSuggestion[];
  save: CredentialActions["save"];
  onOpenChange: (open: boolean) => void;
}) {
  const existing = editing !== null && editing !== "new" ? editing : null;
  return (
    <Dialog open={editing !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Um formulário novo a cada abertura: começa limpo ou com os dados da credencial editada. */}
        <CredentialForm
          key={existing?.id ?? "new"}
          existing={existing}
          suggestions={suggestions}
          save={save}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CredentialForm({
  existing,
  suggestions,
  save,
  onDone,
}: {
  existing: CredentialSummary | null;
  suggestions: SiteSuggestion[];
  save: CredentialActions["save"];
  onDone: () => void;
}) {
  const [form, setForm] = useState<Form>(() =>
    existing
      ? { site: existing.site, url: existing.url ?? "", username: existing.username, password: "", notes: existing.notes ?? "" }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSite = (e: React.ChangeEvent<HTMLInputElement>) => {
    const site = e.target.value;
    const known = suggestions.find((s) => s.label.toLowerCase() === site.trim().toLowerCase());
    setForm((f) => ({ ...f, site, url: f.url || !known ? f.url : known.homepage }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await save(existing ? { ...form, id: existing.id } : form);
      if (!res.ok) return setError(res.error);
      toast.success(C.toast.saved);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{existing ? C.dialog.edit : C.dialog.create}</DialogTitle>
        <DialogDescription>{C.description}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="cred-site">{C.fields.site}</FieldLabel>
          <Input id="cred-site" list="cred-sites" value={form.site} onChange={onSite} placeholder={C.fields.sitePlaceholder} required />
          <datalist id="cred-sites">
            {suggestions.map((s) => (
              <option key={s.label} value={s.label} />
            ))}
          </datalist>
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-url">{C.fields.url}</FieldLabel>
          <Input id="cred-url" type="url" value={form.url} onChange={set("url")} placeholder={C.fields.urlPlaceholder} />
          <FieldDescription>{C.fields.urlHint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-username">{C.fields.username}</FieldLabel>
          <Input
            id="cred-username"
            autoComplete="off"
            value={form.username}
            onChange={set("username")}
            placeholder={C.fields.usernamePlaceholder}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-password">{C.fields.password}</FieldLabel>
          <Input
            id="cred-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            placeholder={existing ? C.fields.passwordKeep : undefined}
            required={!existing}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-notes">{C.fields.notes}</FieldLabel>
          <Textarea id="cred-notes" rows={2} value={form.notes} onChange={set("notes")} placeholder={C.fields.notesPlaceholder} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {C.dialog.cancel}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving ? C.dialog.saving : C.dialog.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
