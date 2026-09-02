"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { startSession } from "@/lib/on-deck/actions/sessions";

/**
 * One-tap Start. A client button rather than a bare `<form action>` for one
 * reason: it passes the Organizer's *local* calendar date, so "is a scheduled
 * session due today" (issue #254) is judged in their time zone and not the
 * server's UTC. `startSession` redirects on success.
 */
export function StartSessionButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      className="mt-4 h-11 px-6 text-base"
      disabled={pending}
      onClick={() =>
        start(() =>
          // `sv-SE` renders a Date as `YYYY-MM-DD` in local time.
          startSession({ today: new Date().toLocaleDateString("sv-SE") }),
        )
      }
    >
      {pending ? "Starting…" : "Start"}
    </Button>
  );
}
