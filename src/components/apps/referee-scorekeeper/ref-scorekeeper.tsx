"use client";

import { useEffect, useState } from "react";

import { clear, load, type Persisted } from "@/components/apps/referee-scorekeeper/lib/persistence/match-storage";
import type { MatchConfig, MatchEvent } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

import { MatchScreen } from "./match-screen";
import { MatchSetup } from "./match-setup";
import { ResumePrompt } from "./resume-prompt";

type Phase =
  | { kind: "loading" }
  | { kind: "resume"; saved: Persisted }
  | { kind: "setup" }
  | { kind: "match"; config: MatchConfig; events: MatchEvent[]; session: number };

/**
 * Owns the storage handshake and which screen is up. `MatchScreen` owns the
 * live match; remounting it with a new `session` key is how a fresh match
 * starts from a clean event log.
 */
export function RefScorekeeper() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  // The resume check runs in an effect, never during render. localStorage does
  // not exist on the server, so reading it while rendering would hydrate a
  // different tree than the server sent. A one-shot setState on mount is the
  // point of this effect, not an accident of it.
  useEffect(() => {
    const saved = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store on mount
    setPhase(
      saved && saved.events.length > 0
        ? { kind: "resume", saved }
        : { kind: "setup" }
    );
  }, []);

  useEffect(() => {
    // Registered from this route only, so the rest of the site is untouched.
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/referee-scorekeeper-sw.js", { scope: "/apps/referee-scorekeeper" })
      .catch(() => {
        // Offline caching is a nicety; a failed registration must not break play.
      });
  }, []);

  const startFresh = (config: MatchConfig) => {
    clear();
    setPhase({ kind: "match", config, events: [], session: Date.now() });
  };

  switch (phase.kind) {
    case "loading":
      return <div className="min-h-64" aria-busy="true" />;

    case "resume":
      return (
        <ResumePrompt
          saved={phase.saved}
          onResume={() =>
            setPhase({
              kind: "match",
              config: phase.saved.config,
              events: phase.saved.events,
              session: phase.saved.savedAt,
            })
          }
          onDiscard={() => {
            clear();
            setPhase({ kind: "setup" });
          }}
        />
      );

    case "setup":
      return <MatchSetup onStart={startFresh} />;

    case "match":
      return (
        <MatchScreen
          key={phase.session}
          config={phase.config}
          initialEvents={phase.events}
          onNewMatch={() => {
            clear();
            setPhase({ kind: "setup" });
          }}
        />
      );
  }
}
