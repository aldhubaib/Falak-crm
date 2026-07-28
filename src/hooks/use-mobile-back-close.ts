"use client";

import { useEffect, useRef } from "react";

// Sequence for marker entries so stacked overlays (sheet → dialog on top)
// each own their spot in the history stack and close top-first.
let overlaySeq = 0;

// Phones only: on desktop and tablet the browser back button must keep
// navigating pages exactly as before. `pointer: coarse` keeps narrow desktop
// windows out.
const isPhone = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;

/**
 * Makes the system back button (Android hardware back, iOS edge-swipe) close
 * an open overlay instead of leaving the page — the deep mobile-OS habit of
 * "back dismisses the topmost thing on screen".
 *
 * While `open` is true on a phone, a marker entry sits on top of the history
 * stack: pressing back pops the marker and closes the overlay, leaving the
 * page itself alone. Closing via the UI (X, scrim, Esc) consumes the marker
 * silently so the next back press behaves normally. No-op on desktop/tablet.
 */
export function useMobileBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !isPhone()) return;
    const id = ++overlaySeq;
    // Spread keeps Next.js router bookkeeping in history.state intact.
    window.history.pushState({ ...window.history.state, __overlay: id }, "");

    const onPop = (e: PopStateEvent) => {
      // Any pop landing at or below this overlay's marker closes it — covers
      // a single back press and multi-entry jumps alike.
      const state = (e.state ?? {}) as { __overlay?: number };
      if (!state.__overlay || state.__overlay < id) onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via the UI instead of back: consume the marker if it's still
      // the top entry (a back-press close already popped it).
      const state = window.history.state as { __overlay?: number } | null;
      if (state?.__overlay === id) window.history.back();
    };
  }, [open]);
}
