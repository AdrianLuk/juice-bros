"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  joinSession,
  recognizePlayer,
  type RecognizedPlayer,
} from "@/lib/on-deck/actions/players";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  type SkillLevel,
} from "@/lib/on-deck/session/types";
import {
  loadPlayerToken,
  newPlayerToken,
  savePlayerToken,
} from "@/components/on-deck/player-token";

const TOKEN_CHANGED_EVENT = "on-deck:player-token";

/**
 * The Player's device token, read through `useSyncExternalStore` so it is
 * `null` during SSR and hydration (no mismatch) and the real value straight
 * after. `savePlayerToken` fires `TOKEN_CHANGED_EVENT` so a join in this tab
 * re-reads without a reload.
 */
function usePlayerToken(sessionId: string): string | null {
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

/**
 * The Player's side of a running Session: a two-tap setup (name, then Skill
 * Level) that appends `PLAYER_JOINED`, or — if this device's token is already
 * in the roster — a straight "you're in" screen (issue #242).
 *
 * The roster is never sent here: a device token is a Player's whole identity
 * (ADR 0001), so the page must not broadcast every token to everyone viewing
 * it. `recognizePlayer` confirms only the token this device already holds.
 */
export function PlayerJoin({ sessionId }: { sessionId: string }) {
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
      <div className="mt-8">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
          You&apos;re in
        </p>
        <p className="mt-2 font-heading text-2xl font-semibold">
          {me.displayName}
        </p>
        <p className="mt-1 text-muted-foreground">
          Playing as {SKILL_LEVEL_LABEL[me.skillLevel]}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          That&apos;s it — you can put your phone away. Reopen the sign any time
          on this device and it&apos;ll know it&apos;s you.
        </p>
      </div>
    );
  }

  // A returning device whose lookup hasn't resolved yet: hold the space rather
  // than flash the setup form.
  if (token && recognized === undefined) {
    return <div className="mt-8 h-40" aria-hidden />;
  }

  if (step === "skill") {
    return (
      <div className="mt-8">
        <p className="font-heading text-lg font-semibold">
          What&apos;s your skill level?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your call — it helps us mix the games well.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {SKILL_LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              variant="outline"
              className="h-12 justify-start text-base"
              disabled={submitting}
              onClick={() => submit(level)}
            >
              {SKILL_LEVEL_LABEL[level]}
            </Button>
          ))}
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
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
      className="mt-8 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (nameReady) setStep("skill");
      }}
    >
      <p className="font-heading text-lg font-semibold">Join the social</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-first-name">First name</Label>
        <Input
          id="on-deck-first-name"
          name="firstName"
          autoComplete="given-name"
          autoCapitalize="words"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-last-initial">Last initial</Label>
        <Input
          id="on-deck-last-initial"
          name="lastInitial"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={4}
          className="w-20"
          value={lastInitial}
          onChange={(event) => setLastInitial(event.target.value)}
          required
        />
      </div>
      <p className="text-sm text-muted-foreground">
        First name and last initial only. No phone number, no account.
      </p>
      <Button type="submit" className="h-12 text-base" disabled={!nameReady}>
        Next
      </Button>
    </form>
  );
}
