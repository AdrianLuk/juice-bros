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

## Next

The rest of #238 — Queue Together, the Volunteer link surface, the Display and
Kiosk, Last Call and the Session Summary purge.
