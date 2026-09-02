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

## Hosted DB

`supabase db push` is done through **`20260902150000`** (#255 — Last Call /
close / Session Summary: `on_deck_session_summaries` + `on_deck_last_call` +
`on_deck_close_session`), pushed 2026-09-02 right after PR #340 merged.
**`20260902160000`** (#260 — turn-notification tables + subscribe/unsubscribe
RPCs) is written but **not yet pushed** — push it after its PR merges.
`20260902140000` (#254 — `scheduled` Session state + pre-creation RPCs) and
`20260902120000` (#252 — publication membership + `replica identity full` on
`on_deck_session_events`) went up the same day. `supabase migration list
--linked` shows local and remote in sync. #248 / #249 / #247 went
up together on 2026-09-01 after sitting merged-but-unpushed; #250 and #251
followed the same day (#251 pushed right after its PR merged). Note the timestamp collision it caused: `create_calendar_feed` (#293)
and `on_deck_queue_together` (#250) both landed as `20260901210000`, so #250 was
renamed to `20260901220000` (#314) *after* it had already been pushed under that
version — master's filename now matches remote. Check `migration list --linked`
at the start of a session, not just after writing a migration, and rebase a new
migration's timestamp past whatever else merged (the drift lesson
`booking-buddy/PROGRESS.md` already carries).

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

- [x] **#249 — walk-up Players and Skill Level override.** Two operator
  abilities on the floor surface (Organizer or a link-authenticated Volunteer,
  same `floor-ops` decision — ADR 0005). **Add a walk-up:** `PLAYER_JOINED`
  with a server-minted `walkup-<uuid>` id (no device) and `queueOnJoin: true` —
  a payload flag, not an operator branch — so the fold drops them into the
  roster *and* the Queue exactly like a self-registered Player. `reduceSession`
  grows a shared `enqueuePlayer` helper (the `PLAYER_QUEUED` body), reused by
  `queueOnJoin`. **Skill Level override:** `PLAYER_SKILL_SET` updates the
  roster Player's level in place; an in-progress Game, the Queue order, and any
  committed On Deck Foursome are untouched (ADR 0007) — Match Me reads the new
  level on its next selection; it is **not** undoable (#247), the fix is
  forward. `floor-ops.ts` gains `addWalkupOutcome` / `overrideSkillOutcome` and
  a `FloorOutcomeType` (the undoable `FloorEventType` set plus the two
  non-undoable roster events). The operator roster + skill levels ride a new
  auth-gated `getFloorRoster` action, **not** the world-readable `RotationView`
  (a self-declared level is operator-facing). `RotationBoard` gets an "Add a
  walk-up" form and a collapsed `<details>` "Fix a skill level" list. The
  Organizer INSERTs both event types directly (the foundation append policy
  doesn't constrain the type); `on_deck_volunteer_append` learns the two types
  with guards (a volunteer `PLAYER_JOINED` must be a queued walk-up with a
  server-minted id, a bounded name, and a valid level; `PLAYER_SKILL_SET` needs
  a valid level). Tests: `reduce.test.ts` (walk-up join, anchor + Match Me
  parity with a self-registered Player, a corrected level changing the next
  selection, committed-Foursome-not-reshuffled, undo-parity),
  `floor-ops.test.ts`, `on_deck_walkup_skill.test.sql`,
  `e2e/on-deck-walkup.spec.ts` (add four walk-ups → correct a rating → "Send
  next four" calls them).

- [x] **#250 — Queue Together, volunteer-formed.** An Operator (Organizer or a
  link-authenticated Volunteer) forms a **Group** of 2 to the live cap from
  waiting Players: `GROUP_FORMED { groupId, memberTokens[] }` and
  `GROUP_CAP_CHANGED { cap }` reach the fold. `reduceSession` grows
  `state.groups` and `state.groupCap`. `sortQueue` becomes unit-aware — a Group
  sits at the **median** `waitSince` of its members (each member keeps its real
  wait anchor, so grouping costs nobody their equity and recruiting a
  longer-waiting member only pulls the unit partway up). `refreshOnDeck` forms a
  Group's Foursome when the Group is the front unit: a Group of 4 walks on
  as-is, a Group of 2-3 is filled by `fillFoursome` (new in `match-me.ts` —
  targets the members' average Skill Level; `varietyPenalty` gains an
  `ignoreWithin` set so member-member repeats are free while the fill Players
  still feel Variety). Forming a Group is the one deliberate Operator act that
  rebuilds On Deck from scratch (ADR 0007's "never reshuffle" still holds for
  Player-triggered events). A Group binds to the Court its Foursome walks onto
  (`group.courtNumber`, `OnDeckFoursome.groupId`) and **dissolves on that
  Court's `COURT_FINISHED`** — no `GROUP_DISSOLVED` event (that is #251's manual
  volunteer dissolve); undo-parity holds because dissolution is pure fold. A
  paused member leaves their Group; a Group under two members dissolves.
  `GROUP_CAP_CHANGED` is bounded to `[2, config.groupCap]` and leaves existing
  larger Groups alone. `floor-ops.ts` gains `formGroupOutcome` /
  `lowerGroupCapOutcome`; `GROUP_FORMED` joins the undoable `FLOOR_EVENT_TYPES`
  (a mis-formed Group is undone, not played out), `GROUP_CAP_CHANGED` is
  forward-fixed. `RotationView` grows `queue: QueueEntryView[]` (a Group is one
  entry), `groupablePlayers`, `groupCap`, `onDeckIsGroup[]`, `me.group`. Floor
  screen gets a "Queue together" picker + live cap stepper and a "Group" chip on
  the On Deck card; the Player view notes "you're queued with your group".
  Migration `20260901220000` teaches `on_deck_volunteer_append` the two events
  (server-minted `group-<uuid>`, 2-8 member array, 2-8 cap) and
  `on_deck_undo_last_event` the `GROUP_FORMED` type. Tests: `reduce.test.ts`
  (median positioning, no line-jump, wait-time preservation, fill count + level,
  member-variety suppression, dissolve, cap enforcement, paused-member,
  determinism, undo-parity), `match-me.test.ts` (`fillFoursome`),
  `floor-ops.test.ts`, `on_deck_queue_together.test.sql`,
  `e2e/on-deck-queue-together.spec.ts` (form a Group of 3 → filled to 4 with a
  Group label → walks on → dissolves).

- [x] **#251 — Queue Together, player-formed.** The second half of Queue
  Together. A Player forms a **Group** from their own phone by picking other
  Players who did setup this Session (display names — a device token never
  reaches the client, ADR 0001; the Server Action resolves names to tokens and
  always folds the acting Player in). Picked members are added with **no
  confirm-prompt** (they're in their bags); instead any member can remove
  *themselves* (`GROUP_MEMBER_REMOVED { groupId, token }` — they stay in the
  Queue as a solo; a Group left under two dissolves), and a Volunteer or the
  Organizer can dissolve a whole waiting Group (`GROUP_DISSOLVED { groupId }`).
  All ticket 11 / #250 Group semantics (median position, fill to four, Variety
  suppression, dissolve on `COURT_FINISHED`, the cap) are unchanged and read
  identically whoever fired `GROUP_FORMED` (ADR 0005) — the fold only grew the
  two new cases plus a shared `rebuildOnDeck` helper (a deliberate Group-shape
  change rebuilds On Deck from scratch, the same override `GROUP_FORMED` already
  made). `floor-ops.ts` gains `formGroupByPlayerOutcome` / `leaveGroupByPlayerOutcome`
  (player-sourced, decided by the same pure helpers but committed through `anon`
  Player RPCs) and `dissolveGroupOutcome`; `GROUP_DISSOLVED` joins the undoable
  `FLOOR_EVENT_TYPES`, `GROUP_MEMBER_REMOVED` stays out (Player-sourced, like
  `PLAYER_QUEUED`). `sessions.ts` `toEvent` learns to parse both new rows —
  **missing this is what silently drops the event before the fold**, the bug
  the e2e caught. `RotationView` grows `queue` group entries carrying `groupId`
  (for the floor's "Break up"), `me.canFormGroup` + `me.groupmateOptions`. The
  Player view (`queue-status.tsx`) gets a "Playing with friends? Queue together"
  picker and a "Leave the group" link; the floor's group Queue row gets a "Break
  up" tap and a one-line line-jump explainer (`QUEUE_TOGETHER_EXPLAINER`, shared
  so the Display #253 can reuse it — #238 user story 57). Migration
  `20260901230000` adds `on_deck_form_group` / `on_deck_leave_group` (anon,
  pinned to `player`, actor-must-have-joined / actor-must-be-a-member guards)
  and teaches `on_deck_volunteer_append` + `on_deck_undo_last_event` about
  `GROUP_DISSOLVED`. Tests: `reduce.test.ts` (player/volunteer fold parity,
  self-removal keeps the Queue spot, dissolve restores the pre-Group board,
  no-op guards, undo-parity for both), `floor-ops.test.ts`,
  `on_deck_queue_together_player_formed.test.sql`,
  `e2e/on-deck-queue-together-player.spec.ts` (form on phone → one Queue unit →
  leave it → volunteer breaks it up).

- [x] **#252 — Realtime sync upgrade.** An isolated swap of the trigger
  mechanism, not a rearchitecture: every live surface still re-folds the same
  event log, now nudged by a Supabase Realtime subscription
  (`postgres_changes`, INSERT on `on_deck_session_events`, filtered by
  `session_id`) instead of only a ~4s poll — a "Court done" tap lands on the
  other phones in ~1s. `useRotationSync` (`src/components/on-deck/`) owns the
  channel and returns the `refetchInterval` for the surface's TanStack Query:
  a 12s backstop poll while the socket is confirmed live, the ~4s fallback
  cadence while connecting or after a drop — so a socket drop falls back to
  polling and a reconnect resumes Realtime with no caller branching. The
  channel listens for `*` (not just INSERT) so operator Undo's DELETE re-folds
  the other surfaces too, and `on_deck_session_events` is `REPLICA IDENTITY
  FULL` so that DELETE's old-row image still carries `session_id` to match the
  channel filter. The 12s backstop specifically covers `SESSION_CLOSED`, which
  Realtime can't deliver to an `anon` subscriber (it re-checks the "open
  Session" SELECT policy at notify time, and the Session is closed by then).
  A missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` is caught — the surface just stays
  on the fallback poll rather than crashing. The poll-interval / channel-status
  policy is pure in `session/realtime.ts`
  (`node --test`, relative imports only); a new browser Supabase client
  (`supabase/client.ts`, anon key, mirrors Booking Buddy's) opens the channel.
  Migration `20260902120000` adds the table to the `supabase_realtime`
  publication (guarded `do` block) and sets `replica identity full` — **no
  change to `reduceSession`, the event schema, or any RLS policy.** Realtime
  enforces the foundation's existing SELECT policies per subscriber, so a
  client only receives its own open Session's events (ADR 0006), never a
  closed Session's. Tests: `realtime.test.ts` (status mapping, interval
  policy), `on_deck_realtime.test.sql` (publication membership, no other
  On Deck table joined, SELECT policies unchanged, anon reads open not closed),
  `on_deck_realtime.test.sql` also pins `replica identity full`;
  `e2e/on-deck-realtime.spec.ts` (two browser contexts, walk-up added on the
  floor / player leaves the queue — each appears in the other within ~1s with
  no reload).

- [x] **#253 — the Display.** A read-only board for a tablet on the snack
  table, at `/on-deck/session/[sessionId]/display` — open, no account and no
  token (`routes.ts` `displayPath`; not added to the Organizer-gated set). It
  renders the same `RotationView` every other surface folds — Courts and
  occupants, the two On Deck Foursomes as the visually prominent element (big
  bordered brand cards up top), and the full Queue in order — plus **Wait
  Times**: `QueueEntryView` grew a `waitSince` (a solo's Queue anchor; a
  Group's is the median of its members', matching where it queues), rendered
  through `session/wait.ts` `formatWaitLabel` (pure, `now`-injected, relative
  imports only — "just now" / "7 min" / "1 hr 12 min", future-skew clamped).
  `DisplayBoard` polls `getRotationView` with **no token** (display names only
  — no Skill Level, no contact data ever reach it) and rides `useRotationSync`
  (#252) for ~1s updates, with a 30s local clock tick so idle Wait Times still
  advance. Zero operational buttons. The `QUEUE_TOGETHER_EXPLAINER` line is
  always shown. A Session runs identically with no Display open — it only ever
  reads. The Organizer floor screen links to it ("Got a spare screen?"). Tests:
  `wait.test.ts`, `routes.test.ts` (Display is not Organizer-gated),
  `e2e/on-deck-display.spec.ts` (courts / queue+wait-times / both On Deck
  Foursomes render, no Skill Level, no buttons, no horizontal scroll on a
  tablet; reflects a join, a Court finish, and an On Deck change).

  **App shell.** Every surface under `/on-deck/` (session view, Display, floor,
  Volunteer Link, `home`, `sign-in`, `auth`) now runs inside On Deck's own bare
  chrome — `src/app/on-deck/layout.tsx` + `OnDeckShellHeader` /
  `OnDeckShellFooter` (a brand bar linking to the landing, a one-line footer,
  no navigation — the same restraint as Booking Buddy's `BbAppShell`).
  `SiteChromeSlot` now suppresses the global Juice Bros header/footer for
  `/on-deck/*` the way it already did for `/booking-buddy`; the marketing
  landing at **exactly `/on-deck`** keeps the full site chrome (both shell
  components no-op there). It's a walk-up tool — a phone at the courts, a tablet
  on a table — so there's nowhere to navigate to.

- [x] **#254 — Session pre-creation and Club defaults.** Two Organizer
  abilities on top of one-tap Start. **Edit the Club defaults** (venue, court
  count, group cap): the foundation left `on_deck_clubs` read-only even to the
  owner, so this adds one narrow write path, `on_deck_update_club_defaults`
  (SECURITY DEFINER, owner-checked, touches only those three columns —
  `owner_id` / `name` are untouchable), fronted by a new
  `/on-deck/home/settings` screen. **Schedule a Session ahead of time**: a new
  `scheduled` status on `on_deck_sessions` (`started_at` now nullable,
  `scheduled_for date` added, a `case status` shape constraint, a
  one-scheduled-per-Club-per-day partial unique index). `on_deck_create_/
  update_/delete_scheduled_session` RPCs (owner-checked; group cap + Floor Mode
  always come from the Club, only date / venue / court count are per-night);
  `/on-deck/home/sessions/new` + `/on-deck/home/sessions/[sessionId]` screens
  (shared `SessionForm`). `on_deck_start_session(p_club_id, p_today date
  default null)` rewritten: if the Club has a `scheduled` Session dated
  **exactly** `p_today` it is *promoted* (`status → open`, `started_at →
  now()`, `scheduled_for → null`, `group_cap` / `floor_mode` refreshed from
  the Club) carrying its own venue / court count in the `SESSION_STARTED`
  payload; otherwise a fresh Session is built entirely from the Club defaults
  as before. `p_today` is the Organizer's *local* calendar date, attached by
  the Start form (`StartSessionButton`, a hidden input) so "due today" is
  judged in their time zone, not the server's UTC — absent (JS off) the RPC
  falls back to `current_date`. Exact-date match, not `<=`: a stale plan the
  Organizer never started never silently hijacks a later unrelated night; it
  stays in the list to edit or delete. The fold is
  untouched — court count already flows from the Session row through
  `config.courtCount` into `state.courts`, so the promoted Session's count
  drives the floor screen and Display for free. A `scheduled` Session is the
  owner's alone to read (RLS: it is not `status = 'open'`, so the
  public-to-the-venue policy never matches); `getSession` filters it out of the
  fold path. The Organizer home screen lists upcoming scheduled Sessions with
  an edit link and flags the one Start will open. Tests: `routes.test.ts` (the three
  new paths are Organizer-gated), `on_deck_session_precreation.test.sql`
  (defaults round-trip + owner-only, scheduled CRUD + owner-only + one-per-day,
  shape constraint, promote-on-Start carries its own court count while group
  cap follows a defaults edit, fresh Start when nothing is dated today,
  `scheduled` invisible to `anon`),
  `e2e/on-deck-session-precreation.spec.ts` (edit defaults → persist; schedule
  with its own court count → Start opens it → floor shows that many Courts;
  edit-ahead → Start uses the edited values).

- [x] **#255 — Last Call, close, and the Session Summary.** Two events reach
  the fold: `LAST_CALL` (Organizer or Volunteer, never a Kiosk — ADR 0002) sets
  `state.lastCallAt`, clears On Deck, and gates `seatCourt` / `refreshOnDeck` so
  no new Foursome assigns and no new On Deck forms while Games on Courts finish
  normally; `SESSION_CLOSED` flips `state.status` to `closed`. The permanent
  anonymous **Session Summary** is a new pure projection,
  `session/summary.ts` `projectSummary(config, events)` — attendance, games
  played (occupied-Court finishes, split per Court via a new optional
  `CompletedGame.court`), court utilization, wait-time distribution + longest +
  average (from a new `state.completedWaits`, banked each time a Player is
  seated), skill mix. Migration `20260902150000`: `on_deck_session_summaries`
  (permanent, Organizer-readable, RLS); `on_deck_last_call(session, token?)` —
  one write path for both Operators, idempotent; `on_deck_close_session(session,
  summary)` — one transaction that stores the Summary (computed in the Server
  Action from `projectSummary`, not re-folded in SQL), flips `status`, and
  **purges every `on_deck_session_events` row for the Session — the Player
  roster with it, ADR 0001**. The "SESSION_CLOSED of the vocabulary" is the
  `status = 'closed'` flag; appending a row only to purge it in the same
  breath would be theatre. Close is idempotent and frees the "one open per
  Club" index; the Club QR resolver then shows "nothing running". Actions:
  `callLastCall` / `closeSession` (`actions/floor.ts`), `volunteerCallLastCall`
  (`actions/volunteer.ts` — no volunteer close). `RotationView` grew `lastCall`
  and `permitEndsAt` (always null for now — no `permit_ends_at` column yet; the
  floor's soft "call it?" nudge at `LAST_CALL_NUDGE_LEAD_MS` reads it and stays
  hidden while null). Floor screen: a
  "Wrapping up" card with a confirm on Last Call (no undo for it) and, once
  called, a confirm on Close (Organizer only). The Player line and the Display
  flip to "final games". Tests: `reduce.test.ts` (Last Call halts assignment
  while in-progress Games persist; close; replay/undo parity),
  `summary.test.ts` (every aggregate against a known log; determinism),
  `on_deck_last_call_close.test.sql` (both Operators, idempotency, the purge,
  the freed index, a Player can't append the vocabulary),
  `e2e/on-deck-last-call.spec.ts` (last-call → finish → close → QR shows
  nothing running).

- [x] **#260 — the opt-in turn notification.** A Player may turn on a single
  push — "you're up, Court 5" — fired when their Foursome enters On Deck or is
  assigned a Court, because a `self-serve` Session has no Volunteer calling
  names (ADR 0005). Off by default; a one-tap enable on the Player's own status
  screen, shown only under `self-serve` / `hybrid`. Per-Player, never a
  broadcast; at most one buzz per step. Reuses Booking Buddy's `web-push` setup
  (issue #12) — the same VAPID pair. Degrades silently where the browser can't
  subscribe or the deploy has no VAPID keys.

  The fold-exposed transition is `session/turn-notify.ts` `turnTransitions(before,
  after)` — a pure diff of two folded `SessionState`s returning who is *newly*
  On Deck or *newly* on a Court (a Court transition supersedes an On Deck one —
  "one buzz"; a Player who skips On Deck from a thin Queue or a no-show swap
  still gets one `court` transition; queue-position movement short of On Deck
  fires nothing). Each transition carries a `turnKey` — `court:<n>:<since>` /
  `on-deck:<committedAt>` — so the idempotency log dedupes per *turn*, not per
  Player: a Player rotating through many Games gets buzzed every turn, not just
  the first. `turn-notify-run.ts` `planTurnNotificationRun` is the plan
  half (no Next/Supabase imports, like `booking-buddy/reminder-run.ts`):
  transition × opted-in subscription × not-already-sent → a flat send list.
  On Deck has no cron, so `turn-notify-dispatch.ts` `dispatchTurnNotifications`
  runs the sends *inline* right after an operational event is appended —
  threaded through `commitFloorOutcome` (Organizer + Volunteer floor ops) and
  the four Player actions that can move a Foursome (`queueForSession`,
  `rejoinQueue`, `formGroupAsPlayer`, `leaveGroup`). It re-folds via the admin
  client, reads every `on_deck_push_subscriptions` row for the Session, sends
  through `web-push` (pruning 404/410), and writes the
  `on_deck_turn_notification_sends` idempotency log. **It never throws** — a
  push hiccup must not fail the "Court N done" tap.

  Migration `20260902160000`: `on_deck_push_subscriptions` (per device, scoped
  to one Session, keyed by the device token — not `auth.users`, On Deck has no
  accounts; `on delete cascade` on `session_id` — note close only purges the
  event rows, not the Session row, so these linger harmlessly until the Session
  row is removed) and `on_deck_turn_notification_sends` (unique `(session,
  player, transition)` where `transition` is the per-turn key — the "one buzz
  per turn" guarantee). Neither table is readable by `anon` /
  `authenticated` — a device token is a Player's whole identity. A Player writes
  a subscription through `on_deck_subscribe_turn_notification` (`anon`-callable,
  SECURITY DEFINER, roster- and open-Session-gated, idempotent on the endpoint)
  and clears it through `on_deck_unsubscribe_turn_notification` (keyed by the
  endpoint — the browser's own secret). New service worker `public/on-deck-sw.js`
  (scope `/on-deck`), new `src/components/on-deck/turn-notifications.tsx` (the
  one-tap control, in `QueueStatus` under self-serve/hybrid; every failure
  fails silent). `PlayerJoin` / `QueueStatus` gained a `floorMode` prop.

  Tests: `turn-notify.test.ts` (each transition, the supersede rule, thin-Queue
  and no-show paths, no-op cases, determinism), `turn-notify-run.test.ts`
  (opt-in gating, idempotency, `pushConfigured` off, payload),
  `on_deck_turn_notifications.test.sql` (subscribe roster/open-Session gating,
  upsert, unsubscribe no-op, tables not `anon`-readable, send-log uniqueness),
  `e2e/on-deck-turn-notification.spec.ts` (control shows under self-serve, is
  absent under volunteer-run and on an unsupported browser, subscribe stores a
  row). Real push *delivery* is out of e2e scope — same posture as
  `push-notifications.spec.ts` (Chrome ↔ FCM is outbound network the suite
  can't assume; the e2e web server carries no VAPID keys).

## Next

The rest of #238 — the interactive Kiosk.
