"use client";

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Unsaved-work tracking. Two complementary sources:
//
// 1. A DOM scan (`hasUnsavedInput`) that compares every form control's live
//    value against the value it was rendered with — catches typed text
//    without any per-page wiring.
// 2. An explicit registry (`useUnsaved`) for pages whose unsaved state lives
//    in React state with no form control behind it (e.g. the New Task
//    priority picker, kanban edits held in memory).
//
// `pageHasUnsavedWork()` is the single question both the custom
// pull-to-refresh and the beforeunload guard ask.
// ---------------------------------------------------------------------------

let registered = 0;

/** Declare that this component currently holds unsaved work. */
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    registered += 1;
    return () => {
      registered -= 1;
    };
  }, [dirty]);
}

/**
 * True when any form control on the page holds text/choices the user entered
 * but hasn't saved. Compares live values against initial render values, so
 * pre-filled edit forms only count once something actually changes.
 */
export function hasUnsavedInput(): boolean {
  const els = document.querySelectorAll<HTMLElement>(
    "input, textarea, select, [contenteditable='true'], [contenteditable='']",
  );
  for (const el of els) {
    // Opt-out hatch for controls whose content is not worth protecting.
    if (el.closest("[data-refresh-safe]")) continue;
    if (el instanceof HTMLInputElement) {
      if (el.disabled || el.readOnly) continue;
      const type = el.type;
      if (["hidden", "submit", "button", "reset", "range"].includes(type)) continue;
      // Search/filter boxes aren't "work" — losing them to a refresh is fine.
      // The app's search inputs are plain text inputs with "Search…"
      // placeholders, so match those too.
      if (type === "search" || el.getAttribute("role") === "searchbox") continue;
      if (/^search/i.test(el.placeholder)) continue;
      if (type === "checkbox" || type === "radio") {
        if (el.checked !== el.defaultChecked) return true;
      } else if (type === "file") {
        if ((el.files?.length ?? 0) > 0) return true;
      } else if (el.value !== el.defaultValue) {
        return true;
      }
    } else if (el instanceof HTMLTextAreaElement) {
      if (!el.disabled && !el.readOnly && el.value !== el.defaultValue) return true;
    } else if (el instanceof HTMLSelectElement) {
      if (el.disabled) continue;
      for (const opt of el.options) {
        if (opt.selected !== opt.defaultSelected) return true;
      }
    } else if (el.isContentEditable) {
      if ((el.textContent ?? "").trim().length > 0) return true;
    }
  }
  return false;
}

/** Anything on the page the user would lose to a reload/refresh? */
export function pageHasUnsavedWork(): boolean {
  return registered > 0 || hasUnsavedInput();
}
