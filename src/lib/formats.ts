// File-extension helpers, safe to import from server and client code.
//
// Extensions are stored inconsistently across editors and old records (some
// with a leading dot, some without, mixed case). Always normalize before
// comparing or displaying, otherwise "png" and ".png" survive as duplicates.

export function dotExt(f: string): string {
  const t = f.trim().toLowerCase();
  if (!t) return "";
  return t.startsWith(".") ? t : `.${t}`;
}

// Canonical, deduplicated list of extensions: ".png" form, lowercase, unique.
export function normalizeFormats(formats: string[]): string[] {
  return [...new Set(formats.map(dotExt).filter(Boolean))];
}
