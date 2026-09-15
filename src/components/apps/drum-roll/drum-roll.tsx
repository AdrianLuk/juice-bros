"use client";

import { Minus, Plus, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pickWinner } from "@/components/apps/drum-roll/lib/engine/draw";
import {
  eligibleFor,
  eligibleForQuick,
  entrantById,
  nextPrize,
  reduceRaffle,
  ticketsIn,
} from "@/components/apps/drum-roll/lib/engine/fold";
import { freshSeed } from "@/components/apps/drum-roll/lib/engine/random";
import {
  formatRoster,
  parseRoster,
} from "@/components/apps/drum-roll/lib/engine/roster";
import type {
  Entrant,
  RaffleEvent,
  RedrawReason,
} from "@/components/apps/drum-roll/lib/engine/types";
import {
  clear as clearLog,
  load as loadLog,
  save as saveLog,
} from "@/components/apps/drum-roll/lib/persistence/log-storage";
import { Wheel, type WheelHandle } from "@/components/apps/drum-roll/wheel";

type State = ReturnType<typeof reduceRaffle>;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Grouped so it can be read out loud without losing your place. */
const spellSeed = (seed: number) => seed.toLocaleString("en-US");

/**
 * Drum Roll: names in, one out, and a draw the room can check.
 *
 * Everything on screen is a fold over an append-only log (`reduceRaffle`), so
 * Undo is dropping the last event, and the log is written to storage after
 * every tap. The night has to survive a pocketed phone.
 *
 * The draw is deliberately not a surprise to the machine: the seed is generated
 * and shown *before* the key is pressed, the winner is `pickWinner(pool, seed)`,
 * and the wheel that follows is presentation of a decision already recorded.
 * That ordering is the whole reason a room can check a result instead of taking
 * it on trust, and it is why the wheel itself contains no randomness.
 *
 * Two shapes of draw share this screen. With no prizes added it is "pick one of
 * us", which needs no setup at all. Add a prize and the same bucket becomes a
 * raffle, drawn in the order the prizes were added.
 */
export function DrumRoll() {
  const [events, setEvents] = useState<readonly RaffleEvent[]>([]);
  const [restored, setRestored] = useState(false);
  const [passing, setPassing] = useState(false);

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

  return (
    <div className="dr-surface flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">Drum Roll</h1>
          <button
            type="button"
            className="dr-key dr-key--quiet"
            onClick={() => setEvents((previous) => previous.slice(0, -1))}
            disabled={events.length === 0}
          >
            <Undo2 size={16} aria-hidden="true" />
            Undo
          </button>
        </header>

        {passing ? (
          <SignIn state={state} append={append} onDone={() => setPassing(false)} />
        ) : (
          <Draw
            state={state}
            append={append}
            onClearAll={() => setEvents([])}
            onPassItRound={() => setPassing(true)}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- draw */

interface Spin {
  /** Frozen at the moment of the draw: recording the result changes who is
   *  eligible, and a wheel that re-slices itself mid-spin is a broken wheel. */
  readonly pool: readonly Entrant[];
  readonly winnerId: string;
  readonly seed: number;
}

function Draw({
  state,
  append,
  onClearAll,
  onPassItRound,
}: {
  state: State;
  append: (...events: RaffleEvent[]) => void;
  onClearAll: () => void;
  onPassItRound: () => void;
}) {
  const [seed, setSeed] = useState<number | null>(null);
  const [spin, setSpin] = useState<Spin | null>(null);
  const [landed, setLanded] = useState(false);
  const wheel = useRef<WheelHandle>(null);

  const raffle = state.prizes.length > 0;
  const prize = raffle ? nextPrize(state) : null;

  const live = useMemo(
    () => (prize ? eligibleFor(state, prize.id) : raffle ? [] : eligibleForQuick(state)),
    [state, prize, raffle],
  );

  // What the wheel shows: the live bucket normally, the frozen one while a
  // result is up.
  const shown = spin?.pool ?? live;

  /**
   * A fresh seed whenever the thing being drawn for changes, and never while a
   * result is on screen: the readout has to keep showing the seed that produced
   * the name the room is looking at. Deferred a frame for the same reason the
   * log is, a seed rolled during render would differ between the server's paint
   * and the client's.
   */
  const commitKey = prize
    ? `prize:${prize.id}:${prize.skipped.length}`
    : `quick:${state.quickDraws.length}`;

  useEffect(() => {
    if (spin) return;
    const frame = requestAnimationFrame(() => setSeed(freshSeed()));
    return () => cancelAnimationFrame(frame);
  }, [commitKey, spin]);

  const winner = spin ? entrantById(state, spin.winnerId) : null;

  const draw = () => {
    if (seed === null || live.length === 0) return;

    const picked = pickWinner(live, seed);
    if (!picked) return;

    // Recorded first, shown second. If the tab dies mid-spin the draw still
    // happened, which is the truth and is recoverable.
    append(
      prize
        ? { type: "DRAWN", prizeId: prize.id, entrantId: picked.id, seed }
        : { type: "QUICK_DRAWN", entrantId: picked.id, seed },
    );

    setSpin({ pool: live, winnerId: picked.id, seed });
    setLanded(false);
    wheel.current?.spinTo(picked.id, () => setLanded(true));
  };

  const clearSpin = () => {
    setSpin(null);
    setLanded(false);
    wheel.current?.reset();
  };

  const sendBack = (reason: RedrawReason) => {
    if (!prize?.winnerId) return;
    append({ type: "REDRAWN", prizeId: prize.id, entrantId: prize.winnerId, reason });
    clearSpin();
  };

  const rule = state.onePrizePerPerson
    ? raffle
      ? "one prize each"
      : "nobody twice"
    : raffle
      ? "winners stay in"
      : "everyone stays in";

  const allGone = raffle && !prize;

  return (
    <>
      {state.entrants.length === 0 ? (
        <Empty append={append} onPassItRound={onPassItRound} />
      ) : (
        <section className="dr-stage">
          {allGone ? (
            <p className="dr-drawing-for">Every prize has gone.</p>
          ) : prize ? (
            <p className="dr-drawing-for">
              <span className="dr-drawing-lede">Drawing for</span> {prize.name}
            </p>
          ) : null}

          <Wheel ref={wheel} pool={shown} landedId={landed ? (spin?.winnerId ?? null) : null} />

          <p aria-live="polite" className="min-h-[2.75rem] w-full">
            {landed && winner ? (
              <span className="dr-result block text-[var(--dr-accent)]">{winner.name}</span>
            ) : (
              <span className="dr-readout block">
                <b>{ticketsIn(shown)}</b> {ticketsIn(shown) === 1 ? "ticket" : "tickets"} from{" "}
                <b>{shown.length}</b> {shown.length === 1 ? "person" : "people"}, {rule}
              </span>
            )}
          </p>

          {!allGone ? (
            <p className="dr-readout">
              Seed{" "}
              <span className="dr-seed">
                {seed === null ? "…" : spellSeed(spin?.seed ?? seed)}
              </span>
              {landed ? " produced this name" : null}
            </p>
          ) : null}

          {landed && winner ? (
            <div className="flex flex-wrap justify-center gap-2">
              {prize ? (
                <>
                  <button type="button" className="dr-key" onClick={clearSpin}>
                    They took it
                  </button>
                  <button
                    type="button"
                    className="dr-key dr-key--quiet"
                    onClick={() => sendBack("not-present")}
                  >
                    Not here, spin again
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="dr-key"
                    onClick={clearSpin}
                    disabled={live.length === 0}
                  >
                    Spin again
                  </button>
                  <button
                    type="button"
                    className="dr-key dr-key--quiet"
                    onClick={() => {
                      append({ type: "QUICK_CLEARED" });
                      clearSpin();
                    }}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Clear results
                  </button>
                </>
              )}
            </div>
          ) : allGone ? null : (
            <button
              type="button"
              className="dr-key"
              onClick={draw}
              disabled={spin !== null || live.length === 0 || seed === null}
            >
              Spin
            </button>
          )}

          {!landed && live.length === 0 && !allGone ? (
            <p className="dr-note">
              {state.onePrizePerPerson
                ? "Everyone has already come out. Turn the house rule off below, or clear the results."
                : "Nobody in the bucket has a ticket."}
            </p>
          ) : null}

          {prize && prize.skipped.length > 0 ? (
            <p className="dr-readout">
              Sent back:{" "}
              {prize.skipped
                .map((id) => entrantById(state, id)?.name ?? "a removed name")
                .join(", ")}
            </p>
          ) : null}
        </section>
      )}

      <Results state={state} />

      {state.entrants.length > 0 ? (
        <Roster state={state} append={append} onPassItRound={onPassItRound} />
      ) : null}

      <Prizes state={state} append={append} />

      <HouseRule state={state} append={append} onClearAll={onClearAll} />
    </>
  );
}

/* ------------------------------------------------------------------- empty */

/**
 * The whole of getting started. A paste box, because the names already exist
 * in a group chat, and nothing else on screen competing with it.
 */
/**
 * Exactly the lines the placeholder below shows, so the wheel above the box is
 * a picture of what that paste becomes rather than an unrelated example.
 */
const GHOST: Entrant[] = [
  { id: "g1", name: "Anna Leigh Waters", tickets: 1 },
  { id: "g2", name: "Ben Johns", tickets: 1 },
  { id: "g3", name: "Catherine Parenteau", tickets: 3 },
];

function Empty({
  append,
  onPassItRound,
}: {
  append: (...events: RaffleEvent[]) => void;
  onPassItRound: () => void;
}) {
  const [bulk, setBulk] = useState("");

  const add = () => {
    const parsed = parseRoster(bulk);
    if (parsed.length === 0) return;
    append(
      ...parsed.map(
        ({ name, tickets }): RaffleEvent => ({
          type: "ENTRANT_ADDED",
          id: newId(),
          name,
          tickets,
        }),
      ),
    );
    setBulk("");
  };

  return (
    <section className="flex flex-col gap-3">
      {/* What the names become, shown rather than described. Inert and dimmed:
          it is an illustration of the tool, not a wheel anybody can spin. */}
      <div aria-hidden="true" className="pointer-events-none select-none">
        <Wheel pool={GHOST} landedId={null} ghost />
      </div>

      <h2 className="dr-h">Who is in?</h2>
      <p className="dr-note">
        One name per line. Paste straight from a group chat if you have it there.
        Add <code className="font-[family-name:var(--font-geist-mono)]">x3</code> after
        a name to give them three tickets, or leave it off for one.
      </p>
      <label className="sr-only" htmlFor="dr-bulk">
        Names, one per line
      </label>
      <textarea
        id="dr-bulk"
        className="dr-field h-40"
        value={bulk}
        onChange={(event) => setBulk(event.target.value)}
        placeholder={"Anna Leigh Waters\nBen Johns\nCatherine Parenteau x3"}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="dr-key" onClick={add} disabled={!bulk.trim()}>
          Put them on the wheel
        </button>
        <button type="button" className="dr-key dr-key--quiet" onClick={onPassItRound}>
          Pass it round instead
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ roster */

function Roster({
  state,
  append,
  onPassItRound,
}: {
  state: State;
  append: (...events: RaffleEvent[]) => void;
  onPassItRound: () => void;
}) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    if (copied !== "copied") return;
    const timer = setTimeout(() => setCopied("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const addOne = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    append({ type: "ENTRANT_ADDED", id: newId(), name: trimmed, tickets: 1 });
    setName("");
  };

  const addMany = () => {
    const parsed = parseRoster(bulk);
    if (parsed.length === 0) return;
    append(
      ...parsed.map(
        ({ name: parsedName, tickets }): RaffleEvent => ({
          type: "ENTRANT_ADDED",
          id: newId(),
          name: parsedName,
          tickets,
        }),
      ),
    );
    setBulk("");
    setOpen(false);
  };

  /**
   * Hand the roster to the next person. The clipboard is the fast path and the
   * textarea is what happens when it is refused, because "copy failed" with no
   * way to reach the names is useless to somebody mid-handover.
   */
  const copy = async () => {
    const text = formatRoster(state.entrants);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      setCopied("manual");
    }
  };

  return (
    <section className="dr-section flex flex-col gap-3">
      <div className="dr-section-head">
        <h2 className="dr-h">
          On the wheel{" "}
          <span className="font-normal text-[var(--dr-ink-dim)]">
            ({state.entrants.length}, {ticketsIn(state.entrants)} tickets)
          </span>
        </h2>
        <button type="button" className="dr-link" onClick={copy}>
          {copied === "copied" ? "Copied" : "Copy list"}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied === "copied" ? "Name list copied to the clipboard" : ""}
      </p>

      {copied === "manual" ? (
        <div className="flex flex-col gap-2">
          <label className="dr-label" htmlFor="dr-manual">
            This browser would not take the clipboard. Select all of this and copy it by hand.
          </label>
          <textarea
            id="dr-manual"
            readOnly
            className="dr-field h-28 font-[family-name:var(--font-geist-mono)] text-sm"
            value={formatRoster(state.entrants)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="dr-key dr-key--quiet self-start"
            onClick={() => setCopied("idle")}
          >
            Done
          </button>
        </div>
      ) : null}

      <ul className="m-0 flex list-none flex-col p-0">
        {state.entrants.map((entrant) => (
          <li key={entrant.id} className="dr-row">
            <span className="dr-row-name">{entrant.name}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className="dr-step"
                aria-label={`One fewer ticket for ${entrant.name}`}
                disabled={entrant.tickets === 0}
                onClick={() =>
                  append({ type: "TICKETS_SET", id: entrant.id, tickets: entrant.tickets - 1 })
                }
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <span className="dr-count">{entrant.tickets}</span>
              <button
                type="button"
                className="dr-step"
                aria-label={`One more ticket for ${entrant.name}`}
                onClick={() =>
                  append({ type: "TICKETS_SET", id: entrant.id, tickets: entrant.tickets + 1 })
                }
              >
                <Plus size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dr-link ml-2"
                onClick={() => append({ type: "ENTRANT_REMOVED", id: entrant.id })}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className="dr-label" htmlFor="dr-add">
            Add someone
          </label>
          <input
            id="dr-add"
            className="dr-field"
            placeholder="Tyson McGuffin"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOne();
              }
            }}
          />
        </div>
        <button type="button" className="dr-key dr-key--quiet" onClick={addOne}>
          Add
        </button>
        <button type="button" className="dr-key dr-key--quiet" onClick={() => setOpen((on) => !on)}>
          Paste a list
        </button>
        <button type="button" className="dr-key dr-key--quiet" onClick={onPassItRound}>
          Pass it round
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-2">
          <label className="dr-label" htmlFor="dr-bulk-more">
            One name per line, <code className="font-[family-name:var(--font-geist-mono)]">x3</code>{" "}
            after a name for three tickets
          </label>
          <textarea
            id="dr-bulk-more"
            className="dr-field h-32"
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
          />
          <button
            type="button"
            className="dr-key self-start"
            onClick={addMany}
            disabled={!bulk.trim()}
          >
            Add everyone
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ prizes */

/**
 * Prizes are an upgrade, not a precondition. The old build refused to open the
 * draw until one existed, which made "pick one of us" impossible.
 */
function Prizes({
  state,
  append,
}: {
  state: State;
  append: (...events: RaffleEvent[]) => void;
}) {
  const [name, setName] = useState("");

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    append({ type: "PRIZE_ADDED", id: newId(), name: trimmed });
    setName("");
  };

  return (
    <section className="dr-section flex flex-col gap-3">
      <h2 className="dr-h">Prizes</h2>
      <p className="dr-note">
        {state.prizes.length === 0
          ? "Add one and this becomes a raffle, drawn in the order you add them. Leave it empty and the wheel just picks a name."
          : "Drawn in the order you added them."}
      </p>

      {state.prizes.length > 0 ? (
        <ol className="m-0 flex list-none flex-col p-0">
          {state.prizes.map((prize) => {
            const winner = entrantById(state, prize.winnerId);
            return (
              <li key={prize.id} className="dr-row">
                <span className="dr-row-name">
                  {prize.name}
                  <span className={winner ? "dr-row-sub dr-row-sub--won" : "dr-row-sub"}>
                    {winner ? `Taken by ${winner.name}` : "Not drawn yet"}
                  </span>
                </span>
                <button
                  type="button"
                  className="dr-link"
                  onClick={() => append({ type: "PRIZE_REMOVED", id: prize.id })}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className="dr-label" htmlFor="dr-prize">
            Prize
          </label>
          <input
            id="dr-prize"
            className="dr-field"
            placeholder="The good paddle"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        </div>
        <button type="button" className="dr-key dr-key--quiet" onClick={add}>
          Add prize
        </button>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- results */

function Results({ state }: { state: State }) {
  const drawn = state.prizes.filter((prize) => prize.winnerId !== null);
  const quick = state.quickDraws;

  if (drawn.length === 0 && quick.length === 0) return null;

  return (
    <section className="dr-section flex flex-col gap-2">
      <h2 className="dr-h">Out so far</h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {quick.map((draw, index) => (
          <li key={`${draw.entrantId}-${index}`} className="dr-row">
            <span className="dr-row-name">
              {entrantById(state, draw.entrantId)?.name ?? "a removed name"}
              <span className="dr-row-sub">{index + 1} of {quick.length}</span>
            </span>
            <span className="dr-readout">
              seed <span className="dr-seed">{spellSeed(draw.seed)}</span>
            </span>
          </li>
        ))}
        {drawn.map((prize) => (
          <li key={prize.id} className="dr-row">
            <span className="dr-row-name">
              {entrantById(state, prize.winnerId)?.name ?? "a removed name"}
              <span className="dr-row-sub">{prize.name}</span>
            </span>
            <span className="dr-readout">
              seed{" "}
              <span className="dr-seed">
                {prize.seed === null ? "not recorded" : spellSeed(prize.seed)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------- house rule */

function HouseRule({
  state,
  append,
  onClearAll,
}: {
  state: State;
  append: (...events: RaffleEvent[]) => void;
  onClearAll: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const raffle = state.prizes.length > 0;

  return (
    <section className="dr-section flex flex-col gap-4">
      <h2 className="dr-h">House rule</h2>
      <label className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
        <input
          type="checkbox"
          id="dr-one-each"
          className="mt-1 size-4 accent-[var(--dr-accent)]"
          checked={state.onePrizePerPerson}
          onChange={(event) =>
            append({ type: "ONE_PRIZE_PER_PERSON_SET", value: event.target.checked })
          }
        />
        <span>
          {raffle
            ? "One prize each. Turn it off to match a physical bucket, where your other tickets stay in and you can win twice."
            : "Nobody comes out twice. Turn it off and every name stays on the wheel after it is drawn."}{" "}
          Whichever is set shows above the wheel.
        </span>
      </label>

      <div>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem]">Clear every name, prize and result?</span>
            <button
              type="button"
              className="dr-key"
              onClick={() => {
                clearLog();
                onClearAll();
                setConfirming(false);
              }}
            >
              Yes, start over
            </button>
            <button
              type="button"
              className="dr-key dr-key--quiet"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="dr-key dr-key--quiet"
            onClick={() => setConfirming(true)}
          >
            Start over
          </button>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- sign-in */

/**
 * The shared-device screen: one phone on the table and people put themselves
 * in. This is what stands in for the QR nobody could print, and it needs
 * nothing but the device it is already running on.
 */
function SignIn({
  state,
  append,
  onDone,
}: {
  state: State;
  append: (...events: RaffleEvent[]) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [tickets, setTickets] = useState(1);
  const [justAdded, setJustAdded] = useState<{ name: string; tickets: number } | null>(null);
  const field = useRef<HTMLInputElement>(null);

  /**
   * The trigger for this screen sits down in the roster, so arriving here
   * without scrolling back up hands the next person a view of the footer. Not
   * auto-focused: on a phone that opens the keyboard over half the screen
   * before they have even seen what they are being asked for.
   */
  useEffect(() => {
    // Deferred past paint on purpose: this screen is much shorter than the one
    // it replaces, so the browser re-clamps scroll position after layout and
    // would undo a scroll issued during the commit.
    const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(frame);
  }, []);

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
    <section className="flex flex-col gap-5">
      <div>
        <label className="dr-h mb-3 block" htmlFor="dr-signin">
          Your name
        </label>
        <input
          id="dr-signin"
          ref={field}
          className="dr-field text-xl"
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
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className="dr-label" htmlFor="dr-signin-tickets">
            Tickets
          </label>
          <input
            id="dr-signin-tickets"
            type="number"
            min={1}
            max={999}
            className="dr-field"
            value={tickets}
            onChange={(event) => setTickets(Number(event.target.value))}
          />
        </div>
        <button type="button" className="dr-key flex-1" onClick={add}>
          Put me in
        </button>
      </div>

      <p aria-live="polite" className="min-h-8 text-lg">
        {justAdded ? (
          <span>
            <strong>{justAdded.name}</strong>, you are in with {justAdded.tickets}{" "}
            {justAdded.tickets === 1 ? "ticket" : "tickets"}.
          </span>
        ) : null}
      </p>

      <p className="dr-readout">
        {state.entrants.length} on the wheel, {ticketsIn(state.entrants)} tickets between them.
      </p>

      <div className="dr-section pt-5">
        <button type="button" className="dr-key dr-key--quiet" onClick={onDone}>
          Everyone is in, back to the draw
        </button>
      </div>
    </section>
  );
}
