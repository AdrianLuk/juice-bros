"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { useBoardClock } from "@/components/on-deck/use-board-clock";
import {
  FloorBoard,
  type FloorAuth,
  type FloorBoardOps,
} from "@/components/on-deck/floor-board";
import {
  addWalkup,
  bringPlayerBack,
  callLastCall,
  closeSession,
  dissolveGroup,
  finishCourt,
  formGroup,
  lowerGroupCap,
  overridePlayerSkill,
  setPlayerAside,
  swapNoShow,
  undoLastAction,
} from "@/lib/on-deck/actions/floor";
import {
  volunteerAddWalkup,
  volunteerBringPlayerBack,
  volunteerCallLastCall,
  volunteerDissolveGroup,
  volunteerFinishCourt,
  volunteerFormGroup,
  volunteerLowerGroupCap,
  volunteerOverridePlayerSkill,
  volunteerSetPlayerAside,
  volunteerSwapNoShow,
  volunteerUndoLastAction,
} from "@/lib/on-deck/actions/volunteer";
import { getFloorRoster, getRotationView } from "@/lib/on-deck/actions/rotation";
import type {
  FloorRoster,
  RotationView,
} from "@/lib/on-deck/session/rotation-view";
import type { ClubJoinQr } from "@/lib/on-deck/qr-types";

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
 * The floor actions, bound to whoever is driving the board: the Organizer's
 * account-backed Server Actions, or the Volunteer's token-carrying ones.
 * `auth.kind` is checked inline so TypeScript narrows `auth.token`.
 */
function boundFloorActions(sessionId: string, auth: FloorAuth) {
  return {
    finishCourt: (court: number, since: number | null) =>
      auth.kind === "volunteer"
        ? volunteerFinishCourt(sessionId, auth.token, court, since)
        : finishCourt(sessionId, court, since),
    swapNoShow: (
      court: number,
      since: number | null,
      outName: string,
      inName: string,
    ) =>
      auth.kind === "volunteer"
        ? volunteerSwapNoShow(sessionId, auth.token, court, since, outName, inName)
        : swapNoShow(sessionId, court, since, outName, inName),
    setPlayerAside: (name: string) =>
      auth.kind === "volunteer"
        ? volunteerSetPlayerAside(sessionId, auth.token, name)
        : setPlayerAside(sessionId, name),
    bringPlayerBack: (name: string) =>
      auth.kind === "volunteer"
        ? volunteerBringPlayerBack(sessionId, auth.token, name)
        : bringPlayerBack(sessionId, name),
    undo: (expectedSeq: number) =>
      auth.kind === "volunteer"
        ? volunteerUndoLastAction(sessionId, auth.token, expectedSeq)
        : undoLastAction(sessionId, expectedSeq),
    addWalkup: (first: string, initial: string, skill: string) =>
      auth.kind === "volunteer"
        ? volunteerAddWalkup(sessionId, auth.token, first, initial, skill)
        : addWalkup(sessionId, first, initial, skill),
    overrideSkill: (name: string, skill: string) =>
      auth.kind === "volunteer"
        ? volunteerOverridePlayerSkill(sessionId, auth.token, name, skill)
        : overridePlayerSkill(sessionId, name, skill),
    formGroup: (names: string[]) =>
      auth.kind === "volunteer"
        ? volunteerFormGroup(sessionId, auth.token, names)
        : formGroup(sessionId, names),
    lowerGroupCap: (cap: number) =>
      auth.kind === "volunteer"
        ? volunteerLowerGroupCap(sessionId, auth.token, cap)
        : lowerGroupCap(sessionId, cap),
    dissolveGroup: (groupId: string) =>
      auth.kind === "volunteer"
        ? volunteerDissolveGroup(sessionId, auth.token, groupId)
        : dissolveGroup(sessionId, groupId),
    callLastCall: () =>
      auth.kind === "volunteer"
        ? volunteerCallLastCall(sessionId, auth.token)
        : callLastCall(sessionId),
    // Close is the Organizer's alone — a Volunteer link has no close path.
    closeSession: () => closeSession(sessionId),
  };
}

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

  const finish = useMutation({
    mutationFn: ({ number, since }: { number: number; since: number | null }) =>
      actions.finishCourt(number, since),
    onSuccess: handle,
    onError: () => setError("Couldn't end that game. Try again."),
  });

  const swap = useMutation({
    mutationFn: ({
      court,
      since,
      outName,
      inName,
    }: {
      court: number;
      since: number | null;
      outName: string;
      inName: string;
    }) => actions.swapNoShow(court, since, outName, inName),
    onSuccess: handle,
    onError: () => setError("Couldn't make that swap. Try again."),
  });

  const aside = useMutation({
    mutationFn: (name: string) => actions.setPlayerAside(name),
    onSuccess: handle,
    onError: () => setError("Couldn't set that player aside. Try again."),
  });

  const back = useMutation({
    mutationFn: (name: string) => actions.bringPlayerBack(name),
    onSuccess: handle,
    onError: () => setError("Couldn't add that player back. Try again."),
  });

  const undo = useMutation({
    mutationFn: (expectedSeq: number) => actions.undo(expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const walkup = useMutation({
    mutationFn: ({
      first,
      initial,
      skill,
    }: {
      first: string;
      initial: string;
      skill: string;
    }) => actions.addWalkup(first, initial, skill),
    onSuccess: handle,
    onError: () => setError("Couldn't add that walk-up. Try again."),
  });

  const skillOverride = useMutation({
    mutationFn: ({ name, skill }: { name: string; skill: string }) =>
      actions.overrideSkill(name, skill),
    onSuccess: handle,
    onError: () => setError("Couldn't change that skill level. Try again."),
  });

  const group = useMutation({
    mutationFn: (names: string[]) => actions.formGroup(names),
    onSuccess: handle,
    onError: () => setError("Couldn't form that group. Try again."),
  });

  const capChange = useMutation({
    mutationFn: (cap: number) => actions.lowerGroupCap(cap),
    onSuccess: handle,
    onError: () => setError("Couldn't change the cap. Try again."),
  });

  const breakUp = useMutation({
    mutationFn: (groupId: string) => actions.dissolveGroup(groupId),
    onSuccess: handle,
    onError: () => setError("Couldn't break up that group. Try again."),
  });

  const lastCallMut = useMutation({
    mutationFn: () => actions.callLastCall(),
    onSuccess: handle,
    onError: () => setError("Couldn't call it. Try again."),
  });

  const closeMut = useMutation({
    mutationFn: () => actions.closeSession(),
    onSuccess: handle,
    onError: () => setError("Couldn't close the session. Try again."),
  });

  const ops: FloorBoardOps = {
    finishCourt: (number, since) => finish.mutate({ number, since }),
    swapNoShow: (args) => swap.mutate(args),
    setPlayerAside: (name) => aside.mutate(name),
    bringPlayerBack: (name) => back.mutate(name),
    undo: (expectedSeq) => undo.mutate(expectedSeq),
    addWalkup: (args) => walkup.mutateAsync(args),
    overrideSkill: (args) => skillOverride.mutate(args),
    formGroup: (names) => group.mutateAsync(names),
    setGroupCap: (cap) => capChange.mutate(cap),
    dissolveGroup: (groupId) => breakUp.mutate(groupId),
    callLastCall: () => lastCallMut.mutate(),
    closeSession: () => closeMut.mutate(),
  };

  const busy =
    finish.isPending ||
    swap.isPending ||
    aside.isPending ||
    back.isPending ||
    undo.isPending ||
    walkup.isPending ||
    skillOverride.isPending ||
    group.isPending ||
    capChange.isPending ||
    breakUp.isPending ||
    lastCallMut.isPending ||
    closeMut.isPending;

  return (
    <FloorBoard
      view={query.data ?? initialView}
      roster={rosterQuery.data ?? initialRoster}
      joinQr={joinQr}
      auth={auth}
      error={error}
      now={now}
      pending={{
        any: busy,
        swap: swap.isPending,
        walkup: walkup.isPending,
        skill: skillOverride.isPending,
        group: group.isPending || capChange.isPending,
      }}
      ops={ops}
    />
  );
}
