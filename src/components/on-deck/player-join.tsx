"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  joinSession,
  recognizePlayer,
  type RecognizedPlayer,
} from "@/lib/on-deck/actions/players";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  type FloorMode,
  type SkillLevel,
} from "@/lib/on-deck/session/types";
import { newPlayerToken, savePlayerToken } from "@/components/on-deck/player-token";
import {
  TOKEN_CHANGED_EVENT,
  usePlayerToken,
} from "@/components/on-deck/use-player-token";
import { QueueStatus } from "@/components/on-deck/queue-status";

/**
 * The Player's side of a running Session on the substitution board (direction
 * seed 92ec9d54): a two-tap setup (name, then Skill Level) that appends
 * `PLAYER_JOINED`, or — if this device's token is already in the roster — a
 * straight "you're in" board readout (issue #242).
 *
 * The roster is never sent here: a device token is a Player's whole identity
 * (ADR 0001), so the page must not broadcast every token to everyone viewing
 * it. `recognizePlayer` confirms only the token this device already holds.
 */
export function PlayerJoin({
  sessionId,
  floorMode,
}: {
  sessionId: string;
  floorMode: FloorMode;
}) {
  const router = useRouter();
  const token = usePlayerToken(sessionId);

  const [step, setStep] = useState<"name" | "skill">("name");
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [justJoined, setJustJoined] = useState<RecognizedPlayer | null>(null);
  // `undefined` = not looked up yet, `null` = looked up and not on the roster.
  const [recognized, setRecognized] = useState<
    RecognizedPlayer | null | undefined
  >(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A token in storage means a possible returning Player — ask the server who
  // it belongs to. Async, so no synchronous setState in the effect body.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    recognizePlayer(sessionId, token)
      .then((player) => {
        if (!cancelled) setRecognized(player);
      })
      .catch(() => {
        if (!cancelled) setRecognized(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  const me = justJoined ?? recognized ?? null;

  async function submit(skillLevel: SkillLevel) {
    setSubmitting(true);
    setError(null);

    try {
      const deviceToken = token ?? newPlayerToken();

      const result = await joinSession({
        sessionId,
        token: deviceToken,
        firstName,
        lastInitial,
        skillLevel,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      savePlayerToken(sessionId, deviceToken);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
      }
      setJustJoined(result.player);
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (me) {
    return (
      <div className="mt-7">
        <div className="od-panel od-next p-5">
          <p className="od-display-tight text-4xl text-arena-fg sm:text-5xl">
            You&apos;re in
          </p>
          <p className="od-display mt-1 text-2xl text-arena-dim">
            {me.displayName}
          </p>
          <p className="od-readout mt-2 text-arena-dim">
            Playing as {SKILL_LEVEL_LABEL[me.skillLevel]}
          </p>
        </div>
        <p className="mt-3 text-sm text-arena-dim">
          Reopen the sign any time on this device and it&apos;ll know it&apos;s
          you.
        </p>
        {token && (
          <QueueStatus
            sessionId={sessionId}
            token={token}
            floorMode={floorMode}
          />
        )}
      </div>
    );
  }

  // A returning device whose lookup hasn't resolved yet: hold the space rather
  // than flash the setup form.
  if (token && recognized === undefined) {
    return <div className="mt-7 h-44" aria-hidden />;
  }

  if (step === "skill") {
    return (
      <div className="mt-7">
        <p className="od-display text-2xl text-arena-fg">
          What&apos;s your skill level?
        </p>
        <p className="mt-1 text-sm text-arena-dim">
          Your call. It helps us mix the games well.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {SKILL_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className="od-key w-full justify-start"
              disabled={submitting}
              onClick={() => submit(level)}
            >
              {SKILL_LEVEL_LABEL[level]}
            </button>
          ))}
        </div>
        {error && (
          <p className="od-readout mt-3 text-[0.72rem] text-arena-warn" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="od-readout mt-4 text-[0.7rem] text-arena-faint underline-offset-4 hover:text-arena-dim hover:underline"
          disabled={submitting}
          onClick={() => {
            setError(null);
            setStep("name");
          }}
        >
          Back
        </button>
      </div>
    );
  }

  const nameReady = firstName.trim() !== "" && lastInitial.trim() !== "";

  return (
    <form
      className="mt-7 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (nameReady) setStep("skill");
      }}
    >
      <p className="od-display text-2xl text-arena-fg">Join the social</p>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="on-deck-first-name"
          className="od-readout text-arena-dim"
        >
          First name
        </label>
        <input
          id="on-deck-first-name"
          name="firstName"
          autoComplete="given-name"
          autoCapitalize="words"
          className="od-field"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="on-deck-last-initial"
          className="od-readout text-arena-dim"
        >
          Last initial
        </label>
        <input
          id="on-deck-last-initial"
          name="lastInitial"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={4}
          className="od-field w-24"
          value={lastInitial}
          onChange={(event) => setLastInitial(event.target.value)}
          required
        />
      </div>
      <p className="text-sm text-arena-faint">
        First name and last initial only. No phone number, no account.
      </p>
      <button type="submit" className="od-key od-key--go" disabled={!nameReady}>
        Next
      </button>
    </form>
  );
}
