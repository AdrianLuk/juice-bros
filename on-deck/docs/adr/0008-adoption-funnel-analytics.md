# The adoption funnel is six counters, and it cannot follow a visitor across a gap

On Deck is feature-complete and nobody has ever used it. The one Club that ever existed
was created by a SQL insert, the organizer it was built for has left, and there is no
successor to walk through it. OD-6 puts a demo and a self-serve Club in front of
strangers we will never meet and never speak to, which means the only way to learn
anything from the first ten of them is to count what they did.

Issue #524. Deferring it was the one deferral in the release that could not be recovered
later: analytics added in month two cannot see month one, and the first ten signups are
not repeatable.

**Decision**: six custom Vercel Analytics events, following Booking Buddy's ADR 0014
exactly — server events emitted after the fact from Server Actions inside `after()`,
failures swallowed, no table of our own, no dashboard, read by hand in the Vercel
console. The two demo events are the exception and fire from the browser, because they
are browser facts about a page with no account behind it.

| Event | Where | Fires when |
|---|---|---|
| `od_demo_opened` | browser | `DemoStage` mounts. Once per page load |
| `od_demo_finished` | browser | three turnovers have been watched. Once per page load |
| `od_club_intent` | browser | a "Create your Club" is clicked, carrying `{ from }` |
| `od_club_created` | server | `createClub` genuinely creates one |
| `od_first_session_started` | server | the Club's first ever Session opens |
| `od_first_session_closed` | server | the Club's first ever Session closes, carrying `{ auto }` |

Event names, and the `from` values, are declared in
`src/lib/on-deck/analytics-events.ts`. The server emitters and their gates are in
`src/lib/on-deck/analytics.ts`.

## Why the sixth one exists

The release originally named five (`docs/next-steps-2026-09.md`, question 9). The sixth
is `od_club_intent`, and it fires **before** authentication.

Without it, "the demo did not convince them" and "signing up was too much friction" are
the same number. They need opposite fixes: the first is a product problem in the demo,
the second is a problem in the sign-in page and the two-field form behind it. Five
counters cannot tell them apart, because everything between the demo and a created Club
is otherwise silent.

`from` distinguishes the three places the click can happen (`demo`, `landing-hero`,
`landing-close`) as a dimension rather than three events, because they are the same
intent and the interesting question is which one carries it.

## Why `od_demo_finished` is a chosen threshold

The demo's night has no ending to reach. That is the product, not a shortcut: ADR 0002
is a rolling queue with no time cap, so the only literal "finished" available is a
visitor tapping Last Call and then Close in the wrap-up panel, which next to nobody will
do. Defining the event that way would have made the middle of the funnel read as
near-total drop-off whether or not that was true, and left "the demo did not convince
them" without a denominator.

So it is three turnovers, counted in `DemoStage` from committed `COURT_FINISHED` events
— by tap on the Floor, by tap on the Kiosk, or by "let it run" alike. Three is the
smallest count that is unmistakably a decision to keep watching rather than one curious
tap. It is an invented number and is written here as one. If it turns out to be wrong,
`od_demo_opened` remains the honest denominator and the threshold can move without
invalidating what has already been counted.

Refs, not state, and deliberately not reset by the demo's Reset: somebody who starts the
night over has still watched the turnovers they watched.

## Why the first-time gates are shaped the way they are

ADR 0014's post-write row count, unchanged, for the two Session events:
`on_deck_sessions` for the Club with `started_at is not null` (which excludes a
`scheduled` row, issue #254, that is not a night anybody ran), and
`on_deck_session_summaries` for the Club. A count of exactly 1 is the 0 → 1 transition.

`od_club_created` needs no gate at all. `on_deck_clubs_one_per_owner` means an account
cannot reach a second successful create, and the action excludes the
`ClubAlreadyExistsError` branch that returns success for a Club that was already there —
so counting a double-submit as a second stranger is not possible.

Summaries rather than `on_deck_sessions.status` for the close count, because the Summary
row is written by the same transaction that closes a Session and is the only permanent
record of one: the event log and the roster are purged on close (ADR 0001).

## Consequences and known limits

- **A visitor who demos today and signs up next week does not join across the gap.**
  Vercel custom events are keyed to a visitor session, and the payloads carry no id to
  join on instead — deliberately, the same choice ADR 0014 made for Booking Buddy, where
  it is already documented as the reason `bb_slot_first_response` is readable as volume
  and not as a step in the owner's own funnel. The consequence is sharper here, because
  four of these six events sit on the far side of an account that did not exist when the
  first two fired. `od_demo_opened` → `od_demo_finished` → `od_club_intent` is one visit
  and joins cleanly. `od_club_created` onward is a different session for anybody who
  slept on it, and no read of these six counters can say that those were the same
  person. They are step volumes and trends, not a per-visitor path, and a conversion
  rate computed across that boundary is an estimate rather than a measurement.
- **Second and later nights are not counted.** `od_first_session_started` and
  `od_first_session_closed` are 0 → 1 only. This funnel asks whether a stranger ever ran
  a night; whether they came back is a retention question and needs its own instrument.
- **`od_first_session_closed` carries `auto`.** A Session that closed itself six hours
  after going quiet (issue #516) ended, but the Organizer walked away from it. That is
  the outcome most worth seeing and the one a single undifferentiated "closed" count
  would hide.
- **The auto-close event can fire from a page render**, and that constrains its shape.
  `resolveOpenSessionForClub` runs during the Organizer's home screen as well as inside
  Start, which is already true of the write it wraps. `after()` keeps the round trip off
  both — but Next refuses `cookies()` *inside* `after()` while rendering, so a helper
  that built its own Supabase client threw there and the event was silently lost. Every
  gated helper therefore takes the client its caller already holds. Worth knowing before
  adding a seventh event anywhere near a render.
- **A client event fired on mount needs `trackWhenReady`, not `track`.** The browser
  SDK's `track()` is a bare `window.va?.call(...)` with no queue of its own, and the root
  layout renders `<Analytics />` after `{children}`, so its injection effect runs after
  the page's and a mount-time event is dropped without a word. `src/lib/on-deck/analytics-browser.ts`
  waits for the SDK and explains why it hands back nothing to clean up with — a canceller
  is the obvious shape and Strict Mode turns it into a lost event. This only bites
  `od_demo_opened`; every other client event in the repo is click-driven.
- **The demo's events are trivially spoofable and trivially blockable.** They are
  browser calls on a public page with no account. An ad blocker suppresses them and
  anybody can fire them by hand. Acceptable: this is a funnel for spotting where ten
  strangers stopped, not an accounting system, and nothing is authorized on the strength
  of it.
- **No tests.** Consistent with Booking Buddy's call on the same code shape — the added
  logic is a row count plus a guarded external call, and the seam policy in
  `on-deck/PROGRESS.md` says not to build a harness for that. The demo's new
  "Create your Club" exit is a UI surface and is covered by Playwright.
- **The read is manual**, in the Vercel Analytics console. See
  `on-deck/docs/adoption-funnel.md`.
