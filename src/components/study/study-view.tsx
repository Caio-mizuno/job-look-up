"use client";

import { Check, RefreshCw, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { generateStudyAction } from "@/app/(app)/estudo/actions";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { waitTask, type TaskView } from "@/lib/wait-task";
import type { StudyPlan, StudyTopic } from "@/server/study/generate";
import type { TechStats, ThemeStat } from "@/server/study/stats";
import { STUDY_COPY as C, orList, percent } from "./copy";

// A IA escreve vários temas de uma vez: espera mais que o padrão de 2 minutos.
const waitLong = (taskId: number) => waitTask(taskId, { timeoutMs: 300_000 });

export function StudyView({
  stats,
  initial,
  generate = generateStudyAction,
  wait = waitLong,
}: {
  stats: TechStats;
  initial: StudyPlan | null;
  generate?: () => Promise<{ taskId: number }>;
  wait?: (taskId: number) => Promise<TaskView>;
}) {
  const [plan, setPlan] = useState(initial);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const { taskId } = await generate();
      const task = await wait(taskId);
      const result = task.result as { plan?: StudyPlan; deferred?: boolean; skipped?: string } | null;
      if (task.status === "done" && result?.plan) setPlan(result.plan);
      else if (result?.skipped) toast.error(C.noTech);
      else toast.error(result?.deferred ? C.deferred : C.failed(task.error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{C.statsTitle}</CardTitle>
          <CardDescription>{C.statsDescription(stats.totalJobs)}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.themes.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {stats.themes.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} total={stats.totalJobs} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{C.noJobs}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{C.planTitle}</CardTitle>
          <CardDescription>{C.planDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {plan ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground text-xs">{C.generatedAt(plan.updatedAt, plan.totalJobs)}</p>
                <Button variant="outline" className="ml-auto" onClick={() => setConfirming(true)} disabled={generating}>
                  <RefreshCw className={generating ? "animate-spin" : undefined} />
                  {generating ? C.generating : C.regenerate}
                </Button>
              </div>
              {plan.topics.map((topic, i) => (
                <TopicDetails key={topic.themeId} topic={topic} open={i === 0} />
              ))}
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">{C.empty}</p>
              <Button onClick={runGenerate} disabled={generating || !stats.themes.length}>
                <Sparkles />
                {generating ? C.generating : C.generate}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerar de novo substitui o material atual: só depois de confirmar. */}
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
    </div>
  );
}

function ThemeCard({ theme, total }: { theme: ThemeStat; total: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{theme.label}</h3>
        <Badge variant={theme.priority === "lacuna" ? "destructive" : "secondary"}>{C.priority[theme.priority]}</Badge>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">{C.ofJobs(percent(theme.jobs, total))}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {theme.techs.map((tech) => (
          <li key={tech.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span>{tech.name}</span>
              {tech.inProfile ? (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Check className="size-3" />
                  {C.inProfile}
                </span>
              ) : null}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">{percent(tech.jobs, total)}</span>
            </div>
            <Progress value={total ? (tech.jobs / total) * 100 : 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopicDetails({ topic, open }: { topic: StudyTopic; open: boolean }) {
  const s = C.sections;
  return (
    <details open={open} className="group rounded-lg border p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className="font-medium">{topic.theme.label}</span>
        <span className="text-muted-foreground text-sm">({orList(topic.theme.techs.slice(0, 5).map((t) => t.name))})</span>
        <Badge variant={topic.theme.priority === "lacuna" ? "destructive" : "secondary"}>{C.priority[topic.theme.priority]}</Badge>
      </summary>
      <div className="mt-4 flex flex-col gap-4 text-sm">
        <p>{topic.summary}</p>
        <Block title={s.concepts} items={topic.concepts} />
        {topic.options.length ? (
          <Block title={s.options}>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {topic.options.map((o) => (
                <li key={o.name}>
                  <span className="font-medium">{o.name}:</span> {o.whenToUse}
                </li>
              ))}
            </ul>
          </Block>
        ) : null}
        <Block title={s.steps} items={topic.steps} ordered />
        <Block title={s.interview} items={topic.interview} />
        <Block title={s.exercise}>
          <p>{topic.exercise}</p>
        </Block>
        {topic.docs.length ? (
          <Block title={s.docs}>
            <p className="text-muted-foreground">{topic.docs.join(" · ")}</p>
          </Block>
        ) : null}
      </div>
    </details>
  );
}

function Block({ title, items, ordered, children }: { title: string; items?: string[]; ordered?: boolean; children?: ReactNode }) {
  if (items && !items.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</h4>
      {items ? (
        <List className={`flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      ) : (
        children
      )}
    </div>
  );
}
