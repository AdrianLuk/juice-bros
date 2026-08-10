"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadRefFlipped,
  saveRefFlipped,
} from "@/components/apps/pickle-point-pal/lib/persistence/match-storage";

/**
 * Whether the ref is standing on the far side of the net, which mirrors which
 * team they see on their left.
 *
 * Starts `false` on both server and client and only picks the stored value up
 * in an effect — reading localStorage during render would hydrate a different
 * tree than the server sent. It outlives the match on purpose: a ref working a
 * court all afternoon sets this once.
 */
export function useRefFlipped(): [boolean, () => void] {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store on mount
    setFlipped(loadRefFlipped());
  }, []);

  const toggle = useCallback(() => {
    const next = !flipped;
    saveRefFlipped(next);
    setFlipped(next);
  }, [flipped]);

  return [flipped, toggle];
}
