# Reading the onboarding funnel

Booking Buddy emits custom Vercel Analytics events at each step between signup and first
value (issue #179). There is no dashboard UI — the read is done in the Vercel Analytics
console. This doc is the "how".

See `docs/adr/0014-onboarding-funnel-analytics.md` for why the events are shaped this
way and what their limits are.

## The events

All are emitted server-side, fire once on the 0 → 1 transition, and carry no payload.

| Event | Fires when |
|---|---|
| `bb_signup` | first authenticated session for a new account (any sign-in method) |
| `bb_onboarding_intent` | user picks an intent in the onboarding modal — carries `{ intent: "track" \| "coordinate" }` (client-side, from `OnboardingModal`) |
| `bb_first_facility` | user adds their first Facility (Place-backed or hand-typed) |
| `bb_first_booking` | user logs their first Booking (manual or via Sync from Email) |
| `bb_first_slot` | user posts their first Slot |
| `bb_first_friend` | user accepts their first friend request (accepter side only) |
| `bb_slot_first_response` | one of the user's Slots gets its first Response (attributed to the responder's session, not the owner's) |

## The read

In the Vercel project → **Analytics** → **Events**:

1. **Milestone volume.** Each event's count over the selected window is the number of
   users who reached that step. `bb_signup` is the denominator.
2. **Conversion rate.** `bb_first_facility` count ÷ `bb_signup` count, and so on for each
   milestone. A sharp drop between two adjacent steps is where onboarding is leaking.
3. **Time-to-milestone.** Vercel does not expose per-visitor event timing in the
   console UI directly; for median time-to, use the **Filter** on a single event plus
   the date range, or export via the Analytics API (`/v1/analytics` — the events
   endpoint returns per-event timestamps) and compute `median(first_milestone_ts −
   bb_signup_ts)` per visitor id offline.
4. **Segment by intent**: filter the funnel to
   visitors who fired `bb_onboarding_intent` with `intent = track` vs `intent =
   coordinate` and compare the two conversion curves. The expectation from #176 is that
   "track" users convert on `bb_first_facility` → `bb_first_booking` and "coordinate"
   users on `bb_first_slot` → `bb_slot_first_response`; a branch that underperforms its
   own natural path is the signal to revisit that side of the modal.

## Local verification

In `npm run dev` (no `VERCEL_URL`), the server SDK logs `[Vercel Web Analytics] Track
"<event>"` to the dev-server console instead of sending. Click through a fresh signup to
watch each event fire exactly once.
