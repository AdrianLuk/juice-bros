"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { crowdMove, demoPoll, demoReduce, demoStart } from "@/lib/mic-drop/demo";
import { ChartView } from "./chart-view";

/** How often a made-up phone in the room votes or switches. */
const CROWD_EVERY_MS = 2_400;

/**
 * The landing's demo: the Guest Link's real chart on a made-up karaoke night
 * that runs in this browser only. Tap a name to vote, tap another to switch,
 * while a made-up room votes around you; close voting to see No. 1.
 */
export function DemoBoard() {
  const [state, dispatch] = useReducer(demoReduce, undefined, demoStart);
  const latest = useRef(state);
  const frame = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    latest.current = state;
  });

  // The room only votes while the demo is on screen, so it never moves unseen.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || !state.open) return;
    const timer = window.setInterval(() => {
      const move = crowdMove(latest.current, Math.random);
      if (move) dispatch(move);
    }, CROWD_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [onScreen, state.open]);

  return (
    <div ref={frame} className="md-demo">
      <div className="md-demo-screen">
        <ChartView
          poll={demoPoll(state)}
          reconnecting={false}
          problem={null}
          saving={null}
          onTap={(contestantId) => dispatch({ kind: "tap", contestantId })}
          liveLabel="Live demo"
          title="h3"
        />
      </div>
      <div className="md-demo-controls">
        <button
          type="button"
          className="md-btn"
          onClick={() => dispatch({ kind: state.open ? "close" : "reopen" })}
        >
          {state.open ? "Close voting" : "Reopen voting"}
        </button>
        <button type="button" className="md-quiet" onClick={() => dispatch({ kind: "restart" })}>
          Start over
        </button>
      </div>
      <p className="md-demo-note">A demo. The other phones are made up, and nothing is saved.</p>
    </div>
  );
}
