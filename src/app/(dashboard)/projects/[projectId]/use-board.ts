"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getBoardData, type BoardData, type BoardTask } from "@/actions/board";
import type {
  BoardChecklistPatch,
  BoardSlotPatch,
  BoardTaskMovePatch,
  BoardWeeklyDelta,
} from "@/lib/realtime";
import { useCentrifugo } from "@/components/realtime/centrifugo-provider";
import { projectChannel } from "@/lib/channels";

export function boardQueryKey(projectId: string) {
  return ["board", projectId] as const;
}

// Board task list, seeded from the server-rendered payload and kept live by
// realtime events. Uses React Query so optimistic mutations can patch the cache.
export function useBoardData(projectId: string, initialData: BoardData) {
  return useQuery({
    queryKey: boardQueryKey(projectId),
    queryFn: () => getBoardData(projectId),
    initialData,
  });
}

type BoardEvent = {
  type?: string;
  taskId?: string;
  actorClientId?: string | null;
  patch?: BoardTaskMovePatch;
  checklist?: BoardChecklistPatch;
  snapshot?: BoardTask;
  assignee?: { id: string; name: string; avatar: string | null } | null;
  slot?: BoardSlotPatch;
};

// Ephemeral drag broadcast, published client-to-client over the Centrifugo
// project channel (no server round trip): everyone watching the board sees who
// is dragging which card, live.
type DragEvent = {
  type: "board.drag";
  taskId: string;
  dragging: boolean;
  memberId: string;
  memberName: string;
  actorClientId: string;
};

export type RemoteDrags = Record<string, { name: string; ts: number }>;

// If a drag-end broadcast is lost (tab closed mid-drag, network blip), the
// remote highlight clears itself after this long.
const DRAG_TTL_MS = 15_000;

// Apply a Weekly Plan slot change to the cached board data in memory. Returns
// the input unchanged when the delta doesn't apply (e.g. unknown template
// group) — the weekly targets sync up on the next natural refetch. Overflow
// deltas are NOT handled here: they change too much (next week's groups
// materialise), so callers refetch instead.
export function applyWeeklyDelta(
  data: BoardData,
  delta: BoardWeeklyDelta | null | undefined,
): BoardData {
  if (!delta || delta.overflow) return data;
  // In-memory claims/releases only ever touch the current week's plan.
  const group = data.weekly.find(
    (g) => g.templateId === delta.templateId && g.weekOffset === 0,
  );
  if (!group) return data;
  let next = group;
  if (delta.claimedSlotId) {
    const had = group.emptySlots.some((s) => s.id === delta.claimedSlotId);
    if (had) {
      next = {
        ...next,
        emptySlots: next.emptySlots.filter((s) => s.id !== delta.claimedSlotId),
      };
    }
  }
  if (delta.createdExtra) {
    next = { ...next, total: next.total + 1 };
  }
  if (delta.releasedSlot) {
    const exists = group.emptySlots.some((s) => s.id === delta.releasedSlot!.id);
    if (!exists) {
      next = {
        ...next,
        emptySlots: [...next.emptySlots, delta.releasedSlot],
      };
    }
  }
  if (next === group) return data;
  return {
    ...data,
    weekly: data.weekly.map((g) => (g === group ? next : g)),
  };
}

// Apply a realtime task event straight to the React Query cache. Events carry
// the changed data (snapshot on create, patch on move), so remote boards
// update in memory with zero refetch — critical when 100 screens are open and
// every event used to fan out into 100 full board queries.
function applyBoardEvent(
  queryClient: QueryClient,
  projectId: string,
  event: BoardEvent,
) {
  const key = boardQueryKey(projectId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  if (event.type === "task.created" && event.snapshot) {
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      if (old.tasks.some((t) => t.id === event.snapshot!.id)) return old;
      return { ...old, tasks: [...old.tasks, event.snapshot!] };
    });
    return;
  }

  if (event.type === "task.moved" && event.patch && event.taskId) {
    const patch = event.patch;
    // An overflow move materialised next week's plan (or removed an overflow
    // slot on rollback) — too much changed for an in-memory patch.
    if (patch.weekly?.overflow) {
      invalidate();
      return;
    }
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      if (!old.tasks.some((t) => t.id === event.taskId)) return old;
      const withTask = {
        ...old,
        tasks: old.tasks.map((t) =>
          t.id === event.taskId
            ? {
                ...t,
                statusId: patch.statusId,
                statusName: patch.statusName ?? t.statusName,
                statusColor: patch.statusColor ?? t.statusColor,
                stageEnteredAt: patch.stageEnteredAt,
                completedAt: patch.completedAt,
                assigneeId: patch.assigneeId,
                assigneeName: patch.assigneeName,
                assigneeAvatar: patch.assigneeAvatar,
                submittedById: patch.submittedById,
                submittedByName: patch.submittedByName,
                rejectionCount: t.rejectionCount + patch.rejectionCountDelta,
              }
            : t,
        ),
      };
      // Any Weekly Plan slot claimed/freed by the move rides on the patch —
      // applied in memory, so a move no longer triggers a board refetch on
      // every open screen.
      return applyWeeklyDelta(withTask, patch.weekly);
    });
    return;
  }

  // Task reassigned (avatar self-assign) — patch the card's owner in memory.
  if (event.type === "task.updated" && event.assignee !== undefined && event.taskId) {
    const assignee = event.assignee;
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      if (!old.tasks.some((t) => t.id === event.taskId)) return old;
      return {
        ...old,
        tasks: old.tasks.map((t) =>
          t.id === event.taskId
            ? {
                ...t,
                assigneeId: assignee?.id ?? null,
                assigneeName: assignee?.name ?? null,
                assigneeAvatar: assignee?.avatar ?? null,
              }
            : t,
        ),
      };
    });
    return;
  }

  // Checklist progress changed (upload finished, text saved, file removed) —
  // update the card's counters and the delivery drag gate in memory.
  if (event.type === "task.updated" && event.checklist && event.taskId) {
    const checklist = event.checklist;
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      if (!old.tasks.some((t) => t.id === event.taskId)) return old;
      return {
        ...old,
        tasks: old.tasks.map((t) =>
          t.id === event.taskId
            ? {
                ...t,
                checklistTotal: checklist.checklistTotal,
                checklistDone: checklist.checklistDone,
                deliveryIncomplete: checklist.deliveryIncomplete,
              }
            : t,
        ),
      };
    });
    return;
  }

  // Weekly plan slot reassigned (avatar click on dashed placeholder).
  if (event.type === "slot.updated" && event.slot) {
    const slot = event.slot;
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      return {
        ...old,
        weekly: old.weekly.map((g) =>
          g.templateId === slot.templateId
            ? {
                ...g,
                emptySlots: g.emptySlots.map((s) =>
                  s.id === slot.slotId
                    ? {
                        ...s,
                        assigneeId: slot.assigneeId,
                        assigneeName: slot.assigneeName,
                        assigneeAvatar: slot.assigneeAvatar,
                      }
                    : s,
                ),
              }
            : g,
        ),
      };
    });
    return;
  }

  if (event.type === "task.deleted" && event.taskId) {
    queryClient.setQueryData<BoardData>(key, (old) => {
      if (!old) return old;
      return { ...old, tasks: old.tasks.filter((t) => t.id !== event.taskId) };
    });
    // Deleting a Todo task frees its Weekly Plan slot — refresh in background.
    invalidate();
    return;
  }

  // task.updated or an event without a payload — fall back to a refetch.
  invalidate();
}

// Keeps the board live when another client changes something. Prefers Centrifugo
// (the primary transport); falls back to the in-process SSE stream when no
// Centrifugo WS URL is configured. The client's own echoes are ignored so they
// don't clobber an in-flight optimistic update.
//
// Also exposes live drag presence: `publishDrag` broadcasts that this user is
// dragging a card, and `remoteDrags` maps taskId → who's dragging it elsewhere.
export function useBoardStream(
  projectId: string,
  clientId: string,
  memberName?: string,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const cent = useCentrifugo();
  const enabled = cent?.enabled ?? false;
  const [remoteDrags, setRemoteDrags] = useState<RemoteDrags>({});

  useEffect(() => {
    const handleEvent = (event: BoardEvent | DragEvent) => {
      if (!event?.type) return;
      if (event.actorClientId && event.actorClientId === clientId) return;

      // Stage rules changed in Settings (role flags, checklist field rules).
      // Refetch the board data AND re-run the SSR render — movePerms are
      // computed server-side and frozen into props, so only a router refresh
      // updates them without a manual reload.
      if (event.type === "board.refresh") {
        void queryClient.invalidateQueries({
          queryKey: boardQueryKey(projectId),
        });
        router.refresh();
        return;
      }

      if (event.type === "board.drag") {
        const d = event as DragEvent;
        setRemoteDrags((prev) => {
          if (d.dragging) {
            return { ...prev, [d.taskId]: { name: d.memberName, ts: Date.now() } };
          }
          if (!(d.taskId in prev)) return prev;
          const next = { ...prev };
          delete next[d.taskId];
          return next;
        });
        return;
      }

      if (event.type.startsWith("task.") || event.type === "slot.updated") {
        // A move lands the card — clear any lingering drag highlight for it.
        if (event.taskId) {
          setRemoteDrags((prev) => {
            if (!(event.taskId! in prev)) return prev;
            const next = { ...prev };
            delete next[event.taskId!];
            return next;
          });
        }
        applyBoardEvent(queryClient, projectId, event as BoardEvent);
      }
    };

    // Primary: Centrifugo project channel.
    if (enabled && cent) {
      return cent.subscribe(projectChannel(projectId), (data) =>
        handleEvent(data as BoardEvent | DragEvent),
      );
    }

    // Fallback: in-process SSE stream (single instance, no Centrifugo).
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const source = new EventSource(`/api/projects/${projectId}/stream`);
    source.onmessage = (e) => {
      try {
        handleEvent(JSON.parse(e.data) as BoardEvent);
      } catch {
        // Malformed frame — ignore.
      }
    };
    source.onerror = () => {};
    return () => source.close();
  }, [enabled, cent, projectId, clientId, queryClient, router]);

  // Expire stale remote drag highlights.
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - DRAG_TTL_MS;
      setRemoteDrags((prev) => {
        const entries = Object.entries(prev).filter(([, v]) => v.ts >= cutoff);
        return entries.length === Object.keys(prev).length
          ? prev
          : Object.fromEntries(entries);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const memberNameRef = useRef(memberName);
  memberNameRef.current = memberName;

  const publishDrag = useCallback(
    (taskId: string, dragging: boolean) => {
      if (!cent?.enabled) return;
      cent.publish(projectChannel(projectId), {
        type: "board.drag",
        taskId,
        dragging,
        memberId: cent.memberId,
        memberName: memberNameRef.current ?? "Someone",
        actorClientId: clientId,
      } satisfies DragEvent);
    },
    [cent, projectId, clientId],
  );

  return { remoteDrags, publishDrag };
}
