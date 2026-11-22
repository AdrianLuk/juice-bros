"use client";

import { useState, useTransition } from "react";

import type { WriteResult } from "@/lib/ddd/actions/live";

/** Runs a write, then re-reads; returns the problem to show, if any. */
export function useWrite(onSaved: () => void) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState("");
  function run(write: () => Promise<WriteResult>, after?: () => void) {
    setProblem("");
    start(async () => {
      const result = await write();
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      after?.();
      onSaved();
    });
  }
  return { pending, problem, run };
}
