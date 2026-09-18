"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { DisplayBoard } from "@/components/on-deck/display-board";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/session/rotation-view";
import type { ClubJoinQr } from "@/lib/on-deck/qr-types";

function displayQueryKey(sessionId: string) {
  return ["on-deck", "rotation", sessionId, "display"] as const;
}

/**
 * The *live* Display screen (issue #253): `DisplayBoard` wired to the
 * database. Polls `getRotationView` (and listens on Realtime) so it stays
 * current as Players join and Courts turn over.
 *
 * The screen itself lives in `display-board.tsx` and knows none of that,
 * which is what lets the browser-only demo night render the identical screen
 * with no Supabase client in its import graph (#522).
 */
export function DisplayRotationBoard(props: {
  sessionId: string;
  initialView: RotationView;
  joinQr: ClubJoinQr;
}) {
  return (
    <QueryProvider>
      <DisplayRotationBoardInner {...props} />
    </QueryProvider>
  );
}

function DisplayRotationBoardInner({
  sessionId,
  initialView,
  joinQr,
}: {
  sessionId: string;
  initialView: RotationView;
  joinQr: ClubJoinQr;
}) {
  const queryKey = displayQueryKey(sessionId);
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId, undefined),
    refetchInterval: pollInterval,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return <DisplayBoard view={query.data ?? initialView} joinQr={joinQr} now={now} />;
}
