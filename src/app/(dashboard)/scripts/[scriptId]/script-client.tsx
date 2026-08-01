"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  Trash2,
  Video,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActionHandler } from "@/hooks/use-action";
import { useErrorStore } from "@/lib/error-store";
import type { ActionResult } from "@/lib/action";
import {
  addSource,
  fetchPendingSources,
  removeSource,
  setSourceTrust,
} from "@/modules/script/actions";
import type { ScriptDetail, SourceSummary } from "@/modules/script/types";

const TRUST_LABEL: Record<number, string> = {
  3: "High trust",
  2: "Normal",
  1: "Low trust",
};

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  other: "Other",
};

export function ScriptClient({
  script,
  editable,
}: {
  script: ScriptDetail;
  editable: boolean;
}) {
  const router = useRouter();
  const { push } = useErrorStore();
  const { run, loading } = useActionHandler();

  const [url, setUrl] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [text, setText] = useState("");

  const pending = script.sources.filter(
    (s) => s.type === "youtube" && (s.status === "queued" || s.status === "failed"),
  ).length;
  const readyWords = script.sources
    .filter((s) => s.status === "ready")
    .reduce((sum, s) => sum + s.words, 0);

  // These actions return an ActionResult rather than throwing, so the failure
  // branch has to be unwrapped before the UI treats the call as a success.
  async function call<T>(name: string, fn: () => Promise<ActionResult<T>>) {
    const result = await run(name, fn);
    if (!result) return null;
    if (!result.ok) {
      push(result.error);
      return null;
    }
    router.refresh();
    return result.data;
  }

  async function submitUrl() {
    if (!url.trim()) return;
    const added = await call("Add Source", () => addSource(script.id, { kind: "youtube", url }));
    if (added) setUrl("");
  }

  async function submitText() {
    if (!text.trim()) return;
    const added = await call("Add Source", () =>
      addSource(script.id, { kind: "text", title: textTitle, text }),
    );
    if (added) {
      setText("");
      setTextTitle("");
    }
  }

  return (
    <PageContainer>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">References</h2>
              <p className="text-sm text-muted-foreground">
                {script.sources.length
                  ? `${script.sources.length} source${script.sources.length === 1 ? "" : "s"} · ${readyWords.toLocaleString()} words ready`
                  : "Add the videos and articles this episode is built from."}
              </p>
            </div>
            {editable && pending > 0 && (
              <Button
                size="sm"
                className="rounded-full"
                disabled={loading}
                onClick={() => call("Fetch Sources", () => fetchPendingSources(script.id))}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Fetch {pending}
              </Button>
            )}
          </div>

          {script.sources.length === 0 ? (
            <SurfaceCard padding="lg" className="py-12 text-center text-sm text-muted-foreground">
              No references yet.
            </SurfaceCard>
          ) : (
            script.sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                editable={editable}
                busy={loading}
                onTrust={(level) =>
                  call("Set Source Trust", () => setSourceTrust(source.id, level))
                }
                onRemove={() => call("Remove Source", () => removeSource(source.id))}
              />
            ))
          )}
        </div>

        {editable && (
          <SurfaceCard className="h-fit lg:sticky lg:top-4">
            <Tabs defaultValue="youtube">
              <TabsList className="w-full">
                <TabsTrigger value="youtube" className="flex-1">
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1">
                  Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="youtube" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="source-url">Video link</Label>
                  <Input
                    id="source-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitUrl()}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Added as queued. Hit Fetch to pull every pending transcript in one
                  call.
                </p>
                <Button
                  size="sm"
                  className="w-full rounded-full"
                  disabled={loading || !url.trim()}
                  onClick={submitUrl}
                >
                  Add Video
                </Button>
              </TabsContent>

              <TabsContent value="text" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="source-title">Label</Label>
                  <Input
                    id="source-title"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Court records, 1984"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-text">Text</Label>
                  <Textarea
                    id="source-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    placeholder="Paste an article, transcript or notes…"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full rounded-full"
                  disabled={loading || !text.trim()}
                  onClick={submitText}
                >
                  Add Text
                </Button>
              </TabsContent>
            </Tabs>
          </SurfaceCard>
        )}
      </div>
    </PageContainer>
  );
}

function SourceRow({
  source,
  editable,
  busy,
  onTrust,
  onRemove,
}: {
  source: SourceSummary;
  editable: boolean;
  busy: boolean;
  onTrust: (level: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = source.type === "youtube" ? Video : FileText;
  const label = source.title ?? (source.type === "youtube" ? source.url : "Pasted text");

  return (
    <SurfaceCard>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={source.status} />
            {source.language && (
              <Badge variant="outline">
                {LANGUAGE_LABEL[source.language] ?? source.language}
              </Badge>
            )}
            {source.words > 0 && (
              <span className="text-xs text-muted-foreground">
                {source.words.toLocaleString()} words
              </span>
            )}
            {source.hasTimestamps && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                timed
              </span>
            )}
            {source.captionKind === "auto" && (
              <span className="text-xs text-muted-foreground">auto-captions</span>
            )}
          </div>

          {source.error && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {source.error}
            </p>
          )}

          {source.preview && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {open ? "Hide" : "Preview"} cleaned text
              </button>
              {open && (
                <p
                  dir={source.language === "ar" ? "rtl" : "ltr"}
                  className="mt-2 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"
                >
                  {source.preview}…
                </p>
              )}
            </>
          )}
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <select
              aria-label="Trust level"
              value={source.trustLevel}
              disabled={busy}
              onChange={(e) => onTrust(Number(e.target.value))}
              className="rounded-md border border-border/60 bg-transparent px-2 py-1 text-xs"
            >
              {[3, 2, 1].map((level) => (
                <option key={level} value={level}>
                  {TRUST_LABEL[level]}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={busy}
              onClick={onRemove}
              aria-label="Remove source"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "fetching")
    return (
      <Badge variant="outline">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Fetching
      </Badge>
    );
  return <Badge variant="outline">Queued</Badge>;
}
