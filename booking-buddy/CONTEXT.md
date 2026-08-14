# Booking Buddy

A friend-group pickleball scheduling app living under the Juice Bros platform. Lets people post open playing time, see friends' availability, and coordinate games without ad hoc chat polls or juggling separate facility-booking sites.

## Language

**User**:
A person with an account in Booking Buddy.
_Avoid_: Player, member (reserve for later if a distinct facility-membership concept emerges)

**Username**:
The handle a User shares so friends can find them without giving out an email address — unique, lower-case, and safe to display. Assigned automatically at signup (derived from display name, or the email local part when there is none) so every User is discoverable without having to set one up; changeable afterwards.
_Avoid_: Handle, nickname (both fine in product copy; Username is the canonical term)

**Connection**:
A mutual, two-sided friendship between two Users, established when one sends a friend request and the other accepts. Required before either User can see the other's availability or invite them to a Slot.
_Avoid_: Friend (use as informal shorthand only), Follow, Follower (rejected model — connections are symmetric, not one-way)

**Friend Group**:
A named, user-owned collection of a User's own Connections (e.g. "Tuesday crew"), used to set a default visibility level for calendar/Slot access. Groups are private to their owner — one User's grouping of a friend has no effect on how that friend groups them back.

**Visibility**:
How much of a User's calendar/Slot data a given Connection can see. Resolved per friend as: an explicit per-friend override always wins if set; otherwise, for a friend in multiple Groups, the most permissive of those Groups' levels applies. Adding a friend to a more-open Group can only expand what they see, never silently restrict it.

**Org**:
A club or facility where a User holds court reservations (e.g. a CourtReserve-registered club). Entered manually by the User in v1 — Booking Buddy does not integrate with any facility platform's API. A single User can have Bookings across multiple Orgs.
_Avoid_: Facility, Club (use Org as the canonical term, matching how platforms like CourtReserve model it)

**Booking**:
A single court reservation at a specific Org, owned by a User, with a court and date/time — mirrors one reservation record as it exists on the facility's own platform (e.g. one CourtReserve reservation = one Booking). Entered manually by the User; there is no "unconfirmed" or "intended" state — a Booking represents a reservation that exists. A gathering spanning multiple courts (e.g. an 8-person game held as two separate court reservations for the same window) is multiple Bookings attached to one Slot, not multiple Slots.

**Slot**:
The friend-facing unit that Connections see and respond to. A Slot can exist with zero Bookings attached — a bare proposal ("Saturday 9am, who's in?") used to gauge interest before anyone reserves a court, replacing the WhatsApp "who can make X date, yes or no" poll — and later have one or more Bookings attached once a court is actually reserved, becoming a confirmed Slot with real capacity. It's the same underlying record throughout: no separate "Poll" or "Event" entity, and attaching a Booking doesn't change its identity. Org/court is optional at creation for this reason.
_Avoid_: Event, Poll (informal shorthand for "a Slot with no Booking yet" is fine in conversation, but not a separate modeled entity), Game, Session

**Response**:
A Connection's (or Guest's) explicit yes/no/maybe answer to a Slot, replacing the implicit "silence means no" join model. Can be given whether or not the Slot has a Booking attached yet. Once a Booking is attached, capacity becomes an enforceable ceiling on "yes" Responses (first-come, no organizer approval needed — see Slot); before a Booking exists, there's no capacity to enforce, so any number of "yes" Responses can accrue while gauging interest. "Maybe" never counts against capacity.
_Avoid_: RSVP (used informally in product copy), Join, Vote

**Capacity**:
The effective ceiling on "yes" Responses for a Slot: the base capacity derived from its attached Bookings' courts, plus an optional rotation buffer the organizer can configure per Slot to allow for substitutions (e.g. a 4-person court with a buffer of 2 supports up to 6 "yes" Responses, expecting some rotation in and out). "Yes" Responses beyond Capacity aren't blocked — the organizer sees an over-capacity signal to resolve manually (e.g. book another court), same as an unbuffered overflow.

**Reminder**:
An automated notification sent to Users with a "yes" Response on a confirmed Slot (one with a Booking attached — a bare proposal has nothing concrete to remind anyone about), at a time before the Slot's start configurable per Slot. Not sent to Guests in v1.

**Slot Link**:
A unique, shareable URL generated for a single Slot. Anyone holding the link can view that Slot's preview and RSVP, regardless of Connection status — it does not expose the organizer's broader calendar, only the one Slot it was generated for.

**Guest**:
Someone who RSVPs to a Slot via its Slot Link without holding a Booking Buddy account or being a Connection of the organizer. Identified by name only. RSVPing as a Guest does not create a Connection — becoming friends in the app is a separate, deliberate action.
