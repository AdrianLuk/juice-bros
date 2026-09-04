# Pickle Point Pal — Build Notes

A referee-facing pickleball scorekeeping PWA. Client-side only, no database, no auth.
Live at `/tools/pickle-point-pal`, catalogued in `src/data/apps.ts`.

**Status: shipped, mostly done.** This is the as-built reference for the app, living
next to the code it describes. Adrian may still extend this — it isn't frozen — but the
core scoring/timeout/persistence system below is done.

**Architecture principle:** the match is an append-only list of events. All visible
state is derived by folding those events through a pure reducer. Undo pops the log;
redo replays from a parallel stack. Nothing mutates score directly.

**Corollary that drives the timer and persistence design:** the event log is the single
source of truth *and* the single thing persisted. Anything that must survive a refresh —
including a running timeout clock — is encoded as an event, not as separate state.

---

## 1. File structure (as built)

```
src/app/tools/pickle-point-pal/
  page.tsx                        # route, manifest link, PicklePointPal mount

src/components/apps/pickle-point-pal/
  pickle-point-pal.tsx             # top-level phase machine: loading/resume/setup/match
  match-setup.tsx                  # format + player name entry
  coin-flip.tsx                    # pre-match toss screen
  match-screen.tsx                 # owns the live match once PREMATCH exists
  score-call.tsx                   # the big serving-receiving-server# display
  rally-buttons.tsx                # the two primary per-team taps
  court-diagram.tsx                # who serves from where, mirrored to the ref's side
  action-bar.tsx                   # undo/redo, per-team timeout controls, technical menu
  timeout-overlay.tsx              # countdown + pause/resume + announcement
  match-log.tsx                    # UI panel over lib/scoring/match-log.ts entries
  game-over-sheet.tsx              # confirm the finished game, then advance
  match-summary.tsx                # end-of-match screen
  resume-prompt.tsx                # "resume A 8, B 5, or discard?"
  BRIEF.md                         # this file

  hooks/
    use-match.ts                   # useReducer event log + reduceMatch + autosave + clock wiring
    use-timeout-clock.ts           # ticking remaining-time, derived from event timestamps
    use-wake-lock.ts                # keep screen alive while a match is live
    use-ref-flipped.ts             # which side of the net the ref is standing on
    use-scroll-to-top-on-change.ts # scroll reset on phase/screen transitions

  lib/scoring/
    types.ts                       # MatchConfig, MatchEvent, MatchState, etc.
    formats.ts                     # format presets, defaults, rule-derivation helpers
    formats.test.ts
    reduce.ts                      # THE pure fold — no React imports
    reduce.test.ts
    selectors.ts                   # scoreCall(), canCallTimeout(), serverCourt(), etc.
    match-log.ts                   # derives human-readable audit rows from the event log

  lib/persistence/
    match-storage.ts                # localStorage read/write, schema versioning, refFlipped
    match-storage.test.ts

public/
  pickle-point-pal.webmanifest
  pickle-point-pal-sw.js
```

Nothing in `lib/scoring/` imports React — that's the rule that keeps it testable in
plain Node, and `reduce.test.ts` / `formats.test.ts` / `match-storage.test.ts` exist to
hold it to that.

---

## 2. Types

```ts
// lib/scoring/types.ts
export type TeamId = "A" | "B";
export type ServerNumber = 1 | 2;
export type TimeoutKind = "standard" | "medical" | "equipment";
/** [playerOnEvenCourt, playerOnOddCourt]. Singles only uses index 0. */
export type PlayerPair = [string, string?];

export interface MatchConfig {
  scoring: "sideout" | "rally";
  doubles: boolean;
  pointsToWin: number;          // 11 | 15 | 21
  winBy: number;                // 2 for side-out, 1 or 2 for rally
  bestOf: number;                // 1 | 3 | 5
  /** Rally only: a receiving team reaching game point is a side-out, not a win. */
  freezeRule: boolean;
  switchAtScore: number | null;  // 6 for games to 11, etc.
  /** USAP switches sides mid-game in the deciding game only. */
  switchAtScoreDecidingGameOnly: boolean;
  timeoutsPerGame: number;       // 2
  timeoutSeconds: number;        // 60
  medicalTimeoutSeconds: number; // bypasses the allowance, timed separately
  equipmentTimeoutSeconds: number;
  players: Record<TeamId, PlayerPair>;
}

/** Every event carries `at` (epoch ms) — what makes the timeout clock refresh-proof. */
export type MatchEvent =
  | { type: "PREMATCH"; at: number; winner: TeamId; server: TeamId }
  | { type: "RALLY_WON"; at: number; team: TeamId }
  | { type: "TIMEOUT_STARTED"; at: number; team: TeamId; kind: TimeoutKind }
  | { type: "TIMEOUT_PAUSED"; at: number }
  | { type: "TIMEOUT_RESUMED"; at: number }
  | { type: "TIMEOUT_ENDED"; at: number; reason: "expired" | "ended_early" }
  | { type: "TECHNICAL_WARNING"; at: number; team: TeamId }
  | { type: "TECHNICAL_FOUL"; at: number; team: TeamId } // point to the OPPONENT of `team`
  | { type: "GAME_CONFIRMED"; at: number }
  | { type: "MATCH_ENDED"; at: number }; // ref stops the match early: forfeit/injury/weather

export interface GameState {
  scores: Record<TeamId, number>;
  serving: TeamId;
  serverNumber: ServerNumber;
  /** Doubles side-out only: which slot of positions[serving] is serving. Not derivable from score parity. */
  servingSlot: 0 | 1;
  positions: Record<TeamId, PlayerPair>; // index 0 = player on even/right court
  timeoutsUsed: Record<TeamId, number>;
  sidesSwitched: boolean;
  complete: boolean;
  winner: TeamId | null;
  firstServer: TeamId; // alternates each game
}

export interface MatchState {
  config: MatchConfig;
  games: GameState[];       // finished games + current
  current: GameState;
  gamesWon: Record<TeamId, number>;
  matchComplete: boolean;
  warnings: Record<TeamId, number>;
  activeTimeout: ActiveTimeout | null; // null once TIMEOUT_ENDED is logged
  timeoutHistory: TimeoutRecord[];     // whole match, chronological
}
```

`ActiveTimeout` models the pausable clock as budget + consumed
(`accumulatedMs` + `runningSince`) rather than a single `endsAt`, because pausing moves
the finish line — see [§5](#5-timeout-tracking-and-the-clock). `TimeoutRecord` is the
audit entry: everything on it except the timestamps is derived during the fold, never
stored on the event itself, so an undo can never leave the log disagreeing with the
replayed match.

---

## 3. The reducer

```ts
export function reduceMatch(config: MatchConfig, events: MatchEvent[]): MatchState
```

Takes the whole event array, not one event at a time — that's what makes replay (and
undo) trivial. **Never calls `Date.now()`.** It reads `at` off events and expresses the
active timeout as absolute timestamps; whether it has *elapsed* is a question for the
render layer. The moment this function reads the wall clock, `reduceMatch(cfg, events)`
stops being reproducible and undo-parity goes with it.

Rules as implemented:

- **PREMATCH** — only applies once, and only from 0-0. `server` (not `winner`) sets who
  actually serves first; the coin-toss UI resolves "serve / receive / side" choices down
  to that one field before dispatching, since a "side" pick hands the serve decision to
  the *other* team.
- **RALLY_WON** — ignored during an active timeout, or once the current/match is
  complete.
  - *Side-out:* serving team scores and (doubles) swaps positions + flips `servingSlot`
    to stay matched to the new score parity. Receiving team: `serverNumber 1 → 2` (same
    server continues, `servingSlot` flips because the second server steps in from
    wherever they're already standing — nobody moves) or `serverNumber 2` → side-out
    (`serving` flips, `serverNumber` resets to 1, `servingSlot` resets to 0 — a team
    gaining serve always opens on the right/even court).
  - *Rally:* every rally scores; service passes on a receiving-team win. If
    `freezeRule` is on and the receiving team's rally win would otherwise end the game,
    it's just a side-out instead — no point, service passes. That's the "win on serve
    only" variant; USAP 2026 sanctioned rally is win-by-2 with **no** freeze, so a ref
    running a sanctioned rally event has to flip that toggle off (see `formats.ts`
    below).
- **TECHNICAL_FOUL** — a point to the *non-offending* team, service unchanged. Deliberately
  a different code path from `RALLY_WON` (no position swap), and can still end the game —
  including, per the freeze rule, ending it on a foul awarded to a team that's currently
  receiving (fouls aren't rallies, so freeze doesn't apply to them).
- **TECHNICAL_WARNING** — increments a per-team counter, no score effect.
- **TIMEOUT_STARTED** — ignored if a timeout is already active, the game/match is
  complete, or (`standard` only) the team is already at `timeoutsPerGame`. Medical and
  equipment bypass the allowance and are timed off their own config fields. Pushes a
  `TimeoutRecord` capturing score/serving/server-number *as the fold currently has them*.
- **TIMEOUT_PAUSED / TIMEOUT_RESUMED** — move time between `accumulatedMs` and
  `runningSince` on the active timeout. No-ops if already in that state or nothing's
  active.
- **TIMEOUT_ENDED** — closes the active timeout and fills `endedAt`/`endReason` on the
  open record.
- **GAME_CONFIRMED** — only valid once the current game is complete. Advances
  `gamesWon`, clears `activeTimeout`, and either sets `matchComplete` or opens the next
  game with `otherTeam(current.firstServer)` serving first (first-server alternates).
- **MATCH_ENDED** — sets `matchComplete` directly, for a ref stopping play before a
  normal finish. Undoable like everything else.
- **Side switch** — fires once, when either score first reaches
  `config.switchAtScore`, *unless* `switchAtScoreDecidingGameOnly` is set and this isn't
  the last possible game of the match (USAP: switch mid-game only in the decider).

---

## 4. Persistence — localStorage

`lib/persistence/match-storage.ts`. Every event append writes the whole log — a finished
match is ~150 events, so synchronous `JSON.stringify`/`setItem` is well under a
millisecond and completes before the browser can unload the page.

- Key `juicebros.picklepointpal.match`, `SCHEMA = 1`. Bump the schema whenever
  `MatchEvent`/`MatchConfig` changes shape — old saves are discarded, not migrated. This
  is a single-match scratchpad, not an archive.
- `save()` / `load()` / `clear()` are the only way anything touches
  `window.localStorage`. Every function early-returns on `typeof window === "undefined"`
  (SSR) and swallows quota/parse errors — `load()` never throws; a corrupt save starts a
  fresh match instead of white-screening a ref mid-tournament.
- Resume flow: `PicklePointPal` calls `load()` in a `useEffect` on mount (never during
  render — that would hydrate a different tree than the server sent). If a log with
  events exists, it renders `ResumePrompt` with the actual score it would restore to,
  plus a discard option.
- A `beforeunload` confirm is registered in `useMatch` while a match is live
  (`events.length > 0 && !matchComplete`) as a first line of defense; the autosave
  catches refreshes, crashes, and OS tab-eviction that slip past it.
- **`refFlipped` is a separate key** (`juicebros.picklepointpal.refflipped`),
  intentionally outside the match record and outside `clear()`. It answers "which side
  of the net is the ref standing on," which describes a person, not something that
  happened in the game — undo must never reach it, and it should still be right for the
  *next* match on the same court.

---

## 5. Timeout tracking and the clock

`TimeoutRecord` (on `MatchState.timeoutHistory`) is the audit trail: team, kind, game
number, ordinal (this team's Nth of that kind this game), score/serving/server-number at
call, start/end timestamps and end reason. `selectors.ts` builds the spoken announcement
straight from the record (`timeoutAnnouncement`) so what's said and what's logged can't
diverge, and `canCallTimeout` / `timeoutsRemaining` drive the disabled state and pip
display on `ActionBar`'s per-team timeout controls (filled/empty pips, always visible,
long-press-equivalent "..." button for medical/equipment).

**The clock does not store a decrementing integer.** `useTimeoutClock` derives remaining
time on every tick from `ActiveTimeout.accumulatedMs` / `runningSince`:

```ts
const spent = active.accumulatedMs +
  (active.runningSince === null ? 0 : Date.now() - active.runningSince);
const left = Math.max(0, active.durationMs - spent);
```

Ticks every 250ms plus immediately on `visibilitychange` (so a backgrounded/throttled
tab never leaves a stale number on screen), and skips the interval entirely while
paused. The returned reading is tagged with `active.startedAt` so a stale reading from
the *previous* timeout can never get painted against the next one.

`useMatch` wires `onExpire` to dispatch `TIMEOUT_ENDED { reason: "expired" }`, guarded by
an `expiredFor` ref keyed on `activeTimeout.startedAt` — the clock can fire `onExpire`
more than once between dispatch and re-render, and while the reducer would ignore a
duplicate event, it would still cost an undo and pollute the log.

Pause/resume are logged events, so they're persisted, replayed, and undoable.
`TimeoutRecord` does **not** carry `pausedMs`/`pauseCount` — pause/resume still fully
drive the live clock (via `accumulatedMs`), they're just not rolled up onto the audit
record itself.

---

## 6. `useMatch`

```ts
export function useMatch(config: MatchConfig, initialEvents: MatchEvent[] = []): UseMatchResult
```

A tiny `eventLog` reducer over `{ events, redo }` (`APPEND` / `UNDO` / `REDO` / `LOAD`)
holds the log; all domain logic lives in `reduceMatch`, called via `useMemo`. `append()`
stamps `at: Date.now()` **before** dispatch, not inside the reducer — React invokes
reducers twice under StrictMode, and a self-timestamping reducer would produce two
different events.

Note: `LOAD` exists on the log reducer but isn't currently used at runtime — resuming a
saved match goes through `PicklePointPal` remounting `MatchScreen` with a fresh
`session` key and `initialEvents` from storage, not a dispatched action.

`Date.now()` appears in exactly two places in the whole feature: stamping new events in
`append()`, and ticking the display clock in `useTimeoutClock`. Never inside
`reduceMatch`.

---

## 7. Components

- **ScoreCall** — the hero. Serving score, receiving score, server number, in the order
  it's spoken (`selectors.scoreCallParts`). Large, for a glance in direct sunlight.
- **RallyButtons** — the two primary targets, one per team, positioned left/right to
  match `leftTeam` (see below), disabled during an active timeout or after game point.
- **CourtDiagram** — four positions, current server highlighted on the correct side.
  Mirrors to whichever side of the net the ref is actually standing on (`leftTeam` +
  `mirrored`), so the on-screen layout always matches what the ref sees looking down at
  the court — this is the differentiating feature.
- **ActionBar** — undo/redo, a timeout control per team (pips + kind-select sheet for
  medical/equipment), and a technical-call sheet (warning/foul per team). Deliberately
  not adjacent to the rally buttons.
- **TimeoutOverlay** — takes over the screen during an active timeout: countdown,
  pause/resume ("Pause clock" / "Start clock", kept distinct from "End timeout" so the
  controls can't be confused), undo.
- **MatchLog** (UI) — renders `lib/scoring/match-log.ts`'s derived rows: one row per
  thing that actually *happened* (a timeout collapses start/pause/resume/end into one
  row with its outcome; events the reducer ignored produce no row at all), each tagged
  with the score call at that point. This is what makes the app defensible in a dispute.
- **GameOverSheet** — confirm the finished game (or undo) before the next one opens; a
  ref needs a beat, so this never auto-advances.
- **MatchSummary** — end-of-match screen; includes timeout history.
- **CoinFlip** / **MatchSetup** / **ResumePrompt** — pre-match toss, format/name entry,
  and the "resume A 8, B 5, or discard?" prompt.

**`leftTeam`** (`selectors.leftTeam`) is worth calling out: which team the ref has on
their left combines two independent things — the teams changing ends over the course of
the match (derivable from the log via `endChanges`) and the ref physically walking to
the other side of the net (not derivable from anything in the log; that's
`useRefFlipped`, toggled by the "Swap Sides" button). Team A starts on the left purely
because it's entered first at setup.

Visual direction: the redesign shipped "The Officiating Instrument" (direction seed
7107de82) — an anodized-graphite chassis (`.pp-frame`) cradling a bright reflective
readout panel (`.pp-panel`), the score as a big plain heavy tabular numeral, one hi-vis
orange signal (`#f26522`) meaning serving/live/clock-running only, and Saira Condensed
silkscreen legends on every control. The full recorded design system — tokens, named
rules, component specs — lives in `DESIGN.md` next to this file (sidecar
`.impeccable/design.json`); read it before touching any `.pp-*` surface. Every
full-viewport screen shares one `.pp-surface` class (`globals.css`, the scoped `.pp-*`
block) rather than repeating `bg-white`/`text-neutral-950` per file — the surface is
deliberately locked to light regardless of system/site theme; see PRODUCT.md's "Brand
Commitments" for why. Brand-orange itself is used as white-on-orange/orange-on-white
text below WCAG AA contrast on purpose (same doc) — that's a fixed brand decision, not
an open a11y item.

---

## 8. PWA plumbing

- `public/pickle-point-pal.webmanifest` — standalone display, portrait orientation,
  scoped to `/tools/pickle-point-pal`.
- `public/pickle-point-pal-sw.js` — service worker registered only from
  `PicklePointPal` itself (scope `/tools/pickle-point-pal`), so the rest of the site is
  untouched; registration failure is swallowed since offline caching is a nicety, not a
  requirement.
- `useWakeLock`, re-acquired on `visibilitychange` (browsers drop it on tab blur) —
  active whenever `!state.matchComplete`, which matters most during a timeout when
  nobody's tapping for a full minute.
- `maximumScale: 5` in `viewport` kills double-tap zoom on the rally buttons without
  trapping pinch-zoom.
- A `ref-landscape:` Tailwind variant drives a "standing at the net" layout — rally
  buttons pinned to the far left/right edges, court diagram and score call centred —
  used across `match-screen.tsx`, `action-bar.tsx`, and `court-diagram.tsx` for the case
  of a phone/tablet held sideways courtside, distinct from the manifest's portrait-locked
  installed-app orientation.
- **Known gap:** the manifest's only icon is `JB_Logo.svg` (square, but a
  detailed illustration with no maskable safe-zone padding). There's no 192×192
  or 512×512 PNG, which some install flows (notably Chrome/Android) still
  expect regardless of declared size — producing those needs an actual image
  rasterizer (e.g. `sharp`, `pwa-asset-generator`, or an export from Daven),
  which wasn't available when this was last touched.

---

## Rule verification

`formats.ts` documents where the shipped defaults (rally win-by-1 + freeze on) sit
relative to sanctioned USAP 2026 rules — a ref running a *sanctioned* rally event needs
to flip win-by to 2 and freeze off by hand. Rules are revised annually, so it's worth a
re-check against the live rulebook before any sanctioned event.
