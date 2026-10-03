---
Status: accepted
---

# A recurring game is a Standing Game that posts plain Slots, not a Slot with a rule

"Tuesday 8pm, every week" is modelled as a Standing Game: an organizer-only template that posts one ordinary Slot per week ahead of time (a week out, or earlier when its Intended Org's Booking Window opens sooner). Recurrence lives on the Standing Game alone. Every Slot it posts is a plain Slot, so Responses, Capacity, Reminders, Booking Reminders, Slot Links, Bookings, the friend calendar and Find a time keep reading Slots exactly as they did, with no idea a Slot came from a Standing Game.

## Considered Options

- **A recurrence rule on the Slot** (`slots.recurrence_rule`, one row standing for many weeks). No new concept, but every Slot query, RLS policy and planner would have to expand a row into its weeks, and Responses would need a week key to say which Tuesday they answer. The Slot is the unit everything in Booking Buddy hangs off, and this would fork it.
- **Posting every future week up front.** Removes the cron, but fills friends' calendars with months of Slots and makes every edit to the Standing Game a bulk rewrite of Slots people may have answered.

## Consequences

- A posted Slot's date, time and division are fixed like any Slot's, so editing a Standing Game only shapes weeks it has not posted yet.
- The one place a posted Slot behaves differently is deletion: it is skipped ("Skip this week", which tells its yes and maybe answerers) rather than silently deleted, and the skipped date is recorded on the Standing Game so the next cron run does not post it again.
- Posting depends on the daily cron (Vercel Hobby). Posting a week or more ahead makes a once-a-day run more than enough.
