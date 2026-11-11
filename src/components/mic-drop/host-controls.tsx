"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  addToLineUp,
  startPoll,
  type FormState,
} from "@/lib/mic-drop/actions/host";

const EMPTY: FormState = {};

/** Names a new Poll; the Host lands on its line-up. */
export function NewPollForm() {
  const [state, action, pending] = useActionState(startPoll, EMPTY);
  return (
    <form action={action} className="md-form">
      <label htmlFor="md-poll-name" className="md-label">
        New Poll
      </label>
      <div className="md-form-row">
        <input
          id="md-poll-name"
          name="name"
          className="md-input"
          maxLength={80}
          required
          autoComplete="off"
          placeholder="Karaoke night"
          defaultValue={state.name}
        />
        <button type="submit" className="md-btn" disabled={pending}>
          {pending ? "Starting…" : "Start the Poll"}
        </button>
      </div>
      <Problem text={state.problem} />
    </form>
  );
}

/** Types a Contestant onto the end of the line-up, then is ready for the next one. */
export function AddContestantForm({ pollId }: { pollId: string }) {
  const [state, action, pending] = useActionState(
    addToLineUp.bind(null, pollId),
    EMPTY,
  );
  const input = useRef<HTMLInputElement>(null);

  // After each add, straight back to the field for the next name.
  useEffect(() => {
    if (state !== EMPTY) input.current?.focus();
  }, [state]);

  return (
    <form action={action} className="md-form">
      <label htmlFor="md-contestant-name" className="md-label">
        Add a Contestant
      </label>
      <div className="md-form-row">
        <input
          ref={input}
          id="md-contestant-name"
          name="name"
          className="md-input"
          maxLength={80}
          required
          autoComplete="off"
          placeholder="A singer, or a duet as one"
          defaultValue={state.name}
        />
        <button type="submit" className="md-btn" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <Problem text={state.problem} />
    </form>
  );
}

function Problem({ text }: { text?: string }) {
  return (
    <p role="alert" className="md-problem">
      {text}
    </p>
  );
}

type CopyState = "idle" | "copied" | "failed";

/** The Guest Link in one tap, for the group chat. */
export function CopyGuestLink({ url }: { url: string }) {
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
    <div className="md-share">
      <span className="md-label">Guest Link</span>
      <a href={url} className="md-share-url" target="_blank" rel="noreferrer">
        {url}
      </a>
      <div className="md-form-row">
        <button type="button" onClick={copy} className="md-btn">
          {state === "copied" ? "Copied" : "Copy Guest Link"}
        </button>
        <p role="status" aria-live="polite" className="md-share-note">
          {state === "copied" && "Paste it into the group chat."}
          {state === "failed" &&
            "Couldn't copy. Press and hold the link above to copy it."}
        </p>
      </div>
    </div>
  );
}
