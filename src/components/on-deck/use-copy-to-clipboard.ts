"use client";

import { useState } from "react";

/**
 * The "copy, then say so for a couple seconds" pattern shared by every join
 * message control on the board (the Club QR hold-up, issue #517; the
 * first-night kit and the closed-Session page, issue #521). One place for
 * the clipboard call and its failure mode, so each surface only supplies the
 * text and the label.
 */
export function useCopyToClipboard(text: string) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return { copied, copy };
}
