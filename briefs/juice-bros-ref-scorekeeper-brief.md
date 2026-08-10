# Juice Bros Ref — Build Map

A referee-facing pickleball scorekeeping PWA. Client-side only, no database, no auth.

**Architecture principle:** the match is an append-only list of events. All visible state is derived by folding those events through a pure reducer. Undo is `events.pop()`. Nothing mutates score directly.

**Corollary that drives the timer and persistence design:** the event log is the single source of truth *and* the single thing persisted. Anything that must survive a refresh — including a running timeout clock — gets encoded as an event, not as separate state.

---

## 1. File structure

```
app/
  ref/
    page.tsx                  # single route, client component
lib/
  scoring/
    types.ts                  # MatchConfig, MatchEvent, MatchState
    formats.ts                # preset configs (11/15/21, rally variants)
    reduce.ts                 # THE pure fold — no React imports
    reduce.test.ts            # full simulated games
    selectors.ts              # scoreCall(), canTimeout(), isGameOver()
  persistence/
    matchStorage.ts           # localStorage read/write + schema versioning
hooks/
  useMatch.ts                 # useReducer + derived state + autosave
  useTimeoutClock.ts          # ticking clock derived from event timestamps
  useWakeLock.ts              # keep screen alive
components/
  ref/
    ScoreCall.tsx             # the big "8-5-2" display
    CourtDiagram.tsx          # who serves from where
    RallyButtons.tsx          # the two primary taps
    ActionBar.tsx             # timeout / fault / undo
    TimeoutOverlay.tsx        # announcement + countdown
    TimeoutLog.tsx            # audit list of every timeout called
    CoinFlip.tsx              # pre-match screen
    MatchSetup.tsx            # format + names
    GameOverSheet.tsx         # confirm, then start next game
    ResumePrompt.tsx          # "match in progress — resume or discard"
```

Nothing in `lib/scoring/` imports React. That's the rule that keeps it testable.

---

## 2. Types

```ts
// types.ts
export type TeamId = 'A' | 'B';
export type ServerNumber = 1 | 2;

export interface MatchConfig {
  scoring: 'sideout' | 'rally';
  doubles: boolean;
  pointsToWin: number;          // 11 | 15 | 21
  winBy: number;                // 2 (sometimes 1 in rally formats)
  bestOf: number;               // 1 | 3 | 5
  switchAtScore: number | null; // 6 for games to 11
  timeoutsPerGame: number;      // 2
  timeoutSeconds: number;       // 60
  players: Record<TeamId, [string, string?]>;
}

/** Every event carries `at` (epoch ms). It's what makes the timeout clock refresh-proof. */
export type MatchEvent =
  | { type: 'PREMATCH'; at: number; winner: TeamId; choice: 'serve' | 'receive' | 'side' }
  | { type: 'RALLY_WON'; at: number; team: TeamId }
  | { type: 'TIMEOUT_STARTED'; at: number; team: TeamId; kind: TimeoutKind }
  | { type: 'TIMEOUT_PAUSED'; at: number }
  | { type: 'TIMEOUT_RESUMED'; at: number }
  | { type: 'TIMEOUT_ENDED'; at: number; reason: 'expired' | 'ended_early' }
  | { type: 'TECHNICAL_WARNING'; at: number; team: TeamId }
  | { type: 'TECHNICAL_FOUL'; at: number; team: TeamId }  // awards a point, service unchanged
  | { type: 'GAME_CONFIRMED'; at: number };

/** Only 'standard' counts against the per-game allowance. */
export type TimeoutKind = 'standard' | 'medical' | 'equipment';

/**
 * A pausable clock can't be a single `endsAt` timestamp — pausing moves the
 * finish line. Model it as budget + consumed instead: `accumulatedMs` is time
 * spent across CLOSED running segments, `runningSince` opens the current one.
 * `runningSince === null` means paused.
 *
 * remaining = durationMs - accumulatedMs - (runningSince ? now - runningSince : 0)
 *
 * Both fields come from summing event timestamps, so the reducer still never
 * reads the wall clock, and a refresh mid-timeout — running or paused —
 * restores to the exact right number.
 */
export interface ActiveTimeout {
  team: TeamId;
  kind: TimeoutKind;
  startedAt: number;
  durationMs: number;
  accumulatedMs: number;
  runningSince: number | null;
}

/**
 * The audit record. Every field except `startedAt`/`endedAt` is DERIVED during
 * the fold — the score at the moment of the call is whatever the reducer had
 * accumulated when it hit that event. Never store the score on the event itself;
 * that would let the log contradict the replay after an undo.
 */
export interface TimeoutRecord {
  team: TeamId;
  kind: TimeoutKind;
  gameNumber: number;                    // 1-indexed
  ordinal: number;                       // this team's Nth standard timeout this game
  scoreAtCall: Record<TeamId, number>;
  servingAtCall: TeamId;
  serverNumberAtCall: ServerNumber;
  startedAt: number;
  endedAt: number | null;                // null while still open
  endReason: 'expired' | 'ended_early' | null;
  pausedMs: number;                      // total wall time spent paused
  pauseCount: number;
}

export interface GameState {
  scores: Record<TeamId, number>;
  serving: TeamId;
  serverNumber: ServerNumber;
  /** index 0 = player currently on the even/right court */
  positions: Record<TeamId, [string, string?]>;
  timeoutsUsed: Record<TeamId, number>;
  sidesSwitched: boolean;
  complete: boolean;
  winner: TeamId | null;
}

export interface MatchState {
  config: MatchConfig;
  games: GameState[];          // finished games + current
  current: GameState;
  gamesWon: Record<TeamId, number>;
  matchComplete: boolean;
  warnings: Record<TeamId, number>;
  activeTimeout: ActiveTimeout | null;  // null once TIMEOUT_ENDED is logged
  timeoutHistory: TimeoutRecord[];      // whole match, chronological
}
```

---

## 3. The reducer

This is the only place bugs are unforgivable. Write it first, test it before any UI exists.

```ts
export function reduceMatch(config: MatchConfig, events: MatchEvent[]): MatchState
```

It builds a fresh initial state and folds. Signature takes the whole array — not one event at a time — because that's what makes replay trivial.

### Purity rule for the timeout

`reduceMatch` must **never call `Date.now()`**. It reads `at` off the events and computes `activeTimeout` as a pair of absolute timestamps. Whether that timeout has *elapsed* is a question for the render layer, which has a ticking clock. Keeping the reducer time-independent is what makes the tests deterministic — the moment the reducer reads the wall clock, `reduce(cfg, events)` stops being reproducible and the whole undo-parity guarantee goes with it.

So: `activeTimeout` is non-null from `TIMEOUT_STARTED` until a matching `TIMEOUT_ENDED` appears in the log. Expiry is not implicit — see section 5.

### Sideout doubles rules to encode

- Game opens at **0-0-2**: `serverNumber` initialises to `2`, so the first service turn ends on the first lost rally.
- **Serving team wins the rally:** score increments, and that team's two players swap `positions`. Server number unchanged.
- **Receiving team wins the rally:**
  - `serverNumber === 1` → becomes `2`, same team keeps serving
  - `serverNumber === 2` → sideout: `serving` flips, `serverNumber` resets to `1`
  - No score change either way.
- **Correct serving court** is derived, never stored: server stands on the even/right court when their own team's score is even, odd/left when odd. Combined with `positions`, this tells you which named player should be serving from which side — the thing that catches positional faults.
- **Singles:** no server number. The server stands even/right when their score is even. `positions` is unused.
- **Rally scoring:** every rally increments the winner's score; service changes on every sideout regardless.

### Guards

- `RALLY_WON` is ignored while `activeTimeout !== null`. Play is stopped; the log shouldn't say otherwise.
- `TIMEOUT_STARTED` with `kind: 'standard'` is ignored if that team is already at `timeoutsPerGame`, or if any timeout is active. Medical and equipment timeouts bypass the allowance check but still require no timeout to be running.
- Each `TIMEOUT_STARTED` appends a `TimeoutRecord`, capturing the score, serving team, and server number *as the fold currently has them*. `TIMEOUT_ENDED` fills in `endedAt` and `endReason` on the last open record.
- `TIMEOUT_PAUSED` closes the running segment: `accumulatedMs += at - runningSince`, then `runningSince = null`. Ignored if already paused or no timeout is active.
- `TIMEOUT_RESUMED` sets `runningSince = at` and adds the paused span to the record's `pausedMs`. Ignored if not paused.
- `TIMEOUT_ENDED` while paused is valid — a ref can end a paused timeout outright.
- `RALLY_WON` is ignored once the current game is `complete` — wait for `GAME_CONFIRMED`.

### Game end

`score >= pointsToWin && (score - opponent) >= winBy` → set `complete` and `winner`, then stop accepting rally events until `GAME_CONFIRMED`. Don't auto-advance. A ref needs a beat to confirm before the next game starts.

### Side switch

When either score first reaches `switchAtScore` and `!sidesSwitched`, flag it. The UI raises a prompt; the flag prevents re-prompting.

### Technical foul

Awards a point to the non-offending team **without** changing service. That's a genuinely different code path from `RALLY_WON` — don't collapse them.

### Tests

`reduce.test.ts` should include at minimum:

- A full scripted game to 11, asserting the score call after every single event
- A deuce game reaching 15-13
- Sideout sequence: verify `positions` after a serving-team point, and that a sideout hands service to the player currently on the even court
- Undo parity: `reduce(cfg, events)` vs `reduce(cfg, events.slice(0, -1))` after appending and dropping — must be deep-equal
- Third standard timeout request in a game is ignored; a medical timeout at the same point is accepted and doesn't consume the allowance
- Standard timeout allowance resets at the start of each game
- `TimeoutRecord.scoreAtCall` matches the score at that point in the log — call one at 6-3, score four more rallies, assert the record still reads 6-3
- Undoing a `TIMEOUT_STARTED` removes its record and restores the team's remaining count
- Pause accounting: start at t=0, pause at t=20s, resume at t=50s, assert `accumulatedMs === 20_000`, `runningSince === 50_000`, `pausedMs === 30_000` — a 60s timeout should now have 40s left regardless of how long the pause ran
- Two pause/resume cycles accumulate correctly
- Pausing while already paused, and resuming while running, are both no-ops
- `RALLY_WON` during an active timeout is ignored
- Rally events after game completion are ignored
- **Determinism:** call `reduceMatch` twice on the same fixed event array with hardcoded `at` values, several seconds apart, and assert deep equality. This is the regression test that catches anyone sneaking `Date.now()` into the reducer.

---

## 4. Persistence — localStorage

Every event append writes the whole log. A finished match is roughly 150 events; `JSON.stringify` on that is well under a millisecond, so synchronous localStorage is genuinely the right tool here — no async ceremony, no transaction handling, and the write completes before the browser can unload the page. IndexedDB would only be worth it if we were storing match history in bulk, which we aren't.

```ts
// matchStorage.ts
const KEY = 'juicebros.ref.match';
const SCHEMA = 1;

interface Persisted {
  schema: number;
  config: MatchConfig;
  events: MatchEvent[];
  savedAt: number;
}

export function save(config: MatchConfig, events: MatchEvent[]): void
export function load(): Persisted | null   // returns null on bad JSON or schema mismatch
export function clear(): void
```

Requirements:

- **Every read and write goes through this module.** No component touches `window.localStorage` directly.
- **Guard for SSR.** Next.js renders this on the server where `localStorage` is undefined. Every function early-returns if `typeof window === 'undefined'`, and the resume check runs in a `useEffect`, never during render. Reading storage during render causes a hydration mismatch — the server renders an empty match, the client renders a restored one, React throws.
- **`load()` never throws.** Wrap in try/catch, return `null` on malformed JSON, unknown `schema`, or quota errors. A corrupt save should start a fresh match, not white-screen a ref mid-tournament.
- **Bump `SCHEMA`** whenever `MatchEvent` or `MatchConfig` changes shape. Old saves are discarded rather than migrated — this is a single-match scratchpad, not an archive.
- **`clear()` on match completion** after the ref dismisses the final screen, and on explicit discard.

### Resume flow

On mount, `useMatch` calls `load()` inside a `useEffect`. If a log exists and the match isn't complete, render `ResumePrompt` with the score it would restore to — "Resume A 8, B 5?" — plus a discard option. Show the actual score, not a generic "restore previous session"; a ref needs to confirm it's the right match before committing.

Also register a `beforeunload` handler while a match is live so an accidental refresh gets a browser confirm before it happens. Belt and braces: the confirm prevents most refreshes, the save catches the rest plus crashes and OS tab-eviction.

---

## 5. Timeout tracking

The primary job is the **record**: which team called it, at what score, which of their allowance it was, and when. The countdown is a convenience layered on top.

### What the ref needs on screen

- **Remaining allowance per team, always visible** — render as filled/empty pips in the `ActionBar` next to each team's timeout button, not as a number buried in a menu. A ref needs to answer "do they have one left?" without tapping anything, because a team will ask mid-game.
- **The announcement string**, generated on call and displayed large: `Timeout — Team A, first of two. Score 8-5-2.` Sanctioned play requires the ref to say the team, the timeout number, and the score. Build the string from `TimeoutRecord` so what's spoken and what's logged can't diverge.
- **Hard enforcement** — the standard timeout button disables at the allowance. A ref should not be able to grant a third by mistake, and should have to consciously reach for the medical/equipment option instead.
- **Kind selection** — long-press or a secondary control on the timeout button offers medical and equipment. These don't count against the allowance and are timed differently, so they can't just be a standard timeout with a mental asterisk.

### The timeout log

A `TimeoutLog` panel, reachable from the score screen and shown on the match summary, listing every `TimeoutRecord` in order:

```
G1  0:23  Team A  standard 1/2   at 6-3-1
G1  0:31  Team B  medical        at 8-6-2
G2  0:08  Team A  standard 1/2   at 2-4-1
```

This is what makes the app defensible in a dispute — a team claiming they still have a timeout can be shown exactly when they used it and at what score. It's also the reason `scoreAtCall` is derived during the fold rather than stored on the event: after an undo, a stored score could disagree with the replayed match, and a log that contradicts the score is worse than no log.

Include the timeout history in whatever match summary you export or display at the end. Tournament directors ask.

### The countdown

When a timeout starts, `TimeoutOverlay` takes over the screen with a live countdown of rest time remaining. It is pausable.

**Do not store a countdown integer and decrement it.** A ticking number in React state is lost on refresh and drifts when the tab is backgrounded — mobile browsers throttle intervals hard, so a 60-second timeout can finish 8 seconds late if the ref glances at a text message.

Instead, remaining time is *computed* on every tick from the accumulated-time fields on `ActiveTimeout`:

```ts
// useTimeoutClock.ts
export function useTimeoutClock(
  active: ActiveTimeout | null,
  onExpire: () => void
) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!active) return;

    const tick = () => {
      const spent =
        active.accumulatedMs +
        (active.runningSince === null ? 0 : Date.now() - active.runningSince);
      const left = Math.max(0, active.durationMs - spent);
      setRemainingMs(left);
      if (left <= 0) onExpire();
    };

    tick();                                    // paint immediately, don't wait 250ms
    if (active.runningSince === null) return;  // paused: frozen value, no interval

    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, onExpire]);

  return remainingMs;
}
```

Two properties fall out of this that are worth protecting in review:

- **Refresh-proof in both states.** Running: close the tab at 0:42, reopen four seconds later, it reads 0:38. Paused: it reads 0:42 no matter how long the app was gone, because `runningSince` is null and nothing accrues.
- **No interval while paused.** The effect returns early, so a paused timeout costs nothing and can't tick past zero in the background.

The `visibilitychange` listener forces a recompute the instant the ref returns to the app, so a throttled background interval can never leave a stale number on screen. `onExpire` dispatches `TIMEOUT_ENDED` with `reason: 'expired'` — expiry is explicit in the log, not implied by arithmetic, which is what keeps the reducer pure.

### Pausing

Refs pause for things that aren't rest: an injury during the timeout, an equipment problem, a wayward ball from the next court, waiting on a tournament director. The rest clock shouldn't burn while that's being sorted out.

- **Pause and resume are events**, so they're persisted, replayed, and undoable like everything else.
- **Name the controls for what they do.** There's a collision waiting here: "Resume" could mean resume the clock or resume play. Use **Pause clock** / **Start clock** for the timer, and **End timeout** for the action that sends players back. Keep those labels identical everywhere they appear.
- **Make paused unmistakable at a glance.** Freeze the digits, drop the countdown to a muted treatment, and show a `PAUSED` label at the same size as the timer. The failure mode is a ref looking up, seeing a number, and assuming rest time is running when it isn't — so the paused state has to read differently from across a court, not just up close.
- **Log it.** `pausedMs` and `pauseCount` land on the `TimeoutRecord`, so a two-minute timeout that was paused for 90 seconds is explicable afterwards rather than looking like a rules violation.
- Place the pause control away from **End timeout**. Ending a timeout when you meant to pause it puts players back on court early, and undo won't give back the seconds already announced.

Undo works on timeouts like everything else: popping `TIMEOUT_STARTED` removes the timeout and restores the team's count. Mis-taps happen.

---

## 6. The hook

```ts
export function useMatch(config: MatchConfig) {
  const [{ events, redo }, dispatch] = useReducer(eventLog, initialLog);
  const state = useMemo(() => reduceMatch(config, events), [config, events]);

  useEffect(() => {
    if (events.length) save(config, events);
  }, [config, events]);

  const remainingMs = useTimeoutClock(
    state.activeTimeout,
    useCallback(() => dispatch({ type: 'APPEND', event: { type: 'TIMEOUT_ENDED', at: Date.now(), reason: 'expired' } }), [])
  );
  // ...
}
```

`eventLog` is a tiny reducer over `{ events, redo }` handling only `APPEND`, `UNDO`, `REDO`, `LOAD`. `APPEND` clears the redo stack and stamps `at: Date.now()`. All domain logic lives in `reduceMatch`.

Note the division of labour: `Date.now()` appears exactly twice in the codebase — stamping new events, and ticking the display clock. Never inside `reduceMatch`.

---

## 7. Component notes

**ScoreCall** is the hero of the screen. It shows serving score, receiving score, server number — in that order, because that's the order it's spoken. Make it enormous. A ref glances at it between rallies in direct sunlight.

**RallyButtons** are the two primary targets: one per team, labelled with team/player names, not "Point A". Full-width, tall, well separated. Nothing destructive within a thumb's slip of them.

**ActionBar** holds undo, a timeout control per team, and fault. The timeout controls carry the allowance pips and disable at the limit; long-press opens medical/equipment. Undo lives here — reachable, but deliberately not adjacent to the rally buttons.

**CourtDiagram** renders the four positions with the current server highlighted on their correct side. This is the differentiating feature; a ref can see at a glance whether the players lined up wrong.

Visual direction: this is a utility surface, not a brand surface. Orange stays as the accent on the active-server indicator and the timeout warning state only — two uses, both meaning "look here now". Body is high-contrast dark-on-light for outdoor legibility. Resist decoration; the score call typography is the one memorable element.

---

## 8. PWA plumbing

- `manifest.json`, standalone display, portrait lock
- Service worker caching the app shell — court wifi is unreliable, assume offline
- Screen Wake Lock API in `useWakeLock`, re-acquired on `visibilitychange` (browsers drop it on tab blur). Especially important during a timeout, when nobody is tapping for a full minute and the phone would otherwise sleep.
- `touch-action: manipulation` to kill double-tap zoom
- `beforeunload` confirm while a match is live

---

## 9. Build order

1. `types.ts` + `formats.ts`
2. `reduce.ts` + `reduce.test.ts` — get to green before writing any JSX
3. `useMatch` with undo/redo, verified against a throwaway button UI
4. `matchStorage.ts` + autosave + `ResumePrompt` — wire this early, so every later step is tested against real reload behaviour rather than having persistence bolted on at the end
5. `ScoreCall` + `RallyButtons` — a usable app at this point
6. Timeout tracking: allowance pips, kinds, `TimeoutRecord` derivation, `TimeoutLog`
7. `useTimeoutClock` + `TimeoutOverlay` countdown, including pause/resume
8. `CourtDiagram`
9. Faults, warnings, side-switch prompt
10. `CoinFlip` + `MatchSetup`
11. Wake lock, PWA manifest, service worker
12. Test on a real phone, outdoors, one-handed — and specifically: start a timeout, pause it, force-quit the browser, reopen, confirm the clock is still paused at the same number

---

## Open item

Confirm current rule specifics — points, side-switch triggers, standard timeout counts and duration, medical timeout rules and duration, technical foul handling — against the live Pickleball Canada / USAP rulebook before shipping. They're revised annually, and everything above is deliberately config-driven so a rule change is a data edit, not a code change.
