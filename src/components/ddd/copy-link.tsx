"use client";

import { useEffect, useState, useTransition } from "react";

type CopyState = "idle" | "copied" | "failed";

/** A link shown in full with a Copy button, ready for the group chat. */
export function CopyLink({ label, url, note }: { label: string; url: string; note?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="ddd-link">
      <div className="ddd-link-head">
        <h3 className="ddd-link-label">{label}</h3>
        {note ? <p className="ddd-link-note">{note}</p> : null}
      </div>
      <p className="ddd-link-url">
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </p>
      <div className="ddd-link-actions">
        <button type="button" className="ddd-btn" onClick={copy}>
          Copy
        </button>
        <p role="status" aria-live="polite" className="ddd-link-status">
          {state === "copied" && "Copied."}
          {state === "failed" && "Couldn't copy. Press and hold the link to copy it."}
        </p>
      </div>
    </div>
  );
}

/**
 * Makes a fresh invite link on tap, then shows it to copy. Made on demand,
 * since each link adds one Organizer and lasts 7 days.
 */
export function InviteLink({ make }: { make: () => Promise<string> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();

  function makeOne() {
    setProblem("");
    start(async () => {
      try {
        setUrl(await make());
      } catch {
        setProblem("Couldn't make an invite link. Try again.");
      }
    });
  }

  return (
    <div className="ddd-invite">
      {url ? (
        <CopyLink label="Invite link" url={url} note="Adds one Organizer. Works for 7 days." />
      ) : null}
      <div className="ddd-link-actions">
        <button type="button" className={url ? "ddd-quiet" : "ddd-btn ddd-btn-ghost"} disabled={pending} onClick={makeOne}>
          {pending ? "Making a link…" : url ? "Make another" : "Invite an Organizer"}
        </button>
        <p role="alert" className="ddd-problem empty:hidden">
          {problem}
        </p>
      </div>
    </div>
  );
}
