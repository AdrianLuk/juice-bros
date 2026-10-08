"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

/** Copies the Brief, ready to paste into the group chat. */
export function CopyBriefButton({ brief }: { brief: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(brief);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={copy} className="tt-btn">
        Copy brief
      </button>
      <p role="status" aria-live="polite" className="text-sm text-(--tt-ink-dim)">
        {state === "copied" && "Copied. Paste it into the group chat."}
        {state === "failed" && "Couldn't copy. Select the text below and copy it yourself."}
      </p>
    </div>
  );
}
