"use client";

import { useState, useCallback } from "react";
import { useErrorStore } from "@/lib/error-store";
import { createAppError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action";

interface UseActionOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  showToast?: boolean;
}

export function useAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
  options: UseActionOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const { push } = useErrorStore();
  const { onSuccess, onError, showToast = true } = options;

  const execute = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      setLoading(true);
      try {
        const result = await action(input);
        if (result.ok) {
          onSuccess?.();
          return result.data;
        } else {
          if (showToast) push(result.error);
          onError?.(result.error.message);
          return null;
        }
      } catch (err) {
        const appError = createAppError(err, { action: action.name });
        if (showToast) push(appError);
        onError?.(appError.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, onSuccess, onError, showToast, push]
  );

  return { execute, loading };
}

export function useActionHandler(options: UseActionOptions = {}) {
  const [loading, setLoading] = useState(false);
  const { push } = useErrorStore();
  const { onSuccess, onError, showToast = true } = options;

  const run = useCallback(
    async <T>(actionName: string, fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      try {
        const result = await fn();
        onSuccess?.();
        return result;
      } catch (err) {
        const appError = createAppError(err, { action: actionName });
        if (showToast) push(appError);
        onError?.(appError.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError, showToast, push]
  );

  return { run, loading };
}
