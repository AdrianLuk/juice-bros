"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { useFloorCommand } from "@/components/on-deck/use-floor-command";
import { KioskBoard, type KioskBoardOps } from "@/components/on-deck/kiosk-board";
import {
  kioskFloorCommand,
  kioskUndoLastAction,
} from "@/lib/on-deck/actions/kiosk";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/session/rotation-view";
import type {
  FloorCommand,
  FloorCommandKind,
} from "@/lib/on-deck/floor-commands";

/** What the Kiosk shows when a command's request itself fails (thrown, not
 * refused): its own wording, which differs from the Floor's for a swap and an
 * add. */
const COMMAND_FAILED: Partial<Record<FloorCommandKind, string>> = {
  finishCourt: "Couldn't end that game. Try again.",
  swapNoShow: "Couldn't bring someone in. Try again.",
  addWalkup: "Couldn't add you. Try again.",
  confirmCourt: "Couldn't update that. Try again.",
};

/**
 * The *live* Kiosk (issue #259): `KioskBoard` wired to the database. Polls
 * `getRotationView` (and listens on Realtime) and commits every tap through
 * the Kiosk's Server Actions — the Session id in the URL is the whole
 * credential (ADR 0005).
 *
 * The screen itself lives in `kiosk-board.tsx` and knows none of that, which
 * is what lets the browser-only demo night render the identical screen with
 * no Supabase client in its import graph (#522).
 */
export function KioskRotationBoard({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  return (
    <QueryProvider>
      <KioskRotationBoardInner sessionId={sessionId} initialView={initialView} />
    </QueryProvider>
  );
}

function KioskRotationBoardInner({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["on-deck", "rotation", sessionId, "kiosk"] as const;
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: pollInterval,
    initialData: initialView,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const handle = (result: { ok?: boolean; error?: string }) => {
    setError(result.ok ? null : (result.error ?? "Something went wrong. Try again."));
    refresh();
  };

  const { command, inFlight } = useFloorCommand({
    mutationKey: ["on-deck", "kiosk-command", sessionId],
    mutationFn: (sent: FloorCommand) => kioskFloorCommand(sessionId, sent),
    onSuccess: handle,
    onError: (_error, sent) =>
      setError(COMMAND_FAILED[sent.kind] ?? "Something went wrong. Try again."),
  });
  const undo = useMutation({
    mutationFn: (expectedSeq: number) => kioskUndoLastAction(sessionId, expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const ops: KioskBoardOps = {
    // `onError` has already shown the failure; resolving `ok: false` keeps the
    // "add me" form filled in, as a rejection did.
    send: (sent) => command.mutateAsync(sent).catch(() => ({ ok: false })),
    undo: (expectedSeq) => undo.mutate(expectedSeq),
  };

  return (
    <KioskBoard
      view={query.data ?? initialView}
      error={error}
      now={now}
      pending={{
        any: inFlight.length > 0 || undo.isPending,
        swap: inFlight.includes("swapNoShow"),
        walkup: inFlight.includes("addWalkup"),
      }}
      ops={ops}
    />
  );
}
