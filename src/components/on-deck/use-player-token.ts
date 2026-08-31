"use client";

import { useCallback, useSyncExternalStore } from "react";

import { loadPlayerToken } from "@/components/on-deck/player-token";

/**
 * Fired by `savePlayerToken`'s callers after a join so a Player's other
 * components in the same tab re-read the token without a reload.
 */
export const TOKEN_CHANGED_EVENT = "on-deck:player-token";

/**
 * The Player's device token for this Session, read through
 * `useSyncExternalStore` so it is `null` during SSR and hydration (no
 * mismatch) and the real value straight after.
 */
export function usePlayerToken(sessionId: string): string | null {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", onChange);
    window.addEventListener(TOKEN_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(TOKEN_CHANGED_EVENT, onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => loadPlayerToken(sessionId),
    () => null,
  );
}
