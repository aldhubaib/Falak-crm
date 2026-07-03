"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBoardData, type BoardData } from "@/actions/board";

export function boardQueryKey(projectId: string) {
  return ["board", projectId] as const;
}

// Board task list, seeded from the server-rendered payload and kept live by the
// SSE stream. Uses React Query so optimistic mutations can patch the cache.
export function useBoardData(projectId: string, initialData: BoardData) {
  return useQuery({
    queryKey: boardQueryKey(projectId),
    queryFn: () => getBoardData(projectId),
    initialData,
  });
}

// Subscribes to the project's SSE stream and invalidates the board query when
// another client changes something. The client's own echoes are ignored so
// they don't clobber an in-flight optimistic update.
export function useBoardStream(projectId: string, clientId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource(`/api/projects/${projectId}/stream`);

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { actorClientId?: string | null };
        if (event.actorClientId && event.actorClientId === clientId) return;
        queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
      } catch {
        // Malformed frame — ignore.
      }
    };

    // EventSource auto-reconnects on transient errors; nothing to do here.
    source.onerror = () => {};

    return () => source.close();
  }, [projectId, clientId, queryClient]);
}
