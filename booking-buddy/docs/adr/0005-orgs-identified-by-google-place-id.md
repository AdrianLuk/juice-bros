# Orgs are identified by Google Place ID, with a server-owned Place cache

An Org started life as a free-text name, unique per owner and nothing more. Three things that plan cannot do:

- **Two Users at the same club are unrelated rows.** Amy's "Rally Point" and Ben's "Rally Point" have no way of being known to be the same facility, so nothing downstream — a shared Slot's location, "who else plays here", the club pages in the main site's backlog — can ever join them.
- **A calendar invite needs an address.** Phase 8's Reminder emails are meant to carry an event a User can add to their own calendar; an iCalendar `LOCATION` field wants a postal address, and a typed string gives you nothing.
- **There is no canonical name.** "PicklePlex Downsview", "PicklePlex DV" and "pickleplex downsview" are one real place spelled three ways, and no amount of per-owner uniqueness notices that.

A hand-curated facility list fixes all three and creates a worse problem: somebody has to maintain it, forever, as clubs open.

**Decision**: an Org is a User's own record of playing at a **Place**, and where that Place exists in Google Maps it is identified by its Google `place_id`. Facts about the Place — display name, formatted address, coordinates — live in a single server-written `place_cache` table keyed by `place_id`, read by every authenticated User and writable by none of them. An Org that has no `place_id` carries a hand-typed `name` instead; exactly one of the two is set.

## Why the cache table, and why the server owns it

Google's Maps Platform service terms permit caching `place_id` **indefinitely** and coordinates for **up to 30 consecutive days**; display name and formatted address have no caching exception at all. So a schema that copies Google's name and address onto each `orgs` row and keeps them forever is outside the terms, quite apart from letting the same facility drift into several spellings.

Three shapes were considered:

- **Name stored per Org.** Rejected: permanent retention of Google's content, and the divergence problem survives.
- **No local copy at all — fetch from Google on every render.** Rejected: stricter than the terms require, and it pays for the privilege with a Places call per page view, a bookings list that goes blank when Google is slow, and a bill that scales with traffic instead of with distinct facilities.
- **A cache with a lifetime** — chosen. One row per facility across the entire user base, refreshed when stale, which is precisely the behaviour the 30-day window exists to permit.

`place_cache` is the first table in Booking Buddy that is not owner-scoped, and that is deliberate rather than a crack in ADR 0003's posture: it is **read-only to Users and written only by the server**. A user-writable shared `facilities` table would have been the obvious alternative and brings a moderation problem this project has no answer for — junk rows, and a real club renameable by any signed-in stranger. A cache of a third party's data has no such surface.

## This does not contradict ADR 0002

ADR 0002 rules out integrating with facility *booking platforms* — CourtReserve and its peers — because no member-scoped API exists without the facility's cooperation. Google Places is a directory lookup, not a source of reservation data. **Bookings are still entered by hand.** All Places does is tell us which real-world Place a User's Org points at.

## Consequences

- **`service_role` is needed earlier than expected.** PROGRESS.md predicted Phase 8's Reminder job would be the first thing to need it; writing `place_cache` beats it there.
- **Attribution is an obligation, not a nicety.** Google requires "Powered by Google" wherever Places data is displayed outside a Google map — the Org picker, and anywhere a facility's address is shown.
- **A cache miss is a new failure mode** on a page that currently cannot fail. Rendering a bookings list can now depend on Google being reachable, and needs an answer for when it isn't.
- **`place_id` is not perfectly stable.** Google documents that IDs can change and expects clients to refresh them; the refresh path has to cope with an ID that no longer resolves.
- **Hand-named Orgs are a second class of Org, permanently.** Cross-User identity simply does not apply to them, and any feature built on `place_id` has to degrade gracefully for "Bob's backyard court".
- **Users cannot rename a place-backed Org.** That is the point — a per-owner nickname was considered and rejected as the divergence problem wearing a hat — but it means someone whose club is listed under a name they dislike is stuck with it.

**Status**: accepted for v1, superseding the free-text Org sketched in Phase 4 of the original implementation plan.
