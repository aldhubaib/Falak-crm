"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction, type ActionResult } from "@/lib/action";
import {
  getProject,
  getProjectNames,
  listProjects,
  requireScriptEditor,
  requireScriptViewer,
} from "./integration";
import { cleanText, detectLanguage, wordCount } from "./sources/clean";
import { fetchTranscripts, trustFromCaptionKind } from "./sources/fetch";
import { parseVideoId } from "./sources/url";
import type { ScriptDetail, ScriptListItem, SourceSummary } from "./types";

export async function getProjectOptions() {
  const { workspace } = await requireScriptViewer();
  return listProjects(workspace.id);
}

export async function getScripts(): Promise<ScriptListItem[]> {
  const { workspace } = await requireScriptViewer();

  const rows = await db.script.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      projectId: true,
      updatedAt: true,
      _count: { select: { sources: true } },
    },
  });

  const names = await getProjectNames(workspace.id, rows.map((r) => r.projectId));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    projectId: r.projectId,
    // Null when the project was deleted — scripts hold no foreign key to it.
    projectName: names.get(r.projectId) ?? null,
    sourceCount: r._count.sources,
    updatedAt: r.updatedAt.getTime(),
  }));
}

export async function getScript(scriptId: string): Promise<ScriptDetail | null> {
  const { workspace } = await requireScriptViewer();

  const script = await db.script.findFirst({
    where: { id: scriptId, workspaceId: workspace.id, deletedAt: null },
    include: { sources: { orderBy: { order: "asc" } } },
  });
  if (!script) return null;

  const project = await getProject(workspace.id, script.projectId);

  return {
    id: script.id,
    title: script.title,
    status: script.status,
    projectId: script.projectId,
    projectName: project?.name ?? null,
    targetMinutes: script.targetMinutes,
    updatedAt: script.updatedAt.getTime(),
    sources: script.sources.map(toSourceSummary),
  };
}

function toSourceSummary(row: {
  id: string;
  type: string;
  url: string | null;
  title: string | null;
  author: string | null;
  trustLevel: number;
  language: string | null;
  captionKind: string | null;
  cleanedText: string | null;
  segments: unknown;
  status: string;
  error: string | null;
}): SourceSummary {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    title: row.title,
    author: row.author,
    trustLevel: row.trustLevel,
    language: row.language,
    captionKind: row.captionKind,
    status: row.status,
    error: row.error,
    words: row.cleanedText ? wordCount(row.cleanedText) : 0,
    hasTimestamps: Array.isArray(row.segments) && row.segments.length > 0,
    preview: row.cleanedText?.slice(0, 400) ?? null,
  };
}

export async function createScript(input: {
  title: string;
  projectId: string;
  targetMinutes?: number;
}): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Script", async () => {
    const { workspace, member } = await requireScriptEditor();

    const title = input.title.trim();
    if (!title) throw new Error("Give the script a title");

    const project = await getProject(workspace.id, input.projectId);
    if (!project) throw new Error("Pick a project this script belongs to");

    const script = await db.script.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        title,
        targetMinutes: input.targetMinutes ?? null,
        createdBy: member.id,
      },
      select: { id: true },
    });

    revalidatePath("/scripts");
    return { id: script.id };
  });
}

export async function renameScript(
  scriptId: string,
  title: string,
): Promise<ActionResult<void>> {
  return safeAction("Rename Script", async () => {
    const { workspace } = await requireScriptEditor();
    const trimmed = title.trim();
    if (!trimmed) throw new Error("Give the script a title");

    await db.script.updateMany({
      where: { id: scriptId, workspaceId: workspace.id },
      data: { title: trimmed },
    });
    revalidatePath(`/scripts/${scriptId}`);
  });
}

export async function deleteScript(scriptId: string): Promise<ActionResult<void>> {
  return safeAction("Delete Script", async () => {
    const { workspace } = await requireScriptEditor();
    await db.script.updateMany({
      where: { id: scriptId, workspaceId: workspace.id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/scripts");
  });
}

/**
 * Adds a reference. A YouTube URL is stored queued and fetched separately, so
 * a slow transcript call never blocks the person adding the next source.
 */
export async function addSource(
  scriptId: string,
  input: { kind: "youtube"; url: string } | { kind: "text"; title: string; text: string },
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Add Source", async () => {
    const { workspace } = await requireScriptEditor();

    const script = await db.script.findFirst({
      where: { id: scriptId, workspaceId: workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!script) throw new Error("Script not found");

    const last = await db.scriptSource.findFirst({
      where: { scriptId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = (last?.order ?? -1) + 1;

    if (input.kind === "youtube") {
      const videoId = parseVideoId(input.url);
      if (!videoId) throw new Error("That does not look like a YouTube link");

      const duplicate = await db.scriptSource.findFirst({
        where: { scriptId, url: { contains: videoId } },
        select: { id: true },
      });
      if (duplicate) throw new Error("That video is already a source on this script");

      const source = await db.scriptSource.create({
        data: {
          scriptId,
          type: "youtube",
          url: `https://www.youtube.com/watch?v=${videoId}`,
          status: "queued",
          order,
        },
        select: { id: true },
      });
      revalidatePath(`/scripts/${scriptId}`);
      return { id: source.id };
    }

    const text = input.text.trim();
    if (!text) throw new Error("Paste some text first");

    const language = detectLanguage(text);
    const source = await db.scriptSource.create({
      data: {
        scriptId,
        type: "text",
        title: input.title.trim() || "Pasted text",
        rawText: text,
        cleanedText: cleanText(text, language),
        language,
        captionKind: "n/a",
        status: "ready",
        order,
      },
      select: { id: true },
    });

    revalidatePath(`/scripts/${scriptId}`);
    return { id: source.id };
  });
}

/**
 * Fetches every queued or failed YouTube source on the script in one batched
 * call, then cleans each in its own language.
 */
export async function fetchPendingSources(
  scriptId: string,
): Promise<ActionResult<{ fetched: number; failed: number }>> {
  return safeAction("Fetch Sources", async () => {
    const { workspace } = await requireScriptEditor();

    const script = await db.script.findFirst({
      where: { id: scriptId, workspaceId: workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!script) throw new Error("Script not found");

    const pending = await db.scriptSource.findMany({
      where: { scriptId, type: "youtube", status: { in: ["queued", "failed"] } },
      select: { id: true, url: true },
    });
    if (!pending.length) return { fetched: 0, failed: 0 };

    const withIds = pending
      .map((s) => ({ id: s.id, videoId: s.url ? parseVideoId(s.url) : null }))
      .filter((s): s is { id: string; videoId: string } => !!s.videoId);

    await db.scriptSource.updateMany({
      where: { id: { in: withIds.map((s) => s.id) } },
      data: { status: "fetching", error: null },
    });

    let results;
    try {
      results = await fetchTranscripts(workspace.id, withIds.map((s) => s.videoId));
    } catch (err) {
      // Whole-call failure (missing token, auth) — don't leave rows stuck.
      const message = err instanceof Error ? err.message : String(err);
      await db.scriptSource.updateMany({
        where: { id: { in: withIds.map((s) => s.id) } },
        data: { status: "failed", error: message },
      });
      throw err;
    }

    const byVideoId = new Map(results.map((r) => [r.videoId, r]));
    let fetched = 0;
    let failed = 0;

    for (const { id, videoId } of withIds) {
      const result = byVideoId.get(videoId);
      if (!result?.ok) {
        failed++;
        await db.scriptSource.update({
          where: { id },
          data: { status: "failed", error: result?.error ?? "No transcript returned" },
        });
        continue;
      }

      fetched++;
      const language = detectLanguage(result.rawText);
      await db.scriptSource.update({
        where: { id },
        data: {
          status: "ready",
          error: null,
          title: result.title ?? null,
          author: result.author ?? null,
          durationSec: result.durationSec ?? null,
          captionKind: result.captionKind,
          trustLevel: trustFromCaptionKind(result.captionKind),
          language,
          rawText: result.rawText,
          cleanedText: cleanText(result.rawText, language),
          segments: result.segments ?? undefined,
        },
      });
    }

    revalidatePath(`/scripts/${scriptId}`);
    return { fetched, failed };
  });
}

export async function setSourceTrust(
  sourceId: string,
  trustLevel: number,
): Promise<ActionResult<void>> {
  return safeAction("Set Source Trust", async () => {
    const { workspace } = await requireScriptEditor();
    const source = await db.scriptSource.findUnique({
      where: { id: sourceId },
      select: { scriptId: true, script: { select: { workspaceId: true } } },
    });
    if (!source || source.script.workspaceId !== workspace.id) {
      throw new Error("Source not found");
    }

    await db.scriptSource.update({
      where: { id: sourceId },
      data: { trustLevel: Math.min(3, Math.max(1, Math.round(trustLevel))) },
    });
    revalidatePath(`/scripts/${source.scriptId}`);
  });
}

export async function removeSource(sourceId: string): Promise<ActionResult<void>> {
  return safeAction("Remove Source", async () => {
    const { workspace } = await requireScriptEditor();
    const source = await db.scriptSource.findUnique({
      where: { id: sourceId },
      select: { scriptId: true, script: { select: { workspaceId: true } } },
    });
    if (!source || source.script.workspaceId !== workspace.id) {
      throw new Error("Source not found");
    }

    await db.scriptSource.delete({ where: { id: sourceId } });
    revalidatePath(`/scripts/${source.scriptId}`);
  });
}
