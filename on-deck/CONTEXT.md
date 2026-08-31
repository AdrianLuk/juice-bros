# On Deck

A live-event court rotation app for pickleball socials, living under the Juice Bros platform. Replaces the physical paddle stack and the volunteers holding the whole board in their heads: it decides who plays next as courts free up, keeping court time fair and varying who people play with. Built club-generic; TO Pickleball Club (Saturday socials, ~50-60 players, ~8 courts) is the first tenant.

Distinct from [Booking Buddy](../booking-buddy/CONTEXT.md): Booking Buddy coordinates *before* an event (who's free, book a court); On Deck runs the two hours *during* one. No shared entities.

## Organizing

**Club**:
The tenant, and the owner of everything below it. Has a name, an owner, and saved session defaults (venue, court count, group cap). One Club per real-world organization.
_Avoid_: Org (means something different in Booking Buddy - a User's record of playing at a facility), Tenant, Venue.

**Session**:
One event night, belonging to a Club - a date/time, a venue name, and a court count. Started with one tap from the Club's saved defaults, or created and edited ahead of time. Everything a Player does is scoped to a single Session and does not outlive it (see [adr/0001-no-cross-week-identity.md](docs/adr/0001-no-cross-week-identity.md)).
_Avoid_: Event, Social, Night. "Social" is the club's own word for the real-world gathering and is fine in product copy; Session is the entity.

**Court**:
One playable court in a Session, numbered 1..N from the Session's court count and renameable. Either empty or holding an in-progress Game. Courts are not skill-designated or reserved.

**Organizer**:
The person who owns a Club - starts and configures Sessions, sets defaults, and holds every Volunteer ability as well. Vanessa's role.

**Volunteer**:
Someone running the floor for one Session, admitted by a Volunteer Link rather than an account. Can end Games, add walk-up Players, form Groups, swap and pause Players, adjust the live group cap, and call Last Call. Cannot change Club settings or start Sessions.

**Volunteer Link**:
A per-Session URL the Organizer shares (in practice, the club's volunteer WhatsApp group) that grants Volunteer abilities for that Session only. Requires no account and expires when the Session closes, so an old link is inert.
_Avoid_: Invite Link (means a personal friend-request link in Booking Buddy), Volunteer account.

**Club QR**:
A single stable QR code, printed once per Club and displayed on a sign at the venue, that Players scan to join. Always resolves to that Club's currently-open Session, or to a "nothing running right now" screen. Never reprinted or regenerated per Session.
_Avoid_: Check-in code (there is no check-in - see Player).

**Display**:
A read-only view of a live Session, intended for a cheap tablet or laptop on the snack table: every Court and who is on it, the Queue in order, and the On Deck foursomes. A walk-up-and-read surface, not a scoreboard read from across the park, so it can afford a dense list. Optional at every venue - a Session runs identically without one.

**Last Call**:
The Organizer's or a Volunteer's single tap ending new play for the night. After it, no further foursomes are assigned; Games in progress finish. A human judgment call, not a clock trigger, because Games have no time cap (see [adr/0002-rolling-queue-no-time-cap.md](docs/adr/0002-rolling-queue-no-time-cap.md)).

**Session Summary**:
The anonymous aggregate record kept permanently once a Session closes - attendance, Games played, court utilization, wait-time distribution, longest wait, skill mix. The Player roster is discarded at the same moment; a closed Session leaves numbers, not people.
_Avoid_: Report (the reader built on top of Summaries later; the Summary is the stored record).

## Playing

**Player**:
Someone playing in a Session, identified by a first name plus last initial and a self-declared Skill Level. Created by scanning the Club QR and doing a two-tap setup, or by a Volunteer adding a walk-up. Scoped entirely to one Session: On Deck holds no accounts, no phone numbers, and no memory of a Player between Sessions. There is no check-in and no door process - a Player exists the moment they enter themselves or a Volunteer enters them, which is not necessarily when they arrived.
_Avoid_: Attendee, Member, Guest, User (User means an account holder in Booking Buddy; On Deck has none).

**Skill Level**:
A Player's own declaration of where they play, from a fixed four: newbie, beginner, intermediate, advanced. The club's own vocabulary, not a rating system, and never computed or corrected by the app - though a Volunteer may override an obviously wrong one. Set once per Session.
_Avoid_: Rating, DUPR, Level.

**Playing Style**:
A Player's per-round declaration of casual or competitive, which sets *their own* tolerance for Skill Level spread rather than scoring on its own axis. **Competitive** means "match me close" - a strong preference for players at the same level. **Casual** means "I don't mind who I'm mixed with" - happy to share a Court with newbies well outside their own level.

Applied per Player, not per Court, because the two sides of a mixed Foursome feel it differently: an advanced Player who asked for competitive games is poorly served by a newbie on their court, while a newbie is delighted either way, and a *casual* advanced Player doesn't mind at all. Each Player's own tolerance scores their own mismatch and those scores sum, so a Court's acceptable spread emerges from who is on it rather than one Player vetoing everyone else's game.

Unlike Skill Level it can shift through the night and carries forward until changed. Still soft, like every Match Me preference: it widens or narrows what the algorithm reaches for, and never leaves a Court unfilled or a Player waiting. Deferred past v1 - see the spec's Out of Scope.
_Avoid_: Intensity, Mode (Mode means the Match Me / Queue Together choice - see Queue Mode), Skill tolerance (that is what Playing Style *sets*, not another name for it).

**Queue**:
The ordered pool of Players waiting for a Court. A Player is in exactly one state at a time: **queued** (waiting), **playing** (on a Court), or **paused** (present but not waiting). Coming off a Court re-queues a Player automatically; opting out is what puts them in paused.

**Paused**:
The single "not right now" state, reached three ways: a Player removes themselves, a Player is called and doesn't show, or a Volunteer sets them aside. Accrued Wait Time is preserved, so stepping away for a mahjong hand or a bathroom trip costs nothing but does stop them being called while gone. Re-entering the Queue is a tap on the Club QR or a word to a Volunteer.
_Avoid_: No-show, Away, Inactive (all describe one door into paused, not the state).

**Wait Time**:
How long a Player has been queued - measured from the moment they joined the Queue, or from the moment they last came off a Court, whichever is later. The primary fairness input to Match Me.

**Game**:
One instance of four Players on one Court. Ends when a Volunteer taps the Court done; there is no time cap and no score, winner, or result recorded of any kind. Its only lasting trace is that its four Players now count as having shared a Court tonight, which feeds Variety.
_Avoid_: Match, Round (there are no synchronized rounds - see ADR 0002), Rally.

**Foursome**:
The four Players selected for a Court, before or during their Game. On Deck never divides a Foursome into teams; the four sort that out on the court themselves (see [adr/0003-selects-foursomes-never-teams.md](docs/adr/0003-selects-foursomes-never-teams.md)).

**On Deck**:
The two Foursomes selected and announced ahead of any Court actually freeing, so those eight Players can gather instead of being hunted down. Recomputed continuously as Players join, pause, and come off Courts. When a Court frees, the leading On Deck Foursome walks straight onto it. Also the product's name, for exactly this reason.

**Match Me**:
The default Queue Mode, and the algorithm behind it: when a Court frees, the longest-waiting Player is always included, and the remaining three are chosen from a window of the next-longest-waiting to best fit Skill Level, Variety, and Playing Style. Every one of those preferences is soft - a Court is never left empty for want of a good fit (see [adr/0004-windowed-selection-with-wait-anchor.md](docs/adr/0004-windowed-selection-with-wait-anchor.md)).

**Queue Together**:
The other Queue Mode: a Group of Players queued as a unit. Formed by one Player on their phone picking the others, or by a Volunteer on the floor. Sized 2 to the Club's group cap (default 4, adjustable down live by a Volunteer); a Group short of four has its remaining seats filled by Match Me. Its place in the Queue is the **median** Wait Time of its members, so grouping neither costs a Player their spot nor lets a Group jump the line by recruiting someone who has waited longer. Dissolves the moment its Game ends.
_Avoid_: Party, Team (a Group is not a team - see Foursome), Squad.

**Queue Mode**:
Which of Match Me or Queue Together a Player is queued under. Chosen per round, carried forward until changed, and defaulting to Match Me - so a Player whose phone is in their bag all night keeps rotating without ever touching the app again.

**Variety**:
The preference against putting a Player with people they have already shared a Court with tonight, weighted so the most recent are the most avoided. Tracked at the Foursome level, never at the partner level, since teams are never assigned. Deliberately suppressed *within* a Group - people who chose each other are not penalised for it - but still applied to the Players filling out that Group.
_Avoid_: Repeat matchup (Vanessa's phrasing, fine informally), Rotation fairness (that's Wait Time).
