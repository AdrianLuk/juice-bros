# Booking Buddy

A friend-group pickleball scheduling app living under the Juice Bros platform. Lets people post open playing time, see friends' availability, and coordinate games without ad hoc chat polls or juggling separate facility-booking sites.

## Language

**User**:
A person with an account in Booking Buddy.
_Avoid_: member. (Player was reserved here pending a distinct concept — see Player, now split out below.)

**Username**:
The handle a User shares so friends can find them without giving out an email address — unique, lower-case, and safe to display. Assigned automatically at signup (derived from display name, or the email local part when there is none) so every User is discoverable without having to set one up; changeable afterwards.
_Avoid_: Handle, nickname (both fine in product copy; Username is the canonical term)

**Connection**:
A mutual, two-sided friendship between two Users, established when one sends a friend request and the other accepts. Required before either User can see the other's availability or invite them to a Slot.
_Avoid_: Friend (use as informal shorthand only), Follow, Follower (rejected model — connections are symmetric, not one-way)

**Friend Group**:
A named, user-owned collection of a User's own Connections (e.g. "Tuesday crew"), used to set a default visibility level for calendar/Slot access. Groups are private to their owner — one User's grouping of a friend has no effect on how that friend groups them back.

**Visibility**:
How much of a User's calendar/Slot data a given Connection can see. Four levels: `none` (nothing), `slots` (only the Slots the owner shares with them), `open_time` (only the owner's Availability Windows, no Slots), `calendar` (both Slots and Availability Windows). Not a total order — `slots` and `open_time` are independent, incomparable grants; `calendar` is both of them together, `none` is neither. Resolved per friend as: an explicit per-friend override always wins if set; otherwise, for a friend in multiple Groups, every Group's grants union — being in a `slots` Group and an `open_time` Group sees the same thing as being in one `calendar` Group. Adding a friend to a more-open Group can only expand what they see, never silently restrict it — an override is the only way to close one person off without dismantling the Group they are in. A friend in no Group and with no override sees nothing. See [adr/0007-visibility-is-a-lattice-not-a-scale.md](docs/adr/0007-visibility-is-a-lattice-not-a-scale.md).

**Place**:
A real-world pickleball facility as Google Maps knows it — "PicklePlex Downsview", "Vaughan Pickleball" — identified by its Google `place_id`. Not something Booking Buddy owns or maintains: the list of Places is Google's, and the app only ever holds the ones its Users have actually picked. Facts about a Place (display name, address, coordinates) are cached server-side and refreshed, never authored here. See [adr/0005-orgs-identified-by-google-place-id.md](docs/adr/0005-orgs-identified-by-google-place-id.md).

**Org**:
One User's record of playing at a Place — the thing their Bookings hang off. A single User can have Bookings across multiple Orgs, and two Users who play at the same Place have separate Orgs pointing at the same `place_id`, which is what lets anything cross-User join them up. Where a venue isn't in Google Maps (a community-centre gym, a private court), an Org carries a hand-typed name instead and has no Place; it is one or the other, never both. A place-backed Org cannot be renamed — its name is the Place's, so everyone sees the same one.

Bookings under an Org are still entered by hand: Google supplies the venue's identity, not its reservations (ADR 0002 stands). An Org may also carry a Booking Window, driving the Booking Reminder. One Org per owner may be marked the **default facility**, pre-selecting it in the Booking form's picker instead of forcing an explicit pick every time; picking a different Org as default simply moves the mark, there is no "unset." The very first Org a User ever adds is marked default automatically — a database trigger, not app bookkeeping, so it holds regardless of which creation path added it.
_Avoid_: Club (use Org as the canonical term internally, matching how platforms like CourtReserve model it). Note that an Org is a User's *record*, not the venue itself — the venue is a Place.

Product copy is the deliberate exception: the Orgs page reads "Facilities" to non-technical Users, since "Org" means nothing to them and "Club" is wrong for a chunk of real entries — Toronto's own pickleball scene splits between venues that brand themselves a Club (Pickleplex Social Club, Vaughan Pickleball Club) and public Community/Recreation Centres, which explicitly aren't clubs (no membership, city-run). "Facility" is the umbrella term that's accurate for both, so it's what the UI says even though the entity underneath is still an Org.

**Booking**:
A single court reservation at a specific Org, owned by a User, with a date/time and an optional court label (not every facility labels its courts, and not every User bothers to note one down) — mirrors one reservation record as it exists on the facility's own platform (e.g. one CourtReserve reservation = one Booking). Entered manually by the User; there is no "unconfirmed" or "intended" state — a Booking represents a reservation that exists. Carries its own format — doubles or singles, defaulting to doubles — which is what a court's own share of Capacity is derived from (see Capacity), and its own list of Players (see Player) — who was actually there, separate from any Slot's Responses/Guests. Also carries an optional, free-text name (issue #94) — a label the User gives the session itself ("Tuesday night rally"), independent of the court label and never derived from Format; rendered above the facility name wherever one is shown on the owner's own dashboard, and not backfilled onto Bookings logged before it existed. A gathering spanning multiple courts (e.g. an 8-person game held as two separate court reservations for the same window) is multiple Bookings attached to one Slot, not multiple Slots. Along with any confirmed Slot built on it, a Booking is the authoritative source of busy time in a User's Availability — see Availability Window.

Editable in full — Org, court label, name, date/time, format, and Players — with no restriction tied to whether the Booking is already in the past: the same "no unconfirmed state" reasoning that rules out a Booking ever being partially real also means editing one has nothing to protect against that creating one doesn't already allow. (The past-date guard on the underlying row is deliberately insert-only, precisely so an edit is never blocked by it.)

**Player**:
Someone recorded as having played in a Booking — a name, plus an optional link to the Connection it matched. Entered by hand when logging a Booking (a single comma-separated list, split into names), or carried straight through from a CourtReserve confirmation email's own "Player(s)" section when an Import Candidate is confirmed — either way, unedited names land on the Booking as-is; a wrong parsed name is fixed via Edit Booking afterward rather than on the review screen itself.

The Connection link is resolved once, at the moment a Player is added — exact case-insensitive match against the User's Connections — and then stored, not recomputed later: renaming a Connection or a Player's own name never silently changes what a past Booking shows. A name matching more than one Connection (display names aren't unique — see Connection) is stored unlinked rather than guessed at, since a wrong guess would now be a permanent misattribution instead of a throwaway display hint. If a linked Connection later ends, the link clears but the name stays — a Booking is a historical record and doesn't lose data because a friendship did.

Entirely independent of a Slot's Responses/Guests, even when the Booking is attached to one — Players describe who was actually on the court (what the reservation itself says), Responses/Guests describe who said they'd come (a poll that can predate any court being booked and can include no-shows). The two lists are never reconciled, pre-filled from each other, or expected to agree. Unconstrained by the Booking's format — a doubles Booking can log more than 4 Players (rotation/subs are real), and the same name can appear twice (two different people can share one).
_Avoid_: Guest (a Slot RSVP identity — name-only, never links to a Connection, and belongs to a different list entirely; see above)

**Mailbox Link**:
A User's account-level OAuth grant to their own Gmail inbox, used only to search for CourtReserve confirmation/cancellation mail when the User triggers a sync. Not tied to any single Org — one Link covers a User's Bookings across every facility. Expires periodically under Google's Testing-mode verification status and must be re-established by the User. See [adr/0009-email-sync-via-gmail-oauth.md](docs/adr/0009-email-sync-via-gmail-oauth.md).
_Avoid_: Connection (already means a two-sided friendship between Users — do not reuse for this), Gmail Connection

**Import Candidate**:
A parsed CourtReserve confirmation, cancellation, or reservation-update email, matched against the User's Orgs and existing Bookings but not yet applied — shown on a review screen for the User to confirm before it becomes, removes, or edits a real Booking. Never a Booking itself; discarding one has no effect on any Booking. Skipped automatically, without ever becoming a candidate the User sees, when it's a confirmation for a date/time that's already passed or that duplicates an existing Booking (same Org, court, and date/time). A reservation-update email that arrives alongside its own confirmation in the same sync nets into a single confirmation-shaped candidate rather than becoming a separate one; an update with no in-batch confirmation to net against is matched against an already-logged Booking (Org + date/start-time, not court, so a real court change is still applicable) instead — confirming it edits that Booking's format/court in place.
_Avoid_: Pending Booking, Draft Booking (a Booking has no unconfirmed state — see [adr/0009-email-sync-via-gmail-oauth.md](docs/adr/0009-email-sync-via-gmail-oauth.md))

**Availability Window**:
A User's own dated declaration of being `open` or `busy` over a specific time span (start/end timestamps, free to cross day boundaries — a whole week off is one window, not seven). Shown to Connections with `calendar`-level Visibility. Entirely informational: an Availability Window never blocks, cancels, or auto-declines a Slot invite or Response — it only signals a User's own read of their schedule. Independent of Bookings — a User can declare one without ever having reserved a court, which is the point: unlike a Booking, it costs nothing to say "I'm free this weekend" or "I'm booked solid this week" without touching whatever facility platform the actual reservation lives on.

Resolving what a User's calendar shows at a given moment, in order: a Booking or a confirmed Slot (one with a Booking attached) always wins and reads as busy, regardless of any Availability Window declared over the same span; otherwise, the most recently *created* Availability Window covering that moment wins — editing an existing window's own time range or type later doesn't change its place in that order; otherwise the moment is unspecified, shown as neither. Availability Windows carry no uniqueness or overlap constraint (see [adr/0006-availability-layered-precedence.md](docs/adr/0006-availability-layered-precedence.md)), so deleting one reveals whichever older window, if any, still covers that span, rather than leaving a gap.
_Avoid_: Availability (fine as the informal feature name; Availability Window is canonical for the entity), Free time, Block, Schedule

**Slot**:
The friend-facing unit that Connections see and respond to. A Slot can exist with zero Bookings attached — a bare proposal ("Saturday 9am, who's in?") used to gauge interest before anyone reserves a court, replacing the WhatsApp "who can make X date, yes or no" poll — and later have one or more Bookings attached once a court is actually reserved, becoming a confirmed Slot with real capacity. It's the same underlying record throughout: no separate "Poll" or "Event" entity, and attaching a Booking doesn't change its identity. Org/court is optional at creation for this reason.
_Avoid_: Event, Poll (informal shorthand for "a Slot with no Booking yet" is fine in conversation, but not a separate modeled entity), Game, Session

**Response**:
A Connection's (or Guest's) explicit yes/no/maybe answer to a Slot, replacing the implicit "silence means no" join model. Can be given whether or not the Slot has a Booking attached yet. A "yes" is always accepted — no organizer approval, and no block once Capacity is reached; going past it produces an over-capacity signal for the organizer, not a refusal (see Capacity, ADR 0001). Before a Booking exists there is no Capacity at all, so any number of "yes" Responses can accrue while gauging interest. "Maybe" never counts towards Capacity.
_Avoid_: RSVP (used informally in product copy), Join, Vote

**Capacity**:
The effective ceiling on "yes" Responses for a Slot: the base capacity derived from its attached Bookings' own court capacities, plus an optional rotation buffer the organizer can configure per Slot to allow for substitutions (e.g. a doubles court with a buffer of 2 supports up to 6 "yes" Responses, expecting some rotation in and out). Each Booking carries its own format — doubles (4) or singles (2), defaulting to doubles — so Capacity sums per attached court rather than assuming every court is the same (see [adr/0008-court-capacity-is-per-booking-data.md](docs/adr/0008-court-capacity-is-per-booking-data.md)). A Slot with no Bookings has no Capacity at all, which is not the same as a Capacity of zero: there is nothing to fill yet. "Yes" Responses beyond Capacity aren't blocked — the organizer sees an over-capacity signal to resolve manually (e.g. book another court, or read it as expected rotation/drilling rather than an actual overbook), same as an unbuffered overflow. Capacity is never stored; it is derived from the attached Bookings' formats and the buffer each time it's read.

**Reminder**:
An automated notification sent to Users with a "yes" Response on a confirmed Slot (one with a Booking attached — a bare proposal has nothing concrete to remind anyone about), at a time before the Slot's start configurable per Slot. Not sent to Guests in v1. Governed by its own opt-in preference, independent of the Booking Reminder's.
_Avoid_: confusing with Booking Reminder — this one is for attendees of a confirmed game; that one is for the organizer of a still-unbooked one.

**Booking Window**:
A facility's own rule for how far in advance it opens court reservations — captured per Org as an optional lead time (days before play) and time of day, in the facility's own time zone. Not discovered automatically; the User sets it once, from what they know of the facility's own booking platform (e.g. CourtReserve), and it's reused for every Slot pointed at that Org. An Org with no Booking Window set simply never produces a Booking Reminder.

**Booking Reminder**:
An automated notification sent to a Slot's organizer once its intended Org's Booking Window opens — a nudge to go actually reserve a court before it fills up. Only sent while the Slot still has no Booking attached (once one is, there's nothing left to remind the organizer to do) and to the organizer alone, never to attendees or Guests. Governed by its own opt-in preference, independent of the plain Reminder's — someone may want one without the other.

**Intended Org**:
The organizer's own hint, on a still-bare-proposal Slot, at which Org they plan to book at — what a Booking Reminder is computed against. Not a reservation and not touched by attaching a real Booking; a bare-proposal Slot has no Org otherwise, since that only ever arrives via an actual Booking.

**Slot Link**:
A unique, shareable URL generated for a single Slot. Anyone holding the link can view that Slot's preview and RSVP, regardless of Connection status — it does not expose the organizer's broader calendar, only the one Slot it was generated for.

**Guest**:
Someone who RSVPs to a Slot via its Slot Link without holding a Booking Buddy account or being a Connection of the organizer. Identified by name only. RSVPing as a Guest does not create a Connection — becoming friends in the app is a separate, deliberate action.
_Avoid_: Player (a Booking's own record of who was on the court, which can link to a Connection and belongs to a different list entirely — see Player)
