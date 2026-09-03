"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  devAddPlayers,
  devCloseSession,
  devFillCourts,
  devFinishAllCourts,
  devFinishCourt,
  devFormRandomGroup,
  devLastCall,
  devOverrideRandomSkill,
  devRequeueRandom,
  devResetSession,
  devSeatNextFour,
  devSetAsideRandom,
  devStartSession,
  devSwapRandomNoShow,
  type DevResult,
} from "@/lib/on-deck/actions/dev";
import {
  displayPath,
  floorPath,
  kioskPath,
  sessionPath,
  volunteerPath,
} from "@/lib/on-deck/routes";

export type DevSnapshot = {
  sessionId: string;
  venueName: string;
  courtCount: number;
  floorMode: string;
  groupCap: number;
  lastCall: boolean;
  volunteerToken: string | null;
  counts: {
    roster: number;
    queued: number;
    playing: number;
    onDeck: number;
    paused: number;
    groups: number;
  };
  courts: { number: number; occupied: boolean }[];
  onDeck: number[];
};

type Props = {
  clubName: string;
  clubQrPath: string;
  floorModeLabel: string;
  snapshot: DevSnapshot | null;
};

const CARD = "rounded-2xl border bg-card p-5";
const SECTION_TITLE = "font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground";

export function DevConsole({
  clubName,
  clubQrPath,
  floorModeLabel,
  snapshot,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  function run(action: () => Promise<DevResult>) {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await action();
        if ("error" in result && result.error) {
          setStatus({ kind: "error", text: result.error });
        } else if ("note" in result) {
          setStatus({ kind: "ok", text: result.note });
        }
        router.refresh();
      } catch {
        setStatus({ kind: "error", text: "Something went wrong. Try again." });
      }
    });
  }

  return (
    <div className="mt-8 space-y-5">
      <div className={CARD}>
        <p className="text-sm">
          <span className="font-medium">{clubName}</span> · {floorModeLabel}
        </p>
        {snapshot ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.venueName} · {snapshot.courtCount} courts · group cap{" "}
              {snapshot.groupCap}
              {snapshot.lastCall ? " · last call called" : ""}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              {(
                [
                  ["roster", "Roster"],
                  ["queued", "Queued"],
                  ["playing", "Playing"],
                  ["onDeck", "On deck"],
                  ["paused", "Paused"],
                  ["groups", "Groups"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="rounded-lg border bg-background py-2">
                  <dd className="text-lg font-semibold tabular-nums">
                    {snapshot.counts[key]}
                  </dd>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {snapshot.courts.map((c) => (
                <span
                  key={c.number}
                  className={cn(
                    "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-medium tabular-nums",
                    c.occupied
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-dashed text-muted-foreground",
                  )}
                  title={c.occupied ? "Game in progress" : "Empty"}
                >
                  {c.number}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No session running.
          </p>
        )}
      </div>

      {status && (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            status.kind === "ok"
              ? "border-brand-orange/30 bg-brand-orange/5 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {status.text}
        </p>
      )}

      {!snapshot ? (
        <div className={CARD}>
          <p className={SECTION_TITLE}>Session</p>
          <div className="mt-3">
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(devStartSession)}
            >
              Start a session
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={CARD}>
            <p className={SECTION_TITLE}>Players</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 4, 8].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => devAddPlayers(n))}
                >
                  + {n}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Synthetic players, added to the roster and the queue.
            </p>
          </div>

          <div className={CARD}>
            <p className={SECTION_TITLE}>Simulate</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devSeatNextFour)}
              >
                Send next four
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devFillCourts)}
              >
                Fill courts
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => devFinishCourt())}
              >
                Finish a court
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devFinishAllCourts)}
              >
                Finish all courts
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devFormRandomGroup)}
              >
                Form a group
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devSwapRandomNoShow)}
              >
                A player short
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devOverrideRandomSkill)}
              >
                Fix a skill level
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devSetAsideRandom)}
              >
                Set someone aside
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devRequeueRandom)}
              >
                Bring someone back
              </Button>
            </div>
          </div>

          <div className={CARD}>
            <p className={SECTION_TITLE}>Jump to</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link
                className="underline underline-offset-4"
                href={floorPath(snapshot.sessionId)}
              >
                Floor
              </Link>
              <Link
                className="underline underline-offset-4"
                href={displayPath(snapshot.sessionId)}
              >
                Display
              </Link>
              <Link
                className="underline underline-offset-4"
                href={kioskPath(snapshot.sessionId)}
              >
                Kiosk
              </Link>
              <Link
                className="underline underline-offset-4"
                href={sessionPath(snapshot.sessionId)}
              >
                Player view
              </Link>
              {snapshot.volunteerToken && (
                <Link
                  className="underline underline-offset-4"
                  href={volunteerPath(
                    snapshot.sessionId,
                    snapshot.volunteerToken,
                  )}
                >
                  Volunteer link
                </Link>
              )}
              <Link
                className="underline underline-offset-4"
                href={clubQrPath}
              >
                Club QR
              </Link>
            </div>
          </div>

          <div className={cn(CARD, "border-destructive/30")}>
            <p className={SECTION_TITLE}>Wrap up</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || snapshot.lastCall}
                onClick={() => run(devLastCall)}
              >
                Last call
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(devCloseSession)}
              >
                Close session
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => run(devResetSession)}
              >
                Reset (close + restart)
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
