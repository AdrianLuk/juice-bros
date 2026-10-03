---
Status: accepted
---

# A Standing Game invite's Yes / No / Maybe links need no session

When a Standing Game posts its weekly Slot, each Regular gets an email with Yes / No / Maybe links that record their Response without signing in. Booking Buddy exists to replace the group-chat "who's in Tuesday?" poll, and that poll is one tap; a "View the game" button that lands on a sign-in screen loses to it every week. This is the second session-less action in the app, after the Connection Request Email ([0017](0017-connection-request-email-is-session-less.md)), and it follows the same shape: the page renders on GET and acts only on a POST, so a mail prefetcher or link scanner can't answer on someone's behalf.

The token is scoped to one Regular and one Slot, and the only thing it can do is set that Regular's Response to that Slot. It stays usable until the Slot starts (an answer is meant to be changeable, unlike 0017's single-use accept), so it is not burned on first use. The accepted cost is that anyone holding a forwarded invite can change that one Response for that one game. That is a smaller power than 0017 hands out (which can create a Connection), and a wrong Response is visible to the organizer and corrected by the Regular in one tap.

The link also opens that one Slot to its Regular regardless of Visibility, the same promise a Slot Link makes: an organizer who has lowered their default below Slot level can still add a friend as a Regular, and that friend sees this game and nothing else of the organizer's. The alternative, only offering Connections who can already see the organizer's Slots, left an organizer with a hidden calendar unable to use Regulars at all.

## Considered Options

- **A "View the game" button behind sign-in.** Safest, and the drop-off point we are trying to remove.
- **A link that answers on GET.** One tap fewer, but mail scanners follow links, so Regulars would find themselves marked "yes" to games they never opened.
