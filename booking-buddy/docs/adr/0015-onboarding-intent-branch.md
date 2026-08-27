# The Onboarding modal branches on user intent, and triggers on "no Booking and no Slot"

The Onboarding modal (issue #103, [adr/0012](0012-onboarding-surfaces-gender-proactively.md))
led every new User with "Add your first facility" — a data-entry step with no visible
payoff (you then have to log a Booking before the calendar shows anything), plus a Gender
field with no in-context reason, and no social step at all. That was tuned for an
audience of hand-briefed friends who mostly wanted to track their own court bookings.
Booking Buddy is now public on `/tools` (PROGRESS.md) and takes cold traffic too: less
technical, no CourtReserve habit, no friends on the app. For them "add a facility" is the
wrong first move — "propose a time" (which needs no facility) is. One first step can't
serve both.

**Decision** (issue #176): keep it one dismissible modal, but branch the body on a
modal-local **intent** choice — "track my court bookings" vs "get my group on a time" —
and change what makes it appear.

- **Intent is not persisted.** The choice is React state inside the modal; nothing is
  written server-side. A per-User "primary intent" (for analytics segmentation or
  tailoring later empty states) is a deliberate follow-up, not this. The one place the
  choice is recorded at all is the `bb_onboarding_intent` analytics event
  ([adr/0014](0014-onboarding-funnel-analytics.md)), fired client-side on the click —
  session-scoped, no PII, not a per-User record.

- **The trigger moved off `orgs.length === 0`** to "the User has **no Booking and no
  Slot**". The old trigger chased a booking-only User about facilities forever and never
  fired for someone who only wanted to coordinate times. The new one asks the real
  question — "has this User gotten anything back from the app yet?" — and stops for good
  once either artifact exists. `getDashboardPageData` gains a `hasSlot` flag for the
  Slot half (`bookings.length` already covered the other).

- **Dismissal snoozes for ~7 days**, a `localStorage` timestamp
  (`bb-onboarding-snoozed-until`), rather than reappearing on the very next dashboard
  load like the old modal did. Read only from an effect (never during render — a
  render-time `localStorage` read hydrates mismatched markup, see
  `use-ref-flipped.ts`). Storage being unavailable degrades to the old
  reappear-next-load behaviour, not a broken state.

- **Gender narrows to the coordinate branch** — see the amendment on
  [adr/0012](0012-onboarding-surfaces-gender-proactively.md).

- **A persistent friend-search footer** sits under both branches, every step past the
  choice: connecting one friend is the precondition for shared availability and Slot
  invites, so it's the one universal goal regardless of intent.

## Consequences

- Every form in the modal is the real Facilities/Bookings/Slots page form
  (`SearchPlaceForm`, `CreateOrgForm`, `CreateBookingForm`, `CreateSlotForm`,
  `GenderForm`, `FriendSearch`), reused unchanged. The only production-code additions
  are `CreateSlotForm` gaining a `defaultDate` prop and an `onPosted` callback, and
  `createSlot` returning the new Slot's id so the "coordinate" branch can move straight
  to sharing it without a navigation.
- **The personal invite link (#175) is not built yet**, so the "send it to your group"
  step ships with the Slot Link and friend search only — no invite-link block, not even
  a stub. When #175 lands it slots in beside the friend search there.
- The "next Monday" pre-fill is computed in the browser's own time zone (a bare-proposal
  Slot has no facility, so no other clock to reckon against — the same reasoning
  `parseNewSlotProposal` already applies) and means "the first Monday strictly after
  today", so choosing the branch on a Monday pre-fills the following week.
