# On Deck

A live-event court rotation app for pickleball socials, living under the Juice Bros platform. Replaces the physical paddle stack and the volunteers holding the whole board in their heads: it decides who plays next as courts free up, keeping court time fair and varying who people play with. Built club-generic. TO Pickleball Club (Saturday socials, ~50-60 players, ~8 courts) is the club it was designed against, and it has since ended without ever running a night on this; organizers now sign their own club up (#515), so the first real tenant will be somebody we have never met.

Distinct from [Booking Buddy](../booking-buddy/CONTEXT.md): Booking Buddy coordinates *before* an event (who's free, book a court); On Deck runs the two hours *during* one. No shared entities.

## Architecture

A live Session's entire state is a **fold over an append-only event log**:
`reduceSession(config, events) → SessionState`, one pure function, mirroring
Pickle Point Pal's `reduceMatch`. Queue order, wait times, court occupancy, On
Deck foursomes, and Session Summary counters all derive from it. The fold never
reads the wall clock (events carry their own `at`), selection tie-breaks derive
from a seed in the config (never `Math.random()`), and **undo is dropping the
last event** and re-folding. The fold, its types, and its selectors use
relative imports only — `node --test` cannot resolve the `@/` alias.

Three tables back it: `on_deck_clubs` (the tenant, created by its own Organizer through `on_deck_create_club`; the table carries no INSERT grant outside `service_role`),
`on_deck_sessions` (one open per Club at a time, enforced), and
`on_deck_session_events`. Access follows Booking Buddy's hybrid RLS posture
(its ADR 0003) with one On Deck twist: an *open* Session and its log are
readable with no account, because everyone at the venue reads the same board
(see [adr/0006-open-session-is-public-to-the-venue.md](docs/adr/0006-open-session-is-public-to-the-venue.md)).

## Organizing

**Club**:
The tenant, and the owner of everything below it. Has a name, an owner, saved session defaults (venue, court count, group cap, Floor Mode), and a **clock** - the IANA time zone its nights are dated on. One Club per real-world organization, and one per account.

An Organizer creates their own, in two fields: the club's name and how many courts. The venue starts as the club's name and everything else takes the schema's default, because somebody who has not run a night yet has nothing to base a group cap on. Settings reaches all of it afterwards, which is what makes asking so little safe. Creation goes through a `security definer` RPC rather than a table grant, so the table stays unwritable by any role but `service_role`; one per account is the RPC's own check as well as a unique index.

The clock exists only because a Session Summary has to name a day, and an instant has no date until you say whose clock; nothing during a live Session needs it. It is never asked for: the app adopts the Organizer's own browser zone on their first visit, and Settings can correct a wrong guess. A Session snapshots it at creation the way it snapshots venue and court count, so changing it dates future nights and never re-dates past ones.
_Avoid_: Org (means something different in Booking Buddy - a User's record of playing at a facility), Tenant, Venue.

**Floor Mode**:
A Club setting for who may fire a Session's operational events - ending a Game, swapping a no-show, adding a walk-up. Two independent switches, **Volunteer Links** and the interactive **Kiosk**, expressed as three presets: **volunteer-run** (links only; Players never touch operations), **self-serve** (Kiosk only; no volunteer needed at all), and **hybrid** (both - volunteers drive the night, and anyone courtside can still tap a Game done when a volunteer misses a Court). The Organizer keeps override from their own phone and Undo covers mistaps in every mode. Defaults to hybrid. See [adr/0005-app-never-requires-a-volunteer.md](docs/adr/0005-app-never-requires-a-volunteer.md).
_Avoid_: Staffing mode, Manual/auto (nothing here is automatic - a human always taps).

**Operator**:
Whoever fired an operational event - an Organizer, a Volunteer, or, where Floor Mode allows it, a Player at the Kiosk. Every event in the log records which. Less a role a person holds than a label on an action.
_Avoid_: Admin, Staff, Ref.

**Session**:
One event night, belonging to a Club - a date/time, a venue name, and a court count. Started with one tap from the Club's saved defaults, or created and edited ahead of time. Everything a Player does is scoped to a single Session and does not outlive it (see [adr/0001-no-cross-week-identity.md](docs/adr/0001-no-cross-week-identity.md)).
_Avoid_: Event, Social, Night - as *entity* names. "Social" and "night" are both the club's own words for the real-world gathering and are fine in product copy ("Past nights", "what this night left behind"); Session is the entity, and every identifier in the code says Session.

**Court**:
One playable court in a Session, numbered 1..N from the Session's court count and renameable. Either empty or holding an in-progress Game. Courts are not skill-designated or reserved.

**Organizer**:
The person who owns a Club - starts and configures Sessions, sets defaults, and holds every Volunteer ability as well. Vanessa's role.

**Volunteer**:
Someone running the floor for one Session, admitted by a Volunteer Link rather than an account - one kind of Operator. Can end Games, add walk-up Players, form Groups, swap and pause Players, adjust the live group cap, and call Last Call. Cannot change Club settings or start Sessions.

**Volunteer Link**:
A per-Session URL the Organizer shares (in practice, the club's volunteer WhatsApp group) that grants Volunteer abilities for that Session only. Issued only when Floor Mode includes volunteers (volunteer-run or hybrid). Requires no account and expires when the Session closes, so an old link is inert.
_Avoid_: Invite Link (means a personal friend-request link in Booking Buddy), Volunteer account.

**Club QR**:
A single stable QR code that Players scan to join, resolving always to that Club's currently-open Session, or to a "nothing running right now" screen, and never reprinted or regenerated per Session. Two ways an Organizer puts it in front of a room, neither more canonical than the other: printed once on a sign for the venue (`/on-deck/home/qr`, Organizer-gated, prints on Letter or A4), or held up full screen from the Organizer's own phone (`/on-deck/home/qr/hold-up`, issue #517) for a night without one. The join link behind the code can also just be pasted into the club's group chat, with a pre-written message the hold-up view copies alongside it. The bare code is also served as a file at `/on-deck/c/<clubId>/qr.svg` and `qr.png`, which are open, like the link they encode.

The link is `/on-deck/c/<clubId>` with the Club's raw uuid, and it stays that way deliberately rather than becoming a readable slug. Two reasons, both downstream of "printed once". A slug derived from the Club's name breaks the moment a club renames itself, and every sign already on a wall breaks with it - a uuid has no such failure. And an unguessable id is quietly the thing that scopes ADR 0006's "public to the venue" to the venue: an open Session is world-readable by design, so a guessable Club link would let anyone anywhere add themselves to tonight's Queue without being in the building. The costs are real but small - a typed-fallback URL nobody can type, and one extra QR version (37x37 modules rather than 33x33, so about 11% smaller modules at the same printed size). If the typed line ever matters more than these, the answer is a short random code, not a name: it keeps both properties and only costs a column.
_Avoid_: Check-in code (there is no check-in - see Player).

**Display**:
A read-only view of a live Session, intended for a cheap tablet or laptop on the snack table: every Court and who is on it, the Queue in order, and the On Deck foursomes. A walk-up-and-read surface, not a scoreboard read from across the park, so it can afford a dense list. Optional at every venue - a Session runs identically without one. Its interactive counterpart, for a screen stood by the courts, is the Kiosk.

**Kiosk**:
The Display plus the buttons a Game turnover needs - **Game done**, **a player short** (pulls a replacement into the Foursome), **add me** (a walk-up with no phone) - for a tablet stood near the courts. Enabled by Floor Mode (self-serve or hybrid); the taps it accepts are Operator actions, logged as coming from a Kiosk. A Session can carry a read-only Display, a Kiosk, both, or neither.
_Avoid_: Terminal, Station.

**Demo night**:
A whole Session, authored rather than recorded, that folds in the visitor's own browser at `/on-deck/demo` (issue #519, widened to all three screens by #522). An organizer who has never heard of On Deck arrives mid-night with every Court in play and a Queue twelve deep, taps a Court done, and watches the next foursome walk on. No account, no Club, no row written, and nothing in the route's import graph that could reach the database - the taps go through the same `floor-ops` decisions and the same `reduceSession` fold a real Saturday uses, with an event array in React state where Postgres would be. It renders the real screens, not replicas: `floor-board.tsx`, `display-board.tsx` and `kiosk-board.tsx` are the Floor, the Display and the Kiosk, and none of them knows where its board came from, which is what makes anything the demo gets wrong a bug in that screen rather than in the demo.
`demo-stage.tsx` owns the one event log the three screens share, so switching between them loses no state, plus a "let it run" control that fires a Game done on its own every few seconds until stopped, and a reset back to the opening state. A tap on the demo's Floor is an `organizer` Operator, a tap on its Kiosk a `kiosk` one - same as the real screens - so Undo attributes it correctly on whichever screen is showing.
The log is authored because there is no real one and will not be until a stranger runs a night. Its players come from the synthetic generator the dev console uses, whose fixed "B." last initial is the tell on the board, and every foursome in it was picked by Match Me through the fold rather than written down by hand - `demo/night.test.ts` is what holds that claim up.
_Avoid_: Sandbox, Playground, Sample data.

**Last Call**:
An Operator's single tap ending new play for the night - the Organizer or a Volunteer, never a Kiosk button (it is a judgment about the night, not a Court turnover). After it, no further foursomes are assigned; Games in progress finish. A human judgment call, not a clock trigger, because Games have no time cap (see [adr/0002-rolling-queue-no-time-cap.md](docs/adr/0002-rolling-queue-no-time-cap.md)). In a self-serve Session with no Volunteers, it is the Organizer's alone.

**Undo**:
One tap on the floor screen that drops the most recent event and re-folds every surface to the exact prior state - dropping the last event, never a compensating action. Any Operator who can fire an operational event can undo one: the Organizer from their account, a Volunteer from the link. Bounded on purpose - only the single latest event, only an operational turnover type (not a Session start or a Player's own join / queue), only within a short window (15 min), and only when no other Operator has acted since (else it warns rather than roll their action back). A mistap this game or last is fixable; the night an hour deep is not.
_Avoid_: Rollback, Revert (both suggest more than one step), Delete.

**Session Summary**:
The anonymous aggregate record kept permanently once a Session closes - attendance, Games played, court utilization, wait-time distribution, longest wait, skill mix. The Player roster is discarded at the same moment; a closed Session leaves numbers, not people.
The reader on top of it is the Organizer's **past nights** list and one Session's own page, under `/on-deck/home/summaries`. Organizer-only: a Summary carries no personal data but is still the Club's own operational history, not world-readable the way an open Session is.
A Session whose log has gone quiet for `on_deck_stale_after()` closes itself and produces this exactly like a deliberate close - the only difference is `auto_closed`, which the reader surfaces as "closed automatically" so a forgotten night reads as closed *for* the Organizer rather than *by* them. Checked lazily (there is no scheduler in this project) the next time the Organizer's own home screen or Start tap looks at their Club's open Session; never on a Session a Player alone has touched, since only the owning Organizer can trigger it.
_Avoid_: Report (as the name of the record - the Summary is the stored record, and the pages above are "the reader"). "Report" is fine inside the reader's own component names.

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
One instance of four Players on one Court. Ends when an Operator taps the Court done - a Volunteer, the Organizer, or a Player at the Kiosk, depending on Floor Mode; there is no time cap and no score, winner, or result recorded of any kind. Its only lasting trace is that its four Players now count as having shared a Court tonight, which feeds Variety.
_Avoid_: Match, Round (there are no synchronized rounds - see ADR 0002), Rally.

**Foursome**:
The four Players selected for a Court, before or during their Game. On Deck never divides a Foursome into teams; the four sort that out on the court themselves (see [adr/0003-selects-foursomes-never-teams.md](docs/adr/0003-selects-foursomes-never-teams.md)).

**On Deck**:
The two Foursomes selected and announced ahead of any Court actually freeing, so those eight Players can gather instead of being hunted down. Each Foursome is **committed** at the moment it is selected and carried forward in the fold's accumulator - a Player joining, pausing, or being added never reshuffles a Foursome already announced. An *incomplete* Foursome (the Queue was thin when it formed) tops up as Players join, its existing members untouched; a complete one only changes by walking onto a Court. When a Court frees, the leading On Deck Foursome walks straight onto it and a fresh one is selected (via Match Me) to refill the second slot. Also the product's name, for exactly this reason.

Commitment begins when the night does, from the moment the first Foursome walks onto a Court. Before that the cards are re-formed from the whole Queue as the room fills, because no Court can free while every Court is empty, so there is nothing for a named Foursome to gather ahead of - and carrying one committed when four people had arrived is what made the opening Games of a night arrival order rather than Match Me's picks (issue #533, and the amendment to [adr/0007](docs/adr/0007-on-deck-foursomes-are-committed.md)). The anchor holds in both windows, so nobody can be displaced from the front of the line.

A Player may opt in to a single push notification for their own moment - "you're up, Court 5" - when they enter On Deck or are assigned a Court. Not before the night has started, though: "head to the courts" is wrong advice while every Court is still empty. Off by default and never a broadcast; it exists because a self-serve Session has no volunteer calling names, and it is the one notification worth a Player's phone buzzing in a bag. The Display and Kiosk remain the primary surface; the push is a courtesy on top.

**Match Me**:
The default Queue Mode, and the algorithm behind it: when a Court frees, the longest-waiting Player is always included, and the remaining three are chosen from a window of the next-longest-waiting to best fit Skill Level, Variety, and Playing Style. Every one of those preferences is soft - a Court is never left empty for want of a good fit (see [adr/0004-windowed-selection-with-wait-anchor.md](docs/adr/0004-windowed-selection-with-wait-anchor.md)).

**Queue Together**:
The other Queue Mode: a Group of Players queued as a unit. Formed by one Player on their phone picking the others, or by a Volunteer on the floor. Sized 2 to the Club's group cap (default 4, adjustable down live by a Volunteer); a Group short of four has its remaining seats filled by Match Me. Its place in the Queue is the **median** Wait Time of its members, so grouping neither costs a Player their spot nor lets a Group jump the line by recruiting someone who has waited longer. A player-formed Group takes no confirm-prompt on the picked members' phones (they're in their bags); instead any member can remove *themselves* from their own screen (staying in the Queue as a solo), and a Volunteer can dissolve a whole waiting Group. Dissolves the moment its Game ends either way.
_Avoid_: Party, Team (a Group is not a team - see Foursome), Squad.

**Queue Mode**:
Which of Match Me or Queue Together a Player is queued under. Chosen per round, carried forward until changed, and defaulting to Match Me - so a Player whose phone is in their bag all night keeps rotating without ever touching the app again.

**Variety**:
The preference against putting a Player with people they have already shared a Court with tonight, weighted so the most recent are the most avoided. Tracked at the Foursome level, never at the partner level, since teams are never assigned. Deliberately suppressed *within* a Group - people who chose each other are not penalised for it - but still applied to the Players filling out that Group.
_Avoid_: Repeat matchup (Vanessa's phrasing, fine informally), Rotation fairness (that's Wait Time).
