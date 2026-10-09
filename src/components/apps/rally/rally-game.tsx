"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { HOSTS, otherHost, type HostId } from "./hosts";
import {
  createGame,
  isLive,
  scoreCall,
  setPaused,
  setSlow,
  startGame,
  step,
  type Game,
  type Phase,
  type PointReason,
  type Side,
} from "./lib/rules";
import type { RallyView } from "./scene";

/** The longest step a frame may take, so a stall (a hidden tab, a slow frame) doesn't jump the ball. */
const MAX_STEP = 0.05;
/** How long the court keeps moving after the last point, for the winner's cheer. */
const AFTER_OVER_MS = 1500;
/** Feet per CSS pixel of drag, per pixel of the court's width, past the court's horizon. */
const DRAG_FEET = 34;
/** A pointer that moves less than this (CSS px) and lifts is a tap: it serves. */
const TAP_SLOP = 10;

const KEYS: Record<string, { x: number; z: number }> = {
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
};

const REASONS: Record<PointReason, string> = {
  out: "out",
  net: "into the net",
  "double-bounce": "two bounces",
  fault: "a fault",
};

/** The game's words, with the opponent named. */
function copyFor(opponent: string) {
  return {
    serves: { player: "you serve", ai: `${opponent} serves` },
    point: { won: "Point to you", lost: `Point to ${opponent}` },
    over: {
      won: `You beat ${opponent}. Screenshot it before they ask for a rematch.`,
      lost: `${opponent} wins this one.`,
    },
    paused: `${opponent} is waiting at the kitchen line.`,
  };
}

/** What the game's UI shows: kept in React state, changed only by events. */
type Hud = {
  phase: Phase;
  paused: boolean;
  slow: boolean;
  score: Record<Side, number>;
  winner: Side | null;
  server: Side;
  call: string;
};

const hudFor = (game: Game, call: string): Hud => ({
  phase: game.phase,
  paused: game.paused,
  slow: game.slow,
  score: { ...game.score },
  winner: game.winner,
  server: game.server,
  call,
});

const pill = "rounded-full bg-black/70 backdrop-blur-sm";

/**
 * The Rally game: pick a host, then play the other one, first to 11. The
 * court is a canvas of its own (Three.js loads after the first paint, and
 * only on this page); in play it fills the screen, with the score, Pause and
 * the Dink pad over it, and a polite live region announces the serve, each
 * point with the score, pauses and the result. Nothing moves before Start.
 * Under reduced motion slow mode starts on; anyone can switch it.
 */
export function RallyGame({ describedBy }: { describedBy: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<RallyView | null>(null);
  const gameRef = useRef<Game>(createGame());
  const frameRef = useRef(0);
  const keysHeld = useRef(new Set<string>());
  const serveRef = useRef(false);
  const dinkRef = useRef(false);
  const drag = useRef({ x: 0, z: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  const [host, setHost] = useState<HostId>("adrian");
  const opponent = HOSTS[otherHost(host)].name;
  const copy = copyFor(opponent);
  const copyRef = useRef(copy);
  copyRef.current = copy;

  const [view, setView] = useState<"loading" | "ready" | "unavailable">("loading");
  const [announcement, setAnnouncement] = useState("");
  const [dinkHeld, setDinkHeld] = useState(false);
  const [hud, setHud] = useState<Hud>(() => hudFor(gameRef.current, ""));

  const callFor = (game: Game) => scoreCall(game, copyRef.current.serves);

  const draw = useCallback(() => {
    viewRef.current?.draw(gameRef.current, 0);
  }, []);

  /** The game loop: one step a frame while the game runs, then a draw. */
  const loop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    let last = performance.now();
    let overAt = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP);
      last = now;
      const move = { x: 0, z: 0 };
      for (const key of keysHeld.current) {
        move.x += KEYS[key].x;
        move.z += KEYS[key].z;
      }
      const before = gameRef.current;
      const game = step(before, dt, {
        move,
        drag: drag.current,
        serve: serveRef.current,
        dink: dinkRef.current,
      });
      serveRef.current = false;
      drag.current = { x: 0, z: 0 };
      gameRef.current = game;
      viewRef.current?.draw(game, dt);

      const words = copyRef.current;
      for (const event of game.events) {
        if (event.type !== "point") continue;
        const won = event.winner === "player";
        const line = `${won ? words.point.won : words.point.lost}: ${REASONS[event.reason]}.`;
        if (game.phase === "over") {
          const message = `${won ? words.over.won : words.over.lost} ${game.score.player}–${game.score.ai}.`;
          setAnnouncement(`${line} ${message}`);
          setHud(hudFor(game, message));
        } else {
          const call = scoreCall(game, words.serves);
          setAnnouncement(`${line} ${call}.`);
          setHud(hudFor(game, `${line} ${call}`));
        }
      }
      if (before.phase !== game.phase) setHud((s) => ({ ...s, phase: game.phase }));

      if (game.phase === "over" && !overAt) overAt = now;
      const settling = game.phase === "over" && now - overAt < AFTER_OVER_MS;
      if ((game.phase !== "over" || settling) && !game.paused) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  // Three.js is the page's heaviest code: it loads after the first paint.
  useEffect(() => {
    let cancelled = false;
    let created: RallyView | null = null;
    const id = requestAnimationFrame(async () => {
      // Slow mode starts on under reduced motion, before Start can be pressed.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gameRef.current = setSlow(gameRef.current, true);
        setHud((s) => ({ ...s, slow: true }));
      }
      try {
        const { createRallyView } = await import("./scene");
        if (cancelled || !canvasRef.current) return;
        created = await createRallyView(canvasRef.current, "adrian");
        if (cancelled) {
          created.dispose();
          return;
        }
        viewRef.current = created;
        created.setEffects(!gameRef.current.slow);
        created.draw(gameRef.current, 0);
        setView("ready");
      } catch {
        // No WebGL, or a stale chunk after a deploy.
        if (!cancelled) setView("unavailable");
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      cancelAnimationFrame(frameRef.current);
      created?.dispose();
      viewRef.current = null;
    };
  }, []);

  const pause = useCallback(
    (paused: boolean) => {
      const game = gameRef.current;
      if (!isLive(game.phase) || game.paused === paused) return;
      keysHeld.current.clear();
      dinkRef.current = false;
      setDinkHeld(false);
      gameRef.current = setPaused(game, paused);
      setHud((s) => ({ ...s, paused }));
      setAnnouncement(paused ? "Paused" : "Resumed");
      if (paused) {
        cancelAnimationFrame(frameRef.current);
        draw();
      } else {
        loop();
      }
    },
    [draw, loop],
  );

  // A hidden tab pauses the game.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Paused or over: focus the way back in. (Playing, the court has focus: it takes the keys.)
  useEffect(() => {
    if (hud.paused) resumeRef.current?.focus();
  }, [hud.paused]);
  useEffect(() => {
    if (hud.phase === "over") actionRef.current?.focus();
  }, [hud.phase]);

  function pick(next: HostId) {
    setHost(next);
    viewRef.current?.setHosts(next);
  }

  function begin() {
    const fresh = startGame(createGame({ seed: Date.now() % 100_000, slow: gameRef.current.slow }));
    gameRef.current = fresh;
    setHud(hudFor(fresh, callFor(fresh)));
    setAnnouncement(`${callFor(fresh)}.`);
    // The stage goes full screen this render; focus the court once it has.
    requestAnimationFrame(() => surfaceRef.current?.focus());
    draw();
    loop();
  }

  function resume() {
    pause(false);
    surfaceRef.current?.focus();
  }

  function toggleSlow(slow: boolean) {
    gameRef.current = setSlow(gameRef.current, slow);
    viewRef.current?.setEffects(!slow);
    setHud((s) => ({ ...s, slow }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "p" || event.key === "P") {
      const game = gameRef.current;
      if (!isLive(game.phase)) return;
      event.preventDefault();
      if (game.paused) resume();
      else pause(true);
      return;
    }
    // The court takes the arrows and Space; the buttons keep their own keys.
    if (event.target !== surfaceRef.current) return;
    if (event.key in KEYS) {
      event.preventDefault();
      keysHeld.current.add(event.key);
    } else if (event.key === " ") {
      // Pressed, it serves; held, the next shot is a dink.
      event.preventDefault();
      if (!event.repeat) serveRef.current = true;
      setDinking(true);
    }
  }

  function onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    keysHeld.current.delete(event.key);
    if (event.key === " ") setDinking(false);
  }

  /** Space or the Dink pad held: kept in a ref for the loop, and in state for the pad's look. */
  function setDinking(on: boolean) {
    dinkRef.current = on;
    setDinkHeld(on);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // The first finger keeps the court: a second never takes its drag over.
    if (pointer.current) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    p.x = event.clientX;
    p.y = event.clientY;
    p.moved += Math.hypot(dx, dy);
    const game = gameRef.current;
    if (game.paused) return;
    // The player's image keeps pace with the finger, near the net as at the baseline.
    const { clientWidth, clientHeight } = event.currentTarget;
    const from = {
      x: game.player.x + game.dragLeft.x + drag.current.x,
      z: game.player.z + game.dragLeft.z + drag.current.z,
    };
    const feet = DRAG_FEET / Math.max(1, clientWidth);
    const moved = viewRef.current?.drag(from, {
      x: (2 * dx) / Math.max(1, clientWidth),
      y: (-2 * dy) / Math.max(1, clientHeight),
    }) ?? { x: dx * feet, z: dy * feet };
    drag.current = { x: drag.current.x + moved.x, z: drag.current.z + moved.z };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    pointer.current = null;
    if (p && p.id === event.pointerId && p.moved < TAP_SLOP) serveRef.current = true;
  }

  const playing = isLive(hud.phase);
  /** In play and not paused: the court fills the screen. */
  const filled = playing && !hud.paused;
  const ready = view === "ready";
  const you = HOSTS[host].name;

  return (
    <div
      ref={stageRef}
      data-phase={hud.phase}
      data-view={view}
      className={
        filled
          ? "fixed inset-0 z-[100] bg-(--bx-bg)"
          : "relative aspect-[3/4] w-full overflow-hidden rounded-(--bx-radius) bg-(--bx-bg) shadow-[0_0_0_1px_var(--bx-line-soft)] sm:aspect-[16/10]"
      }
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={(event) => {
        // Focus left the game: the keys can't reach it, so pause.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pause(true);
      }}
    >
      <div ref={canvasRef} className="absolute inset-0" />

      {/* The court: in play it takes the keys, the drag and the tap. */}
      <div
        ref={surfaceRef}
        role="application"
        aria-label="Pickleball game"
        aria-describedby={describedBy}
        tabIndex={playing ? 0 : -1}
        className={`absolute inset-0 touch-none select-none focus-visible:outline-offset-[-6px] ${filled ? "" : "pointer-events-none"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointer.current = null)}
        onLostPointerCapture={(event) => {
          if (pointer.current?.id === event.pointerId) pointer.current = null;
        }}
      />

      {filled && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
            <dl className={`${pill} font-[family-name:var(--font-arena)] flex gap-5 px-5 py-2 text-lg font-bold uppercase`}>
              <div className="flex items-baseline gap-2">
                <dt className="text-(--bx-accent)">{you}</dt>
                <dd className="tabular-nums">{hud.score.player}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-(--bx-muted)">{opponent}</dt>
                <dd className="tabular-nums">{hud.score.ai}</dd>
              </div>
            </dl>
            <div className="pointer-events-auto flex gap-2">
              <button type="button" className="bx-btn bx-btn-ghost bg-black/70" onClick={begin}>
                Restart
              </button>
              <button type="button" className="bx-btn bx-btn-ghost bg-black/70" onClick={() => pause(true)}>
                Pause
              </button>
            </div>
          </div>
          <p
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] px-4 text-center text-sm font-semibold [text-shadow:0_1px_6px_#000]"
          >
            {hud.call}
            {hud.phase === "serving" && hud.server === "player" && (
              <span className="block pt-1 text-(--bx-accent)">Space or tap to serve</span>
            )}
          </p>
          {/* Held, your next shot is a dink. Keyboard players hold Space on the
              court instead, so the pad stays out of the accessibility tree. */}
          <div
            aria-hidden="true"
            data-held={dinkHeld}
            className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex h-14 min-w-36 touch-none items-center justify-center rounded-full border-2 border-(--bx-accent) bg-black/70 px-8 text-sm font-bold tracking-widest uppercase select-none data-[held=true]:bg-(--bx-accent) data-[held=true]:text-white sm:right-6"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDinking(true);
            }}
            // Pressing it mustn't take focus off the court: that would pause the game.
            onMouseDown={(event) => event.preventDefault()}
            onPointerUp={() => setDinking(false)}
            onPointerCancel={() => setDinking(false)}
            onLostPointerCapture={() => setDinking(false)}
          >
            Dink
          </div>
        </>
      )}

      {playing && hud.paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-5 text-center">
          <div className="flex max-w-sm flex-col items-center gap-5">
            <h2 className="bx-h2 text-2xl">Paused</h2>
            <p className="font-[family-name:var(--font-arena)] text-4xl font-extrabold tabular-nums">
              {you} {hud.score.player}–{hud.score.ai} {opponent}
            </p>
            <p className="text-(--bx-muted)">{copy.paused}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button ref={resumeRef} type="button" className="bx-btn bx-btn-play" onClick={resume}>
                Resume
              </button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={begin}>
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {!playing && (
        <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/95 via-black/80 via-60% to-black/10 p-5 sm:items-center sm:bg-linear-to-r sm:from-black/85 sm:via-black/40 sm:via-50% sm:to-transparent sm:p-8">
          <div className="flex max-w-sm flex-col items-start gap-5">
            {hud.phase === "over" ? (
              <>
                <h2 className="bx-h2 text-2xl">
                  {hud.winner === "player" ? copy.over.won : copy.over.lost}
                </h2>
                <p className="font-[family-name:var(--font-arena)] text-5xl font-extrabold tabular-nums">
                  {hud.score.player}–{hud.score.ai}
                </p>
              </>
            ) : (
              <h2 className="bx-h2 text-2xl">Who are you playing as?</h2>
            )}
            <fieldset>
              <legend className="sr-only">Play as</legend>
              <div className="flex gap-2">
                {(["adrian", "daven"] as const).map((id) => (
                  <label
                    key={id}
                    className="cursor-pointer rounded-full border border-(--bx-line) px-4 py-2 text-[0.9375rem] font-semibold has-checked:border-(--bx-accent) has-checked:bg-(--bx-accent) has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
                  >
                    <input
                      type="radio"
                      name="rally-host"
                      value={id}
                      checked={host === id}
                      onChange={() => pick(id)}
                      className="sr-only"
                    />
                    {HOSTS[id].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[0.9375rem] text-(--bx-muted)">
              You&apos;re {you}, and {opponent} is across the net. First to 11, win by 2.
            </p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                checked={hud.slow}
                onChange={(e) => toggleSlow(e.target.checked)}
                className="mt-1 size-5 accent-(--bx-accent)"
                aria-describedby="rally-slow-description"
              />
              <span>
                <span className="font-semibold">Slow mode</span>
                <span id="rally-slow-description" className="block text-sm text-(--bx-muted)">
                  Half speed, for the ball and {opponent} alike.
                </span>
              </span>
            </label>
            {view === "unavailable" ? (
              <p className="text-(--bx-muted)">
                This browser can&apos;t draw the court (WebGL is off or not supported), so the
                game can&apos;t run here.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button
                  ref={actionRef}
                  type="button"
                  className="bx-btn bx-btn-play"
                  disabled={!ready}
                  onClick={begin}
                >
                  {hud.phase === "over" ? "Play again" : "Start"}
                </button>
                {/* Kept in the flow once the court is ready, so nothing shifts. */}
                <p className={`text-sm text-(--bx-muted) ${ready ? "invisible" : ""}`}>
                  Setting up the court…
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
