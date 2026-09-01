# On Deck — Implementation Progress

Live court rotation for club pickleball socials (Apps section). Spec: issue
[#238](https://github.com/AdrianLuk/juice-bros/issues/238). Domain model and
load-bearing decisions in [CONTEXT.md](CONTEXT.md) and [docs/adr/](docs/adr).

Built test-first at the seams Booking Buddy settled on (`booking-buddy/PROGRESS.md`):
pure functions under `node --test`, schema/RLS under pgTAP, journeys under
Playwright. The `reduceSession` fold is the centre of gravity — a config plus an
event array plus assertions about the resulting state.

**File layout**
- `src/app/on-deck/` — routes (landing is marketing; `home` is Organizer-gated; `c/[clubId]` and `session/[sessionId]` are open)
- `src/lib/on-deck/session/` — the pure fold (`reduce.ts`, `types.ts`), relative imports only
- `src/lib/on-deck/` — server helpers, `actions/` — Server Actions
- `src/components/on-deck/` — components
- `supabase/migrations/`, `supabase/tests/` — schema + RLS (`on_deck_` prefix)

## Done

- [x] **#241 — Club and Session foundation, one-tap start.** Schema for
  `on_deck_clubs` / `on_deck_sessions` / `on_deck_session_events` with the
  ADR 0003 hybrid RLS posture and the ADR 0006 open-Session-is-public twist.
  Organizer auth (magic link + password, own sign-in / callback / DAL,
  proxy extended to `/on-deck`). `reduceSession` folds `SESSION_STARTED` into
  a minimal `SessionState`. Organizer home shows the Club and a one-tap Start;
  the stable Club QR path resolves to the open Session or "nothing running".
  One open Session per Club enforced by a partial unique index. Tests:
  `reduce.test.ts`, `routes.test.ts`, `on_deck_club_session.test.sql`,
  `e2e/on-deck.spec.ts`.

- [x] **#242 — Player joins via Club QR.** `on_deck_join_session` RPC —
  `anon`-callable, SECURITY DEFINER, pins the event to `PLAYER_JOINED` /
  `player`, normalises the name, and is idempotent on the device token so
  reopening the QR is not a re-join. `reduceSession` folds `PLAYER_JOINED`
  into `state.roster` (join-ordered, duplicate-token no-op, `"Sarah K."` →
  `"Sarah K. 2"` same-name suffix). The live Session view carries a two-tap
  setup (name, then Skill Level) for an open Session; a device token in
  `localStorage` (keyed by Session id) is what "you're already in" reads.
  No phone number, email, or account anywhere in the flow (ADR 0001).
  Tests: `reduce.test.ts` roster cases, extended
  `on_deck_club_session.test.sql`, `e2e/on-deck.spec.ts` scan → setup →
  "you're in" → recognized on return.

- [x] **#243 — the rotation loop (naive selection, polling sync).** `PLAYER_QUEUED`
  and `COURT_FINISHED` reach the fold. `reduceSession` projects a `queue`
  (longest-wait-first) and a `courts` array: a Player taps to join the Queue
  and reads their position; "Court N done" re-queues the four coming off (Wait
  Time reset to the event's `at`) and walks the longest-waiting Foursome onto
  the freed Court, one Court at a time. Selection is naive — the front four —
  standing in for Match Me (ticket 05); a queued Player waits for a
  `COURT_FINISHED` rather than being pulled onto an empty Court, so "sees their
  position" always holds. `on_deck_queue_player` RPC (`anon`-callable,
  idempotent on the device token, roster-gated); `COURT_FINISHED` rides the
  foundation migration's Organizer-append policy. New Organizer floor screen at
  `/on-deck/session/[sessionId]/floor` (Courts + Queue + "Court N done"), and a
  Player's own position line on the Session view — both poll `getRotationView`
  (~4s, TanStack Query) and never receive a device token. Tests:
  `reduce.test.ts` queue/re-queue/multi-finish/wait-reset, `routes.test.ts`
  floor gating, `on_deck_rotation.test.sql`, `e2e/on-deck.spec.ts` join → get
  called → re-queue.

- [x] **#244 — Match Me selection.** Naive "front four" replaced by the
  windowed, anchored algorithm (ADR 0004) in `session/match-me.ts`: the
  longest-waiting Player is a hard anchor, the other three are the best Skill /
  Variety fit from a window of the next `SELECTION_WINDOW` (10) longest-waiting.
  Skill fit is a per-Player gap cost (`[0,1,4,9]` by level gap), summed — so
  Playing Style (v2) becomes a coefficient, not a rewrite. Variety penalises
  repeating a courtmate, decaying with how many Games ago (`completedGames`,
  recorded on every full-Court `COURT_FINISHED`). Every preference soft — the
  Court fills regardless. Ties fall to Wait Time, then a FNV-1a hash of
  `config.seed` — never `Math.random()`, so identical config + events always
  yield the identical Foursome. Tests: `match-me.test.ts` (anchor, window,
  skill spread, variety recency, determinism, seed tie-break) plus
  `reduce.test.ts` integration through the fold.

- [x] **#245 — On Deck foursomes (committed, two ahead).** `reduceSession`
  projects `state.onDeck`: up to two Foursomes ("Up next", "After that")
  selected and **committed** ahead of any Court freeing, carried forward in the
  fold's accumulator and never recomputed on a read (ADR 0007, overriding the
  old "recomputed continuously" line in CONTEXT.md). `refreshOnDeck` runs after
  every Queue-changing event: it drops Players who have left the Queue, tops up
  an incomplete Foursome (thin Queue when it formed) by appending in wait order
  without reshuffling its members, and forms fresh Foursomes via Match Me
  (ticket 05) over the Players not already committed or playing. On
  `COURT_FINISHED` the complete leading Foursome walks straight onto the freed
  Court with no Match Me call; a fresh Foursome refills the second slot. Floor
  screen gains an "On deck" section (two named cards, open spots shown);
  `RotationView.onDeck` carries display names only, and On Deck Players drop
  out of the `queue` list / count — a Player's own line reads "up next" /
  "on deck" via `me.onDeck`. Tests: `reduce.test.ts` commitment / top-up /
  promotion / windowed fresh selection / determinism / undo-parity;
  `e2e/on-deck.spec.ts` floor "On deck" section + screenshots.

- [x] **#246 — Paused: leave, no-show swap, set aside.** The single "not right
  now" state, three doors, all folding identically. `PLAYER_PAUSED` (reason
  `left` — a Player removes themselves; `set-aside` — an Operator stands them
  down) pulls a Player from the Queue and any On Deck Foursome (which tops up),
  banking their accrued Wait Time. `FOURSOME_MEMBER_SWAPPED` is the no-show
  door: it pauses the called Player (reason `no-show`) and seats a named
  replacement on the Court without restarting the Game. `PLAYER_REQUEUED`
  (Club QR re-scan, or an Operator) returns a paused Player with `waitSince`
  back-dated by the banked amount, so stepping away costs nothing. The fold
  tracks `waitStartByPlayer` (set on queue / re-queue / requeue) so the
  no-show door — where the Player is already off the Queue — preserves equity
  the same way the other two do. `reduceSession` gains `state.paused`; a paused
  Player is in no Queue, Court, or Foursome until they return.
  `bestReplacement` (in `match-me.ts`) scores the healthiest swap-in from the
  waiting window; `RotationView` carries a per-Court `suggestedReplacement`
  (name only) and a `paused` list. Migration adds `PLAYER_REQUEUED` to the
  event-type check (the foundation missed it) plus `on_deck_pause_player` /
  `on_deck_requeue_player` (`anon`-callable, no-op guards via
  `on_deck_is_paused`); the Operator doors ride the existing Organizer-append
  policy. Floor screen: a "Someone didn't show?" picker per in-play Court
  (Match Me suggestion pre-filled, overridable), a "Set aside" tap per waiting
  Player, a "Set aside" list with "back in the queue". Player view: "Leave the
  queue" while waiting / on deck, a "you've stepped out" + "Rejoin" state while
  paused. Tests: `reduce.test.ts` (each door, wait-time preservation across all
  three, swap validity, re-queue equity, paused-never-in-a-Foursome,
  undo-parity), `match-me.test.ts` (`bestReplacement`),
  `on_deck_paused.test.sql`, `e2e/on-deck.spec.ts` no-show swap → set aside →
  back in.

- [x] **#248 — the Volunteer Link.** A per-Session bearer token
  (`on_deck_sessions.volunteer_token`, minted per Session) grants the
  operational floor surface with no account — end a Game, view the Queue, set a
  Player aside, no-show swap — and stops granting the moment the Session closes
  or its Floor Mode drops volunteers. `anon` can't read the token off the
  world-readable Session row (the foundation's blanket `select` grant is
  narrowed to non-secret columns); the volunteer floor route authenticates a
  link via the SECURITY DEFINER `on_deck_check_volunteer_token`, and every
  volunteer action re-checks the token through `on_deck_volunteer_append` — the
  one write path that stamps `operator_kind = 'volunteer'` and whitelists the
  turnover events (never SESSION_*, FLOOR_MODE_CHANGED, the Group vocabulary).
  The floor's operational rules moved to `session/floor-ops.ts` (a pure
  `SessionState → outcome` decision, `node --test`), shared verbatim by the
  Organizer's INSERT path and the Volunteer's RPC path (ADR 0005 — the Operator
  is an auth gate, never a fold branch). `RotationBoard` takes a `FloorAuth`
  prop and dispatches to the right Server Actions; the Organizer floor screen
  shows a copyable Volunteer Link when Floor Mode isn't `self-serve`. New route
  `/on-deck/session/[sessionId]/volunteer/[token]` (open, not Organizer-gated).
  **Undo is out of scope — it is ticket #247**, which builds on this operator
  scope. Tests: `on_deck_volunteer_link.test.sql` (token secrecy, grant/deny by
  mode/status/type, `volunteer` Operator recorded), `floor-ops.test.ts`,
  `routes.test.ts`, `reduce.test.ts` volunteer-folds-identically,
  `e2e/on-deck-volunteer.spec.ts` (open link → end a game, bogus/self-serve
  link 404s, Organizer copies the link).

- [x] **#247 — operator Undo.** One "Undo" on the floor screen drops the most
  recent event (`on_deck_undo_last_event` — the only DELETE path, `anon` and
  `authenticated` have none) and every surface re-folds to the exact prior state
  — dropping the last event, never a compensating action. Guard rails: only the
  single latest event, only an undoable turnover type (the `floor-ops`
  `FloorEventType` set — never SESSION_STARTED / PLAYER_JOINED / PLAYER_QUEUED),
  only within `on_deck_undo_window()` (15 min, matched by `UNDO_WINDOW_MS`), and
  only when the caller's `expected_seq` still matches `max(seq)` — a concurrent
  Operator's newer action fails with `40001` and a "someone else changed the
  board" message rather than a silent wrong drop (the tip row is `for update`
  locked and a 0-row delete re-raises `40001`, so two simultaneous undos can't
  both report success). Organizer via account, Volunteer via the #248 link
  token (reusing `on_deck_check_volunteer_token`), same one RPC. `LoadedSession`
  carries the raw `lastEvent` (seq/type/at/operator) the fold discards;
  `describeUndo` (pure, `node --test`) decides whether to offer it and surfaces
  *whose* tap it was, so undoing a volunteer's mistap from the Organizer phone
  reads clearly; `RotationView.undo` carries the seq + a button label + `by`.
  Tests: `on_deck_undo.test.sql` (stale seq, window,
  non-undoable type, empty log, volunteer scope, no direct DELETE, unrelated
  Organizer), `floor-ops.test.ts` `describeUndo`, `reduce.test.ts` undo-parity
  for the swap and re-queue, `e2e/on-deck-undo.spec.ts` (tap-wrong-court → undo
  → restored, for Organizer and Volunteer).

## Next

The rest of #238 — Queue Together, the interactive Display and Kiosk, Last
Call, and the Session Summary purge.
