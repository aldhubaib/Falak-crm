// The inbox is a full-screen overlay route (/messages). Remember the page the
// user was on before entering it so the close button can return them there
// instead of a hardcoded route. Session-scoped: survives in-app navigation and
// refreshes, resets per tab.
const KEY = "inbox:return-to";

export function rememberInboxReturnPath(path: string) {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage unavailable (private mode quirks) — close falls back to /dashboard.
  }
}

export function getInboxReturnPath(): string {
  try {
    return sessionStorage.getItem(KEY) || "/dashboard";
  } catch {
    return "/dashboard";
  }
}
