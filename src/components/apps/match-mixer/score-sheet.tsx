"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  describeGameRule,
  scoreProblem,
  type GameRule,
  type GameScore,
} from "@/components/apps/match-mixer/lib/live/game-rule";
import type { Outcome } from "@/lib/match-mixer/live-mixers";

/** The Game the sheet is open on, as the board names it. */
export interface SheetGame {
  /** "Round 2 · Court 1" */
  readonly title: string;
  /** Each Side's names, "Ben Johns / Anna Leigh Waters", in Side order. */
  readonly sides: readonly [string, string];
  readonly score: GameScore | null;
}

// The write may still have landed, so this says to look rather than "it didn't save" (Mic Drop's #671).
const UNREACHABLE = "Couldn't reach Match Mixer. Check your signal, then reload to see if the score saved.";

/**
 * Entering a score (#688, RR-2's decided answer): tap a Game, a numeric
 * keypad, two scores, done. No text fields, so a phone never brings up its
 * keyboard over the board. Digits fill the highlighted Side; two digits move
 * on to the other one. A physical keyboard's digits, Backspace and Enter work
 * too.
 *
 * The rule is checked here before anything is sent, and again on the server.
 */
export function ScoreSheet({
  game,
  rule,
  onSave,
  onClear,
  onClose,
}: {
  game: SheetGame;
  rule: GameRule;
  onSave: (score: GameScore) => Promise<Outcome<null>>;
  onClear: () => Promise<Outcome<null>>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [digits, setDigits] = useState<[string, string]>(
    game.score ? [String(game.score[0]), String(game.score[1])] : ["", ""],
  );
  // A fresh sheet starts on the first Side; a scored one starts with both shown.
  const [active, setActive] = useState<0 | 1>(0);
  const [fresh, setFresh] = useState(game.score !== null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const press = (digit: string) => {
    setProblem(null);
    const next: [string, string] = [...digits];
    // The first digit typed into a Side just chosen replaces what's there.
    const was = fresh ? "" : next[active];
    next[active] = was.length >= 2 ? digit : `${was}${digit}`.replace(/^0(?=\d)/, "");
    setDigits(next);
    const moveOn = next[active].length === 2 && active === 0;
    if (moveOn) setActive(1);
    setFresh(moveOn);
  };

  const erase = () => {
    setProblem(null);
    setFresh(false);
    const next: [string, string] = [...digits];
    next[active] = next[active].slice(0, -1);
    setDigits(next);
  };

  const choose = (side: 0 | 1) => {
    setActive(side);
    setFresh(true);
  };

  const settle = async (write: () => Promise<Outcome<null>>) => {
    setPending(true);
    let outcome: Outcome<null>;
    try {
      outcome = await write();
    } catch {
      outcome = { ok: false, problem: UNREACHABLE };
    }
    setPending(false);
    if (outcome.ok) dialog.current?.close();
    else setProblem(outcome.problem);
  };

  const save = () => {
    if (pending) return;
    if (digits[0] === "" || digits[1] === "") {
      setProblem("Enter both scores.");
      return;
    }
    const score: GameScore = [Number(digits[0]), Number(digits[1])];
    const refused = scoreProblem(rule, score);
    if (refused) {
      setProblem(refused);
      return;
    }
    void settle(() => onSave(score));
  };

  const keys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      press(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      erase();
    } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="mm-keypad"
      aria-labelledby="mm-keypad-title"
      aria-describedby="mm-keypad-rule"
      onClose={onClose}
      onKeyDown={keys}
    >
      <div className="mm-keypad-head">
        <h2 id="mm-keypad-title" className="mm-keypad-title">
          {game.title}
        </h2>
        <p id="mm-keypad-rule" className="mm-note">
          {describeGameRule(rule)}
        </p>
      </div>

      <div className="mm-keypad-sides">
        {game.sides.map((names, side) => (
          <button
            key={side}
            type="button"
            className="mm-keypad-side"
            aria-pressed={active === side}
            onClick={() => choose(side as 0 | 1)}
          >
            <span className="mm-keypad-names">{names}</span>
            <span className="mm-keypad-score" aria-label={digits[side] === "" ? "no score yet" : undefined}>
              {digits[side]}
            </span>
          </button>
        ))}
      </div>

      <div className="mm-keypad-keys" role="group" aria-label="Keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button key={digit} type="button" className="mm-key" onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="mm-key" data-word="true" onClick={erase}>
          Delete
        </button>
        <button type="button" className="mm-key" onClick={() => press("0")}>
          0
        </button>
        <button type="button" className="mm-key" data-word="true" onClick={() => choose(active === 0 ? 1 : 0)}>
          Other side
        </button>
      </div>

      <p className="mm-note mt-3" role="status" data-tone={problem ? "refused" : undefined}>
        {problem}
      </p>

      <div className="mm-keypad-actions">
        <button type="button" className="mm-button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save score"}
        </button>
        <div className="mm-keypad-quiet">
          {game.score ? (
            <button
              type="button"
              className="mm-quiet"
              disabled={pending}
              onClick={() => void settle(onClear)}
            >
              Clear score
            </button>
          ) : null}
          <button type="button" className="mm-quiet" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
