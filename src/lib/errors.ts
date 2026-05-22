export type ErrorSeverity = "error" | "warning" | "info";

export interface AppError {
  id: string;
  message: string;
  code?: string;
  severity: ErrorSeverity;
  timestamp: string;
  url: string;
  action?: string;
  stack?: string;
  context?: Record<string, unknown>;
  prismaCode?: string;
  digest?: string;
}

const PRISMA_ERROR_MAP: Record<string, string> = {
  P2002: "A record with this value already exists (unique constraint violation)",
  P2003: "Cannot complete this action because of a related record (foreign key constraint)",
  P2025: "The record you're trying to update or delete was not found",
  P2014: "This change would violate a required relation",
  P2016: "Query interpretation error",
  P2021: "The table does not exist in the current database",
  P2022: "The column does not exist in the current database",
};

function generateId() {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractPrismaCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code.startsWith("P")) return code;
  }
  return undefined;
}

function getHumanMessage(error: unknown): string {
  if (error instanceof Error) {
    const prismaCode = extractPrismaCode(error);
    if (prismaCode && PRISMA_ERROR_MAP[prismaCode]) {
      return PRISMA_ERROR_MAP[prismaCode];
    }
    return error.message;
  }
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}

export function createAppError(
  error: unknown,
  options: {
    action?: string;
    context?: Record<string, unknown>;
    severity?: ErrorSeverity;
  } = {}
): AppError {
  const prismaCode = extractPrismaCode(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const digest = error && typeof error === "object" && "digest" in error
    ? String((error as { digest: string }).digest)
    : undefined;

  return {
    id: generateId(),
    message: getHumanMessage(error),
    code: prismaCode || (error instanceof Error ? error.name : "UNKNOWN"),
    severity: options.severity || "error",
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "server",
    action: options.action,
    stack,
    context: options.context,
    prismaCode,
    digest,
  };
}

export function formatErrorForClipboard(appError: AppError): string {
  const lines: string[] = [
    `═══════════════════════════════════════`,
    `ERROR REPORT — Falak CRM`,
    `═══════════════════════════════════════`,
    ``,
    `Message:    ${appError.message}`,
    `Code:       ${appError.code || "—"}`,
    `Severity:   ${appError.severity}`,
    `Timestamp:  ${appError.timestamp}`,
    `URL:        ${appError.url}`,
  ];

  if (appError.action) {
    lines.push(`Action:     ${appError.action}`);
  }

  if (appError.prismaCode) {
    lines.push(`Prisma:     ${appError.prismaCode}`);
  }

  if (appError.digest) {
    lines.push(`Digest:     ${appError.digest}`);
  }

  if (appError.context && Object.keys(appError.context).length > 0) {
    lines.push(``, `── Context ──────────────────────────`);
    for (const [key, value] of Object.entries(appError.context)) {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  if (appError.stack) {
    lines.push(``, `── Stack Trace ──────────────────────`);
    lines.push(appError.stack);
  }

  lines.push(``, `═══════════════════════════════════════`);
  return lines.join("\n");
}

export async function copyErrorToClipboard(appError: AppError): Promise<boolean> {
  const text = formatErrorForClipboard(appError);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}
