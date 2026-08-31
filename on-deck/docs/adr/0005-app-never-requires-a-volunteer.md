# The app never requires a volunteer

On Deck's operational events - a Game ending, a no-show swap, a walk-up added - can be fired three ways: a Volunteer holding a per-Session link, the Organizer from their phone, or a Player tapping a **Kiosk** stood by the courts. Which are available is a Club setting, **Floor Mode**, with three presets: volunteer-run, self-serve, and hybrid. Hybrid is the default and the shape TO Pickleball Club's pilot runs.

The event log does not care where a `COURT_FINISHED` came from - it records the Operator and folds identically - so this is a permissions-and-surfaces decision, not an architectural one.

## Why

The paddle stack is already self-serve at most open play: you finish, you walk over, you re-rack, you read the stack. Clubs add volunteers when scale plus a fairness goal outgrows a passive rack, not because players cannot manage a turnover themselves. Requiring a volunteer would wall the product off from open play, small clubs, and any organizer who cannot staff a floor - a much larger set of users than the ones who can.

Hybrid specifically means a volunteer-run night does not stall when a volunteer is on a break or a far Court clears unnoticed: whoever is standing there taps it.

## Consequences

- The Display gains an interactive counterpart, the **Kiosk**. Read-only Display and Kiosk are independent - a Session can have either, both, or neither.
- Player notifications, cut wholesale from v1 on "phones are in bags, volunteers shout", come back in one narrow form: an **opt-in** push for a Player's own turn. Self-serve has nobody shouting, so that one buzz earns its place. Still off by default, still never a broadcast.
- The abuse surface widens - at the Kiosk anyone can tap anything. Accepted: it is a friendly social, Undo (dropping the last event) is already built, and the Organizer keeps override. Same posture as Booking Buddy's Guest RSVP flow.
- Last Call stays an Organizer/Volunteer action - it is a judgment about the night, not a Court turnover, so it is deliberately not a Kiosk button.
