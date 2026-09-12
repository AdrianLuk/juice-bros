"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pickWinner, reelNames } from "@/components/apps/drum-roll/lib/engine/draw";
import {
  eligibleFor,
  entrantById,
  nextPrize,
  reduceRaffle,
  ticketsIn,
} from "@/components/apps/drum-roll/lib/engine/fold";
import { freshSeed } from "@/components/apps/drum-roll/lib/engine/random";
import type {
  RaffleEvent,
  RedrawReason,
} from "@/components/apps/drum-roll/lib/engine/types";
import {
  clear as clearLog,
  load as loadLog,
  save as saveLog,
} from "@/components/apps/drum-roll/lib/persistence/log-storage";

type Mode = "setup" | "signin" | "draw";

const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded border border-[var(--bx-line)] bg-[var(--bx-raised)] px-3 py-2 text-sm font-medium text-[var(--bx-ink)] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)] disabled:cursor-not-allowed disabled:opacity-40";

const PRIMARY =
  "inline-flex items-center justify-center rounded bg-[var(--brand-orange)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)] disabled:cursor-not-allowed disabled:opacity-40";

const FIELD =
  "w-full rounded border border-[var(--bx-line)] bg-[var(--bx-raised)] px-3 py-2 text-base text-[var(--bx-ink)] placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]";

const LABEL = "block text-xs font-medium uppercase tracking-wider text-[var(--bx-muted)]";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/**
 * Drum Roll: the raffle bucket, the draw, and the record of what came out.
 *
 * Everything on screen is a fold over an append-only log (`reduceRaffle`), so
 * Undo is dropping the last event, and the log is what gets written to storage
 * after every single tap. The night has to survive a pocketed phone.
 *
 * The draw itself is deliberately not a surprise to the machine: the seed is
 * generated and shown *before* the button is pressed, the winner is
 * `pickWinner(pool, seed)`, and the reel that follows is presentation of a
 * decision already recorded. That ordering is the whole reason a room can
 * check the result instead of taking it on trust.
 */
export function DrumRoll() {
  const [events, setEvents] = useState<readonly RaffleEvent[]>([]);
  const [restored, setRestored] = useState(false);
  const [mode, setMode] = useState<Mode>("setup");

  const state = useMemo(() => reduceRaffle(events), [events]);

  // Restore before anything can be written, so an empty first render never
  // saves over the night already in this browser. Deferred a frame rather than
  // read during render: storage does not exist on the server, and a render that
  // reached for it would hand the client a different first paint than the one
  // it is hydrating.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setEvents(loadLog());
      setRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!restored) return;
    saveLog(events);
  }, [restored, events]);

  const append = useCallback((...added: RaffleEvent[]) => {
    setEvents((previous) => [...previous, ...added]);
  }, []);

  const undo = useCallback(() => {
    setEvents((previous) => previous.slice(0, -1));
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--bx-line-soft)] pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--bx-ink)]">Drum Roll</h1>
          <p className="mt-1 text-sm text-[var(--bx-muted)]">
            Names in, prizes out, and a draw the room can check.
          </p>
        </div>
        <button
          type="button"
          className={BUTTON}
          onClick={undo}
          disabled={events.length === 0}
        >
          Undo last
        </button>
      </header>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Screens">
        {(
          [
            ["setup", "Set up"],
            ["signin", "Sign-in"],
            ["draw", "Draw"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={mode === value ? "page" : undefined}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "rounded border border-[var(--bx-line-2)] bg-[var(--bx-raised-2)] px-3 py-2 text-sm font-semibold text-[var(--bx-ink)]"
                : BUTTON
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mt-6">
        {mode === "setup" ? (
          <Setup state={state} append={append} onClearAll={() => setEvents([])} />
        ) : null}
        {mode === "signin" ? <SignIn state={state} append={append} /> : null}
        {mode === "draw" ? <Draw state={state} append={append} /> : null}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ set up */

function Setup({
  state,
  append,
  onClearAll,
}: {
  state: ReturnType<typeof reduceRaffle>;
  append: (...events: RaffleEvent[]) => void;
  onClearAll: () => void;
}) {
  const [prizeName, setPrizeName] = useState("");
  const [entrantName, setEntrantName] = useState("");
  const [tickets, setTickets] = useState(1);
  const [bulk, setBulk] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);

  const addPrize = () => {
    const name = prizeName.trim();
    if (!name) return;
    append({ type: "PRIZE_ADDED", id: newId(), name });
    setPrizeName("");
  };

  const addEntrant = () => {
    const name = entrantName.trim();
    if (!name) return;
    append({ type: "ENTRANT_ADDED", id: newId(), name, tickets });
    setEntrantName("");
    setTickets(1);
  };

  const addBulk = () => {
    const names = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    append(
      ...names.map(
        (name): RaffleEvent => ({
          type: "ENTRANT_ADDED",
          id: newId(),
          name,
          tickets: 1,
        }),
      ),
    );
    setBulk("");
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[var(--bx-ink)]">Prizes</h2>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="drum-roll-prize">
            Prize name
          </label>
          <input
            id="drum-roll-prize"
            className={`${FIELD} flex-1 min-w-[12rem]`}
            placeholder="Paddle, gift card, hoodie"
            value={prizeName}
            onChange={(event) => setPrizeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addPrize();
              }
            }}
          />
          <button type="button" className={PRIMARY} onClick={addPrize}>
            Add prize
          </button>
        </div>

        {state.prizes.length === 0 ? (
          <p className="text-sm text-[var(--bx-muted)]">
            Prizes are drawn in the order you add them.
          </p>
        ) : (
          <ol className="flex flex-col border-t border-[var(--bx-line-soft)]">
            {state.prizes.map((prize) => {
              const winner = entrantById(state, prize.winnerId);
              return (
                <li
                  key={prize.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bx-line-soft)] py-2"
                >
                  <span className="text-sm text-[var(--bx-ink)]">{prize.name}</span>
                  <span className="flex items-center gap-3">
                    {winner ? (
                      <span className="text-sm font-medium text-[var(--brand-orange)]">
                        {winner.name}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--bx-muted)]">Not drawn</span>
                    )}
                    <button
                      type="button"
                      className="text-xs text-[var(--bx-muted)] underline hover:text-white"
                      onClick={() =>
                        append({ type: "PRIZE_REMOVED", id: prize.id })
                      }
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[var(--bx-ink)]">
          Entrants{" "}
          <span className="font-normal text-[var(--bx-muted)]">
            ({state.entrants.length}, {ticketsIn(state.entrants)} tickets)
          </span>
        </h2>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <label className={LABEL} htmlFor="drum-roll-entrant">
              Name
            </label>
            <input
              id="drum-roll-entrant"
              className={`${FIELD} mt-1`}
              placeholder="Ben Johns"
              value={entrantName}
              onChange={(event) => setEntrantName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addEntrant();
                }
              }}
            />
          </div>
          <div className="w-24">
            <label className={LABEL} htmlFor="drum-roll-tickets">
              Tickets
            </label>
            <input
              id="drum-roll-tickets"
              type="number"
              min={0}
              max={999}
              className={`${FIELD} mt-1`}
              value={tickets}
              onChange={(event) => setTickets(Number(event.target.value))}
            />
          </div>
          <button type="button" className={PRIMARY} onClick={addEntrant}>
            Add
          </button>
        </div>

        <details className="rounded border border-[var(--bx-line-soft)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--bx-ink)]">
            Paste a list
          </summary>
          <p className="mt-2 text-sm text-[var(--bx-muted)]">
            One name per line. Everyone lands with a single ticket, which you
            can change below.
          </p>
          <textarea
            className={`${FIELD} mt-2 h-32 font-mono text-sm`}
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            placeholder={"Anna Leigh Waters\nBen Johns\nCatherine Parenteau"}
          />
          <button type="button" className={`${BUTTON} mt-2`} onClick={addBulk}>
            Add everyone
          </button>
        </details>

        {state.entrants.length === 0 ? (
          <p className="text-sm text-[var(--bx-muted)]">Nobody in the bucket yet.</p>
        ) : (
          <ul className="flex flex-col border-t border-[var(--bx-line-soft)]">
            {state.entrants.map((entrant) => (
              <li
                key={entrant.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bx-line-soft)] py-2"
              >
                <span className="text-sm text-[var(--bx-ink)]">{entrant.name}</span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${BUTTON} h-8 w-8 p-0 text-base`}
                    aria-label={`One fewer ticket for ${entrant.name}`}
                    onClick={() =>
                      append({
                        type: "TICKETS_SET",
                        id: entrant.id,
                        tickets: entrant.tickets - 1,
                      })
                    }
                  >
                    &minus;
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums text-[var(--bx-ink)]">
                    {entrant.tickets}
                  </span>
                  <button
                    type="button"
                    className={`${BUTTON} h-8 w-8 p-0 text-base`}
                    aria-label={`One more ticket for ${entrant.name}`}
                    onClick={() =>
                      append({
                        type: "TICKETS_SET",
                        id: entrant.id,
                        tickets: entrant.tickets + 1,
                      })
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ml-1 text-xs text-[var(--bx-muted)] underline hover:text-white"
                    onClick={() =>
                      append({ type: "ENTRANT_REMOVED", id: entrant.id })
                    }
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--bx-line-soft)] pt-6">
        <h2 className="text-lg font-semibold text-[var(--bx-ink)]">House rule</h2>
        <label className="flex items-start gap-3 text-sm text-[var(--bx-ink)]">
          <input
            type="checkbox"
            id="drum-roll-one-per-person"
            className="mt-1 size-4 accent-[var(--brand-orange)]"
            checked={state.onePrizePerPerson}
            onChange={(event) =>
              append({
                type: "ONE_PRIZE_PER_PERSON_SET",
                value: event.target.checked,
              })
            }
          />
          <span>
            One prize per person. Turn this off to match a physical bucket,
            where your other tickets stay in and you can win twice. Whichever
            is set shows on the draw screen.
          </span>
        </label>

        <div className="mt-2">
          {confirmingClear ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--bx-ink)]">
                Clear every name, prize and result?
              </span>
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  clearLog();
                  onClearAll();
                  setConfirmingClear(false);
                }}
              >
                Yes, start over
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => setConfirmingClear(false)}
              >
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={BUTTON}
              onClick={() => setConfirmingClear(true)}
            >
              Start over
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- sign-in */

/**
 * The shared-device screen: one tablet or phone on the prize table, and people
 * put themselves in. This is the part that stands in for the QR nobody could
 * print, and it needs nothing but the device it is already running on.
 */
function SignIn({
  state,
  append,
}: {
  state: ReturnType<typeof reduceRaffle>;
  append: (...events: RaffleEvent[]) => void;
}) {
  const [name, setName] = useState("");
  const [tickets, setTickets] = useState(1);
  const [justAdded, setJustAdded] = useState<{ name: string; tickets: number } | null>(
    null,
  );
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    append({ type: "ENTRANT_ADDED", id: newId(), name: trimmed, tickets });
    setJustAdded({ name: trimmed, tickets });
    setName("");
    setTickets(1);
    field.current?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border border-[var(--bx-line-soft)] p-6">
        <label
          className="block text-lg font-semibold text-[var(--bx-ink)]"
          htmlFor="drum-roll-signin-name"
        >
          Your name
        </label>
        <input
          id="drum-roll-signin-name"
          ref={field}
          className="mt-3 w-full rounded border border-[var(--bx-line)] bg-[var(--bx-raised)] px-4 py-4 text-2xl text-[var(--bx-ink)] placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
          placeholder="First and last"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className={LABEL} htmlFor="drum-roll-signin-tickets">
              Tickets
            </label>
            <input
              id="drum-roll-signin-tickets"
              type="number"
              min={1}
              max={999}
              className={`${FIELD} mt-1 text-xl`}
              value={tickets}
              onChange={(event) => setTickets(Number(event.target.value))}
            />
          </div>
          <button
            type="button"
            onClick={add}
            className="flex-1 rounded bg-[var(--brand-orange)] px-6 py-4 text-xl font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
          >
            Put me in
          </button>
        </div>
      </div>

      <p aria-live="polite" className="min-h-8 text-lg text-[var(--bx-ink)]">
        {justAdded ? (
          <span>
            <strong>{justAdded.name}</strong>, you&apos;re in with{" "}
            {justAdded.tickets} {justAdded.tickets === 1 ? "ticket" : "tickets"}.
          </span>
        ) : null}
      </p>

      <p className="text-sm text-[var(--bx-muted)]">
        {state.entrants.length} in the bucket, {ticketsIn(state.entrants)} tickets
        between them.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- draw */

interface Reel {
  readonly names: readonly string[];
  readonly winnerId: string;
  readonly prizeId: string;
}

function Draw({
  state,
  append,
}: {
  state: ReturnType<typeof reduceRaffle>;
  append: (...events: RaffleEvent[]) => void;
}) {
  const [seed, setSeed] = useState<number | null>(null);
  const [reel, setReel] = useState<Reel | null>(null);
  const [at, setAt] = useState(0);

  /**
   * The prize in hand. Normally the first one nobody holds, but while a reveal
   * is up it stays pinned to the prize that reveal belongs to.
   *
   * Without the pin the screen races itself: recording the draw gives the
   * prize a winner, `nextPrize` immediately moves on to the following one, and
   * the winner the room is waiting to hear is replaced before anyone has read
   * it. The reveal, and the choice between "they took it" and "not here", has
   * to outlive the event that produced it.
   */
  const pending = nextPrize(state);
  const prize =
    (reel ? state.prizes.find((candidate) => candidate.id === reel.prizeId) : null) ??
    pending;

  const pool = useMemo(
    () => (prize ? eligibleFor(state, prize.id) : []),
    [state, prize],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A fresh seed whenever the prize in hand changes, and again after a name is
  // sent back, so nothing is ever drawn against a seed the room has not seen.
  // Deferred a frame for the same reason the log is: a seed rolled during
  // render would differ between the server's paint and the client's.
  const commitKey = prize ? `${prize.id}:${prize.skipped.length}` : "none";
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSeed(freshSeed());
      setReel(null);
      setAt(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [commitKey]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /**
   * The reel, driven straight from the tap that started it rather than from an
   * effect watching the result. Nothing here decides anything: the winner is
   * already picked and already in the log by the time a single name has
   * flicked past, and this only spends a few seconds showing the room a bucket
   * being turned over.
   */
  const runReel = useCallback((names: readonly string[]) => {
    if (timer.current) clearTimeout(timer.current);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setAt(names.length - 1);
      return;
    }

    let index = 0;
    const step = () => {
      setAt(index);
      index += 1;
      if (index >= names.length) return;
      // Slows as it lands, the way a drum does.
      const progress = index / names.length;
      timer.current = setTimeout(step, 40 + 340 * progress * progress);
    };
    step();
  }, []);

  const landed = reel !== null && at >= reel.names.length - 1;
  const winner = entrantById(state, prize?.winnerId ?? null);

  const draw = () => {
    if (!prize || seed === null) return;

    const picked = pickWinner(pool, seed);
    if (!picked) return;

    // Recorded first, shown second. If the tab dies mid-spin the draw still
    // happened, which is the truth and is recoverable.
    append({
      type: "DRAWN",
      prizeId: prize.id,
      entrantId: picked.id,
      seed,
    });
    const names = reelNames(pool, picked, seed);
    setReel({ names, winnerId: picked.id, prizeId: prize.id });
    setAt(0);
    runReel(names);
  };

  const sendBack = (reason: RedrawReason) => {
    if (!prize || !prize.winnerId) return;
    append({
      type: "REDRAWN",
      prizeId: prize.id,
      entrantId: prize.winnerId,
      reason,
    });
    // Cleared here as well as by the commit effect, so the name comes off the
    // screen on the tap rather than a frame later.
    setReel(null);
    setAt(0);
  };

  if (state.prizes.length === 0 || state.entrants.length === 0) {
    return (
      <p className="rounded border border-[var(--bx-line-soft)] p-6 text-[var(--bx-ink)]">
        Add {state.prizes.length === 0 ? "a prize" : "some names"} on the set-up
        screen and the draw opens up.
      </p>
    );
  }

  if (!prize) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg text-[var(--bx-ink)]">Every prize has gone.</p>
        <Results state={state} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-[var(--bx-line-soft)] p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--bx-muted)]">
          Drawing for
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[var(--bx-ink)]">{prize.name}</h2>

        <p className="mt-4 text-sm text-[var(--bx-muted)]">
          <strong className="tabular-nums">{ticketsIn(pool)}</strong> tickets
          from <strong className="tabular-nums">{pool.length}</strong>{" "}
          {pool.length === 1 ? "person" : "people"}
          {state.onePrizePerPerson ? ", one prize per person" : ", winners stay in"}
        </p>
        <p className="mt-1 font-mono text-xs text-[var(--bx-muted)]">
          Seed {seed ?? "…"} &middot; committed before the draw
        </p>

        <div
          aria-live="polite"
          className="mt-6 flex min-h-32 items-center justify-center"
        >
          {reel ? (
            <p
              className={
                landed
                  ? "text-[clamp(2.25rem,11vw,5.5rem)] leading-none font-bold tracking-tight text-[var(--brand-orange)]"
                  : "text-[clamp(1.75rem,8vw,4rem)] leading-none font-bold tracking-tight text-[var(--bx-muted)]"
              }
            >
              {reel.names[Math.min(at, reel.names.length - 1)]}
            </p>
          ) : (
            <p className="text-sm text-[var(--bx-muted)]">
              {pool.length === 0
                ? "Nobody is left in the bucket for this prize."
                : "Ready when you are."}
            </p>
          )}
        </div>

        {landed && winner ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className={PRIMARY}
              onClick={() => {
                setReel(null);
                setAt(0);
              }}
            >
              They took it
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => sendBack("not-present")}
            >
              Not here, draw again
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`${PRIMARY} mt-4 px-8 py-3 text-lg`}
            onClick={draw}
            disabled={reel !== null || pool.length === 0 || seed === null}
          >
            Draw
          </button>
        )}

        {prize.skipped.length > 0 ? (
          <p className="mt-4 text-xs text-[var(--bx-muted)]">
            Sent back:{" "}
            {prize.skipped
              .map((id) => entrantById(state, id)?.name ?? "a removed name")
              .join(", ")}
          </p>
        ) : null}
      </section>

      <Results state={state} />
    </div>
  );
}

function Results({ state }: { state: ReturnType<typeof reduceRaffle> }) {
  const drawn = state.prizes.filter((prize) => prize.winnerId !== null);
  if (drawn.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--bx-muted)]">
        Gone so far
      </h3>
      <ol className="flex flex-col border-t border-[var(--bx-line-soft)]">
        {drawn.map((prize) => (
          <li
            key={prize.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--bx-line-soft)] py-2"
          >
            <span className="text-sm text-[var(--bx-muted)]">{prize.name}</span>
            <span className="flex items-baseline gap-3">
              <span className="text-sm font-semibold text-[var(--bx-ink)]">
                {entrantById(state, prize.winnerId)?.name ?? "a removed name"}
              </span>
              <span className="font-mono text-[0.65rem] text-[var(--bx-muted)]">
                seed {prize.seed}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
