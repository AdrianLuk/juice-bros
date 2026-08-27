# Onboarding funnel analytics are emitted server-side, gated on a 0→1 database check

Booking Buddy is public on `/tools` and taking cold traffic, but nothing measured where
new users fell off between signup and first value, so onboarding changes (#176, #177)
shipped blind. Issue #179 adds custom Vercel Analytics events at each funnel step. Two
things needed deciding: where the events fire from, and how "this is the user's *first*
Facility" is decided without trusting the client.

**Decision**: The funnel events are emitted **server-side** via
`@vercel/analytics/server`'s `track()`, from inside `after()` in the relevant Server
Action (or the auth callback Route Handler), and each "first X" event is gated on a
**post-write row count** against the database — `orgs`/`bookings`/`slots` count for the
owner `=== 1`, accepted `connections` involving the accepter `=== 1`, `responses` for
the Slot `=== 0` immediately *before* the write. All payloads carry no PII. The events:
`bb_signup`, `bb_first_facility`, `bb_first_booking`, `bb_first_slot`, `bb_first_friend`,
`bb_slot_first_response`. The central module is `src/lib/booking-buddy/analytics.ts`.

**Why server-side, not client `track()`**: the existing gear-click event fires from the
browser because "did someone click this link" is a client fact. "Is this the user's
first Facility" is not — it's a database fact, and a client-emitted event would either
trust a count the client can't be trusted for, or fire on every add. `after()` keeps the
round trip off the action's response path.

**Why a count check, not an app-managed "has fired" flag per milestone**: five flags on
`profiles` (or a new table) to dedupe five events is more schema and more to keep in
sync than re-deriving the answer from the rows that already exist. The count is exact,
needs nothing kept up to date, and is naturally idempotent — a second add sees count 2
and stays quiet. `bb_signup` is the one exception (see below).

**`bb_signup` gets a set-once column**: there is no "first Facility"-style row whose
existence means "signed up", and the event fires from three different auth entry points
(magic-link/OAuth callback, password sign-in, Google ID-token sign-in). A new nullable
`profiles.funnel_signup_at` is stamped by an atomic `update ... where funnel_signup_at
is null`; only the call that flips it emits. It is analytics-only — nothing reads it at
request time, and it is not a security boundary (migration
`20260827120000_add_profile_funnel_signup_at.sql` says so in the column comment).

## Consequences / known limits

- **`bb_first_friend` fires for the accepter only.** When A accepts B's request, both
  gain their first Connection, but only A runs code. Emitting "for" B via a server
  `track()` would attribute the event to A's visitor session (Vercel custom events are
  session-keyed; there is no way to emit as another visitor). Requester-side
  first-friend is therefore under-counted. Acceptable for a funnel read that is about
  spotting drop-off, not exact per-user accounting.
- **`bb_slot_first_response` is attributed to the responder, not the Slot owner.** Same
  session-keying constraint. It is usable as event volume / trend ("how many Slots got
  their first reply, and when"), not as a step joinable into the owner's own
  signup→milestone funnel. The issue's "lightweight read" framing accepts this.
- **Pre-existing accounts backfill one late `bb_signup`** on their next sign-in, when
  `funnel_signup_at` is first stamped. The account set that predates this is small and
  known; a one-time blip is harmless.
- **`bb_onboarding_intent` (`{ intent: "track" | "coordinate" }`) is not implemented
  here.** It needs the intent selector that #176 adds to the Onboarding modal — there is
  no intent choice in the modal yet. #176 wires it, client-side, from the choice
  handler: `track("bb_onboarding_intent", { intent })`. Until then the funnel cannot be
  segmented by intent; every other step is live.
- The read itself is a manual activity in the Vercel Analytics console — see
  `booking-buddy/docs/onboarding-funnel.md`. No dashboard UI (explicitly out of scope).
