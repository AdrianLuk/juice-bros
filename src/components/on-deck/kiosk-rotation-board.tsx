"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { KioskBoard, type KioskBoardOps } from "@/components/on-deck/kiosk-board";
import {
  kioskAddWalkup,
  kioskConfirmCourt,
  kioskFinishCourt,
  kioskSwapNoShow,
  kioskUndoLastAction,
} from "@/lib/on-deck/actions/kiosk";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/session/rotation-view";

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

  const finish = useMutation({
    mutationFn: ({ court, since }: { court: number; since: number | null }) =>
      kioskFinishCourt(sessionId, court, since),
    onSuccess: handle,
    onError: () => setError("Couldn't end that game. Try again."),
  });
  const swap = useMutation({
    mutationFn: (args: {
      court: number;
      since: number | null;
      outName: string;
      inName: string;
    }) => kioskSwapNoShow(sessionId, args.court, args.since, args.outName, args.inName),
    onSuccess: handle,
    onError: () => setError("Couldn't bring someone in. Try again."),
  });
  const walkup = useMutation({
    mutationFn: (args: { first: string; initial: string; skill: string }) =>
      kioskAddWalkup(sessionId, args.first, args.initial, args.skill),
    onSuccess: handle,
    onError: () => setError("Couldn't add you. Try again."),
  });
  const confirm = useMutation({
    mutationFn: ({ court, since }: { court: number; since: number | null }) =>
      kioskConfirmCourt(sessionId, court, since),
    onSuccess: handle,
    onError: () => setError("Couldn't update that. Try again."),
  });
  const undo = useMutation({
    mutationFn: (expectedSeq: number) => kioskUndoLastAction(sessionId, expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const ops: KioskBoardOps = {
    finishCourt: (court, since) => finish.mutate({ court, since }),
    swapNoShow: (args) => swap.mutate(args),
    addWalkup: (args) => walkup.mutateAsync(args),
    confirmCourt: (court, since) => confirm.mutate({ court, since }),
    undo: (expectedSeq) => undo.mutate(expectedSeq),
  };

  const busy =
    finish.isPending ||
    swap.isPending ||
    walkup.isPending ||
    confirm.isPending ||
    undo.isPending;

  return (
    <KioskBoard
      view={query.data ?? initialView}
      error={error}
      now={now}
      pending={{ any: busy, swap: swap.isPending, walkup: walkup.isPending }}
      ops={ops}
    />
  );
}
