"use client";

import { useState } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { useBoardClock } from "@/components/on-deck/use-board-clock";
import {
  FloorBoard,
  type FloorAuth,
  type FloorBoardOps,
} from "@/components/on-deck/floor-board";
import {
  organizerFloorCommand,
  undoLastAction,
} from "@/lib/on-deck/actions/floor";
import {
  volunteerFloorCommand,
  volunteerUndoLastAction,
} from "@/lib/on-deck/actions/volunteer";
import { getFloorRoster, getRotationView } from "@/lib/on-deck/actions/rotation";
import type {
  FloorRoster,
  RotationView,
} from "@/lib/on-deck/session/rotation-view";
import type { ClubJoinQr } from "@/lib/on-deck/qr-types";
import type {
  FloorCommand,
  FloorCommandKind,
} from "@/lib/on-deck/floor-commands";

const ORGANIZER_AUTH: FloorAuth = { kind: "organizer" };

/**
 * The *live* floor screen (issue #243): `FloorBoard` wired to the database.
 * Polls `getRotationView` (and listens on Realtime) so it stays current as
 * Players join from their phones, and commits every tap through the Server
 * Action for whoever is driving — the Organizer's account-backed path or a
 * link-authenticated Volunteer's.
 *
 * The board itself lives in `floor-board.tsx` and knows none of that, which is
 * what lets the browser-only demo night (#519) render the identical screen
 * with no Supabase client in its import graph.
 */
export function RotationBoard({
  sessionId,
  initialView,
  initialRoster,
  joinQr,
  auth = ORGANIZER_AUTH,
}: {
  sessionId: string;
  initialView: RotationView;
  initialRoster: FloorRoster;
  /** The Club QR, rendered by the server page that has the Club id. */
  joinQr: ClubJoinQr;
  auth?: FloorAuth;
}) {
  return (
    <QueryProvider>
      <RotationBoardInner
        sessionId={sessionId}
        initialView={initialView}
        initialRoster={initialRoster}
        joinQr={joinQr}
        auth={auth}
      />
    </QueryProvider>
  );
}

/**
 * The floor's two Server Actions, bound once to whoever is driving the board:
 * the Organizer's account-backed ones, or the Volunteer's token-carrying ones.
 * Close is not the Volunteer's: its action refuses it (`FLOOR_PERMISSIONS`).
 */
function boundFloorActions(sessionId: string, auth: FloorAuth) {
  if (auth.kind === "volunteer") {
    return {
      send: (command: FloorCommand) =>
        volunteerFloorCommand(sessionId, auth.token, command),
      undo: (expectedSeq: number) =>
        volunteerUndoLastAction(sessionId, auth.token, expectedSeq),
    };
  }
  return {
    send: (command: FloorCommand) => organizerFloorCommand(sessionId, command),
    undo: (expectedSeq: number) => undoLastAction(sessionId, expectedSeq),
  };
}

/** What the Operator sees when a command's request itself fails (thrown, not
 * refused). Confirm Court is the Kiosk's alone and never sent from here. */
const COMMAND_FAILED: Partial<Record<FloorCommandKind, string>> = {
  finishCourt: "Couldn't end that game. Try again.",
  swapNoShow: "Couldn't make that swap. Try again.",
  setAside: "Couldn't set that player aside. Try again.",
  bringBack: "Couldn't add that player back. Try again.",
  addWalkup: "Couldn't add that walk-up. Try again.",
  overrideSkill: "Couldn't change that skill level. Try again.",
  formGroup: "Couldn't form that group. Try again.",
  lowerGroupCap: "Couldn't change the cap. Try again.",
  dissolveGroup: "Couldn't break up that group. Try again.",
  lastCall: "Couldn't call it. Try again.",
  closeSession: "Couldn't close the session. Try again.",
};

function RotationBoardInner({
  sessionId,
  initialView,
  initialRoster,
  joinQr,
  auth,
}: {
  sessionId: string;
  initialView: RotationView;
  initialRoster: FloorRoster;
  joinQr: ClubJoinQr;
  auth: FloorAuth;
}) {
  const queryClient = useQueryClient();
  const authToken = auth.kind === "volunteer" ? auth.token : undefined;
  const queryKey = ["on-deck", "rotation", sessionId, "floor"] as const;
  const rosterKey = ["on-deck", "roster", sessionId, "floor"] as const;
  const pollInterval = useRotationSync(sessionId, [queryKey, rosterKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: pollInterval,
    initialData: initialView,
  });
  const rosterQuery = useQuery({
    queryKey: rosterKey,
    queryFn: () => getFloorRoster(sessionId, authToken),
    refetchInterval: pollInterval,
    initialData: initialRoster,
  });
  const [error, setError] = useState<string | null>(null);
  const { now } = useBoardClock();
  const actions = boundFloorActions(sessionId, auth);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: rosterKey });
  };
  const handle = (result: { ok?: boolean; error?: string }) => {
    setError(result.ok ? null : (result.error ?? "Something went wrong. Try again."));
    refresh();
  };

  // Keyed so `useMutationState` sees every command in flight, not just the
  // latest one this hook fired.
  const commandKey = ["on-deck", "floor-command", sessionId] as const;
  const command = useMutation({
    mutationKey: commandKey,
    mutationFn: actions.send,
    onSuccess: handle,
    onError: (_error, sent) =>
      setError(COMMAND_FAILED[sent.kind] ?? "Something went wrong. Try again."),
  });
  const inFlight = useMutationState({
    filters: { mutationKey: commandKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as FloorCommand).kind,
  });

  const undo = useMutation({
    mutationFn: (expectedSeq: number) => actions.undo(expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const ops: FloorBoardOps = {
    // `onError` has already shown the failure; resolving `ok: false` keeps the
    // walk-up and queue-together forms filled in, as a rejection did.
    send: (sent) => command.mutateAsync(sent).catch(() => ({ ok: false })),
    undo: (expectedSeq) => undo.mutate(expectedSeq),
  };

  return (
    <FloorBoard
      view={query.data ?? initialView}
      roster={rosterQuery.data ?? initialRoster}
      joinQr={joinQr}
      auth={auth}
      error={error}
      now={now}
      pending={{
        any: inFlight.length > 0 || undo.isPending,
        swap: inFlight.includes("swapNoShow"),
        walkup: inFlight.includes("addWalkup"),
        skill: inFlight.includes("overrideSkill"),
        group:
          inFlight.includes("formGroup") || inFlight.includes("lowerGroupCap"),
      }}
      ops={ops}
    />
  );
}
