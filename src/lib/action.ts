"use server";

import { createAppError, type AppError } from "./errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export async function safeAction<T>(
  actionName: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    const appError = createAppError(error, {
      action: actionName,
      context,
    });

    console.error(`[Action Error] ${actionName}:`, {
      message: appError.message,
      code: appError.code,
      prismaCode: appError.prismaCode,
      context: appError.context,
    });

    return { ok: false, error: appError };
  }
}
