# Rolling queue, no time cap

Courts turn over independently and continuously: each Game runs until its players finish, a Volunteer taps the Court done, those four re-queue, and the leading On Deck Foursome walks on. There is no horn, no synchronized round, and no clock forcing a Game to end. This is what "games rotate naturally" already means at TO Pickleball Club, and imposing a cap would change the character of the social to make the software's job easier.

## Considered options

**Synchronized rounds** - all courts clear together every 12-15 minutes - are far easier to model. Wait times are predictable, "who played whom in round 3" is trivially tracked, and the selection algorithm runs once per round instead of eight times unpredictably. It was rejected because it requires a disruptive all-stop, cuts good games short, and is not how the club plays.

**Winners-stay / king of the court** was rejected as actively hostile to the goals: it concentrates court time on whoever is winning, which is the opposite of fair rotation and variety at an all-levels social.

## Consequences

The app carries tracking complexity the volunteers currently carry in their heads, which is the point of it existing. Two things follow that would otherwise look like over-engineering: **On Deck** exists (foursomes are announced before a Court frees, because you cannot predict *which* Court frees next and people wander off), and **Last Call** is a human tap rather than a clock trigger (with no cap, the app cannot know whether a Game starting now finishes before the permit ends - the Organizer can).
