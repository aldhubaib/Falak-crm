"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flag, HelpCircle, LayoutGrid, Type as TypeIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import { createFullTask } from "@/actions/projects";
import { PriorityPicker } from "@/components/projects/priority-picker";

type Field = { id: string; name: string; type: string; mandatory: boolean };
type TaskType = { id: string; name: string; count: number; fields: Field[] };

const isTextField = (type: string) =>
  type === "textarea" || type === "text" || type === "link";

export function NewTaskClient({
  projectId,
  projectName,
  defaultStatusId,
  taskTypes,
}: {
  projectId: string;
  projectName: string;
  defaultStatusId: string | null;
  taskTypes: TaskType[];
}) {
  const router = useRouter();
  const [typeId, setTypeId] = useState<string>(taskTypes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { execute, loading } = useAction(createFullTask);

  const type = taskTypes.find((t) => t.id === typeId);
  const canSave = !!typeId && title.trim().length > 0 && !!defaultStatusId;

  const create = async () => {
    if (!canSave) return;
    const res = await execute({
      projectId,
      title: title.trim(),
      statusId: defaultStatusId!,
      priority,
      templateIds: [typeId],
      answers,
    });
    if (res) router.push(`/projects/${projectId}/tasks/${res.id}`);
  };

  return (
    <>
      <AppHeader
        backHref={`/projects/${projectId}`}
        title={
          <div className="truncate text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{projectName}</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-foreground">New Task</span>
          </div>
        }
        actions={<SaveButton onClick={create} disabled={!canSave || loading} />}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto max-w-3xl">
          <Section
            icon={<LayoutGrid className="size-4" />}
            title="Task Type"
            hint="Pick a template — its questions and delivery fields will be added."
          >
            {taskTypes.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                This project has no task templates.{" "}
                <Link href="/settings/task-types" className="text-primary underline">
                  Add one in Settings
                </Link>
                .
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {taskTypes.map((t) => {
                  const on = t.id === typeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTypeId(t.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                        on
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/60 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {t.name}
                      <span className="text-muted-foreground">{t.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            icon={<TypeIcon className="size-4" />}
            title="Task Title"
            hint="A short, clear summary of what needs to be done."
          >
            <Input
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-background/60"
            />
          </Section>

          <Section
            icon={<Flag className="size-4" />}
            title="Priority"
            hint="1 is highest priority. Leave empty if unsure."
          >
            <PriorityPicker value={priority} onChange={setPriority} />
            {priority === null && (
              <div className="mt-2 text-xs text-muted-foreground">
                No priority selected
              </div>
            )}
          </Section>

          {type && type.fields.length > 0 && (
            <Section
              icon={<HelpCircle className="size-4" />}
              title={`${type.name} Questions`}
              hint="Fill in the required information for this task template."
            >
              <div className="space-y-4">
                {type.fields.map((f, i) => (
                  <div key={f.id}>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
                      <span className="grid size-5 place-items-center rounded-md bg-surface text-tiny text-muted-foreground">
                        {i + 1}
                      </span>
                      {f.name}
                      {f.mandatory && <span className="text-destructive">*</span>}
                    </label>
                    {isTextField(f.type) ? (
                      <Textarea
                        placeholder="Type your answer…"
                        value={answers[f.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                        className="min-h-20 rounded-xl border-border/60 bg-background/60"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 px-3 py-2.5 text-xs text-muted-foreground">
                        You&apos;ll complete this on the task page after creating.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </PageContainer>
      </main>
    </>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {hint && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}
