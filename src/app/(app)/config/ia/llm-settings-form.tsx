"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LlmProviderId } from "@/server/settings";
import { waitTask } from "@/lib/wait-task";
import { saveLlmSettings, testLlm } from "./actions";
import { IA_COPY } from "./copy";

export type LlmFormState = {
  provider: LlmProviderId;
  anthropicKeyLast4: string | null;
  openai: { baseUrl: string; model: string; apiKeyLast4: string | null } | null;
  dailyCallCap: number;
  usage: { calls: number; tokens: number };
};

export function LlmSettingsForm({ initial }: { initial: LlmFormState }) {
  const [provider, setProvider] = useState<LlmProviderId>(initial.provider);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.openai?.baseUrl ?? "http://host.docker.internal:11434/v1");
  const [model, setModel] = useState(initial.openai?.model ?? "");
  const [openaiKey, setOpenaiKey] = useState("");
  const [cap, setCap] = useState(String(initial.dailyCallCap));
  const [saving, startSaving] = useTransition();
  const [testing, setTesting] = useState(false);

  const save = () =>
    startSaving(async () => {
      const res = await saveLlmSettings({
        provider,
        anthropicApiKey: anthropicKey || undefined,
        openai: provider === "openai-compatible" ? { baseUrl, model, apiKey: openaiKey || undefined } : undefined,
        dailyCallCap: cap,
      });
      if (res.ok) {
        toast.success(IA_COPY.saved);
        setAnthropicKey("");
        setOpenaiKey("");
      } else toast.error(res.error);
    });

  const test = async () => {
    setTesting(true);
    try {
      const { taskId } = await testLlm();
      const task = await waitTask(taskId, { timeoutMs: 90_000 });
      const deferred = (task.result as { deferred?: boolean } | null)?.deferred;
      if (task.status === "done" && !deferred) toast.success(IA_COPY.testOk);
      else toast.error(IA_COPY.testFail(task.error ?? "ajudante desligado"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{IA_COPY.title}</CardTitle>
        <CardDescription>{IA_COPY.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{IA_COPY.provider}</FieldLabel>
            <Select value={provider} onValueChange={(v) => setProvider(v as LlmProviderId)}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IA_COPY.providers) as LlmProviderId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {IA_COPY.providers[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{IA_COPY.providerHints[provider]}</FieldDescription>
          </Field>

          {provider === "anthropic" && (
            <Field>
              <FieldLabel htmlFor="anthropic-key">{IA_COPY.anthropicKey}</FieldLabel>
              <Input
                id="anthropic-key"
                type="password"
                autoComplete="off"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-…"
              />
              {initial.anthropicKeyLast4 && (
                <FieldDescription>{IA_COPY.keepKey(initial.anthropicKeyLast4)}</FieldDescription>
              )}
            </Field>
          )}

          {provider === "openai-compatible" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="oa-url">{IA_COPY.baseUrl}</FieldLabel>
                <Input id="oa-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="oa-model">{IA_COPY.model}</FieldLabel>
                <Input id="oa-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3.1" />
              </Field>
              <Field>
                <FieldLabel htmlFor="oa-key">{IA_COPY.apiKey}</FieldLabel>
                <Input
                  id="oa-key"
                  type="password"
                  autoComplete="off"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                {initial.openai?.apiKeyLast4 && (
                  <FieldDescription>{IA_COPY.keepKey(initial.openai.apiKeyLast4)}</FieldDescription>
                )}
              </Field>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="cap">{IA_COPY.cap}</FieldLabel>
            <div className="w-40">
              <Input id="cap" type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} />
            </div>
            <FieldDescription>{IA_COPY.capHint}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-auto text-xs tabular-nums">
          {IA_COPY.usage(initial.usage.calls, initial.usage.tokens)}
        </span>
        <Button variant="outline" onClick={test} disabled={testing}>
          {testing ? IA_COPY.testing : IA_COPY.test}
        </Button>
        <Button onClick={save} disabled={saving}>
          {IA_COPY.save}
        </Button>
      </CardFooter>
    </Card>
  );
}
