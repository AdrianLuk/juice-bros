# Windowed selection with a longest-wait anchor

When a Court frees, Match Me always includes the single longest-waiting Player, then chooses the other three from a window of roughly the next eight to ten longest-waiting, scoring Skill Level fit, Variety, and Playing Style. Window size and weights are tunable. Every preference is soft: the Court is filled even when the fit is poor, because playing beats sitting.

The anchor is the load-bearing part. It gives Players one promise simple enough to explain on a sign: **once you are at the front of the Queue, you are on the next open Court.** No starvation is possible, and nobody has to wonder why they were skipped.

## Considered options

**Strict top-four by Wait Time** is unimpeachably fair on court time but ignores every preference - it will cheerfully seat three newbies with one advanced player who all just played each other. **Global optimization** across the whole Queue produces better-fitting foursomes but can leave someone near the front repeatedly passed over for the good of the average, which is exactly the complaint the app exists to eliminate.

## Consequences

Skill matching is soft in a specific way: same level preferred, plus or minus one common, plus or minus two occasional and tolerated (a little advanced-with-newbie mingling is a feature at a social, not a failure). When several Courts free at once they are processed one at a time in the order they freed, with each Foursome removed from the Queue before the next is chosen.
