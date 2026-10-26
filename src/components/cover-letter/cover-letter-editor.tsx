"use client";

import { Copy, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateCoverLetterAction, saveCoverLetterAction } from "@/app/(app)/carta/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { waitTask, type TaskView } from "@/lib/wait-task";
import type { CoverLetter } from "@/server/settings";
import { COVER_LETTER_COPY as C } from "./copy";

export function CoverLetterEditor({
  initial,
  generate = generateCoverLetterAction,
  wait = waitTask,
  save = saveCoverLetterAction,
}: {
  initial: CoverLetter | null;
  generate?: () => Promise<{ taskId: number }>;
  wait?: (taskId: number) => Promise<TaskView>;
  save?: (text: string) => Promise<{ ok: true }>;
}) {
  const [letter, setLetter] = useState(initial);
  const [text, setText] = useState(initial?.text ?? "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const { taskId } = await generate();
      const task = await wait(taskId);
      const result = task.result as { text?: string; deferred?: boolean } | null;
      if (task.status === "done" && result?.text) {
        setLetter({ text: result.text, updatedAt: Date.now() });
        setText(result.text);
      } else toast.error(result?.deferred ? C.deferred : C.failed(task.error));
    } finally {
      setGenerating(false);
    }
  };

  const runSave = async () => {
    setSaving(true);
    try {
      await save(text);
      setLetter({ text: text.trim(), updatedAt: Date.now() });
      toast.success(C.saved);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success(C.copied);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{C.title}</CardTitle>
        <CardDescription>{C.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {letter ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cover-letter">{C.label}</Label>
              <Textarea
                id="cover-letter"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={18}
                disabled={generating}
              />
              <p className="text-muted-foreground text-xs">{C.updatedAt(letter.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runSave} disabled={saving || generating || !text.trim()}>
                <Save />
                {C.save}
              </Button>
              <Button variant="outline" onClick={copy} disabled={!text.trim()}>
                <Copy />
                {C.copy}
              </Button>
              <Button variant="outline" className="ml-auto" onClick={() => setConfirming(true)} disabled={generating}>
                <RefreshCw className={generating ? "animate-spin" : undefined} />
                {generating ? C.generating : C.regenerate}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">{C.empty}</p>
            <Button onClick={runGenerate} disabled={generating}>
              <Sparkles />
              {generating ? C.generating : C.generate}
            </Button>
          </div>
        )}
      </CardContent>
      {/* Gerar de novo apaga as edições: só depois de confirmar. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{C.confirmTitle}</DialogTitle>
            <DialogDescription>{C.confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{C.cancel}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirming(false);
                void runGenerate();
              }}
            >
              {C.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
