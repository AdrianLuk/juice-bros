# Context Map

## Contexts

- [Podcast Site](./CONTEXT.md) — Juice Bros' marketing/podcast hub (Home, Podcast, Gear, About, Contact); glossary covers the Podcast/Episode domain and the Instagram feed
- [Booking Buddy](./booking-buddy/CONTEXT.md) — friend-group pickleball scheduling app (Apps section)
- [On Deck](./on-deck/CONTEXT.md) — live court-rotation app for club pickleball socials (Apps section)
- [Match Mixer](./match-mixer/CONTEXT.md) — client-side pickleball round robin generator at `/tools/match-mixer` (Apps section)
- [Team Tally](./team-tally/CONTEXT.md) — scoring for captained team events at `/tools/team-tally`: captains report, the night seeds itself into Flights (Apps section)

The five contexts are independent — no shared domain concepts or data relationship, just the same Next.js app shell.

The pickleball apps deliberately do not share a model, because they sit at different points in the same evening. Booking Buddy coordinates *before* an event, between friends who know each other (Connections, availability, booking a court). On Deck runs the two hours *during* one club event, among ~60 mostly-strangers with no accounts. Match Mixer sits outside both and knows about neither: it turns a pasted list of names into a printed rotation and then forgets it — no accounts, no storage beyond the browser, no relationship to a Club or a Booking. Team Tally is a different kind of night altogether: captained teams of four playing scored Matchups and then Flights. It shares only the site's sign-in, and owns no Club; an Organizer owns each Team Event directly.

Several words collide across the contexts. Check the right glossary before reusing a term:

- **Player** — a name on a past Booking in Booking Buddy; a live participant in the Queue in On Deck; one line of the Roster in Match Mixer.
- **Court** — a physical, named court belonging to a Club in On Deck; a column count with no venue or identity in Match Mixer.
- **Game** — a foursome playing until they report done in On Deck; two Sides on one court within one Round in Match Mixer, which is four Players in doubles and two in singles; one scored game to 11 in Team Tally, the only context where a Game has a score.
- **Round** — a synchronized set of Games across the courts in Match Mixer; a captains' game and a teammates' game played together inside one Matchup in Team Tally. On Deck has no Rounds.
- **Organizer** — the account that runs a Club's Sessions in On Deck; the account that owns a Team Event in Team Tally. Separate models, even when one person is both.
- **Session** — one night at a club in On Deck. Match Mixer avoids the word entirely and calls its equivalent a **Mixer**; Team Tally calls its night a **Team Event**.
- **User**, **Org**, **Connection** and **Invite Link** are Booking Buddy's alone, and are explicitly avoided in On Deck and Match Mixer.

Pickle Point Pal (`/tools/pickle-point-pal`) is deliberately not a context: its vocabulary is standard pickleball rules language that needs no disambiguation, and its build notes live beside the code in `src/components/apps/pickle-point-pal/BRIEF.md`. It does own **Match** as a scored contest between two sides, which is why Match Mixer's unit is a **Game** and Team Tally's is a **Matchup**.
