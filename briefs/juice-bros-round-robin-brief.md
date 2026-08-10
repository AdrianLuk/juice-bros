# Round Robin Generator — Implementation Brief

Enter a list of players, get a balanced doubles rotation: every round assigns
partners and opponents across the available courts, nobody partners with the same
person twice, byes are spread evenly, and it prints.

Stack: Next.js on Vercel. **No database required for v1** — everything runs
client-side and the schedule lives in the URL or `localStorage`. That's a feature:
it works on gym wifi, there's nothing to host, and there's no signup.

---

## 1. The actual problem

This is a scheduling/combinatorics problem, not a CRUD app. Get the algorithm right
and the rest is a printout.

Given `n` players and `c` courts (each court seats 4), each round plays
`min(c, floor(n/4))` games and sits out the remainder. Over `r` rounds you want to
minimise, in priority order:

1. **Partner repeats** — playing with the same person twice. Most visible, most
   complained about.
2. **Bye imbalance** — sitting out more often than others. Second most complained about.
3. **Opponent repeats** — facing the same person repeatedly.
4. **Games-played imbalance** — falls out of (2), but check it explicitly.

This is a variant of the social golfer problem. There's no clean closed-form solution
for arbitrary `n`, so use the strategy below.

---

## 2. Algorithm: lookup table first, search as fallback

### Layer 1 — precomputed schedules

For the common cases, published balanced schedules already exist and beat anything
you'll generate at runtime. Hard-code them as JSON in `lib/schedules/`.

Priority cases: `n = 8, 12, 16, 20` (perfectly divisible, no byes) and `n = 5, 6, 7,
9, 10, 11, 13` (the awkward ones clubs actually have).

The classic `n=8` doubles round robin — 7 rounds, every player partners each of the
other 7 exactly once — is the one to get in first. Format:

```json
{
  "n": 8,
  "rounds": [
    [[[0,1],[2,3]], [[4,5],[6,7]]],
    [[[0,2],[1,3]], [[4,6],[5,7]]],
    [[[0,3],[1,2]], [[4,7],[5,6]]],
    [[[0,4],[1,5]], [[2,6],[3,7]]],
    [[[0,5],[1,4]], [[2,7],[3,6]]],
    [[[0,6],[1,7]], [[2,4],[3,5]]],
    [[[0,7],[1,6]], [[2,5],[3,4]]]
  ]
}
```

Structure is `rounds[roundIndex][gameIndex] = [teamA, teamB]`, players as indices.

**Validate every table you add with the scorer below before trusting it.** Published
schedules on the internet contain errors surprisingly often.

### Layer 2 — randomised greedy with restarts

For any `n` without a table, generate. Don't reach for a solver; a few thousand
random restarts with a cost function gets you a schedule nobody complains about, in
well under a second.

```ts
type Game  = [[number, number], [number, number]]
type Round = Game[]

export function generate(n: number, courts: number, rounds: number): Round[] {
  let best: Round[] | null = null
  let bestCost = Infinity

  for (let attempt = 0; attempt < 3000; attempt++) {
    const schedule = greedySchedule(n, courts, rounds)
    const cost = scoreSchedule(schedule, n)
    if (cost < bestCost) {
      best = schedule
      bestCost = cost
      if (cost === 0) break
    }
  }
  return best!
}

function greedySchedule(n: number, courts: number, rounds: number): Round[] {
  const partnerCount = matrix(n)
  const opponentCount = matrix(n)
  const byes = new Array(n).fill(0)
  const schedule: Round[] = []

  for (let r = 0; r < rounds; r++) {
    const gamesThisRound = Math.min(courts, Math.floor(n / 4))
    const seatsNeeded = gamesThisRound * 4

    // players who've sat out most go first, ties broken randomly
    const pool = shuffle([...Array(n).keys()])
      .sort((a, b) => byes[b] - byes[a])
      .slice(0, seatsNeeded)

    for (const p of [...Array(n).keys()]) {
      if (!pool.includes(p)) byes[p]++
    }

    schedule.push(buildRound(pool, partnerCount, opponentCount))
  }
  return schedule
}
```

`buildRound` pairs the pool greedily: repeatedly take the lowest-index unassigned
player, partner them with whoever they've partnered least, then form the opposing
pair from the remaining players by the same rule.

### The cost function

This is the important part — it encodes what "fair" means, and it's what you tune
when a club says the schedule feels off.

```ts
export function scoreSchedule(schedule: Round[], n: number): number {
  const partner  = matrix(n)
  const opponent = matrix(n)
  const played   = new Array(n).fill(0)

  for (const round of schedule) {
    for (const [a, b] of round) {
      partner[a[0]][a[1]]++; partner[a[1]][a[0]]++
      partner[b[0]][b[1]]++; partner[b[1]][b[0]]++
      for (const x of a) for (const y of b) {
        opponent[x][y]++; opponent[y][x]++
      }
      for (const p of [...a, ...b]) played[p]++
    }
  }

  let cost = 0
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (partner[i][j] > 1) cost += (partner[i][j] - 1) * 100   // weight 1
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (opponent[i][j] > 2) cost += (opponent[i][j] - 2) * 5   // weight 3

  cost += (Math.max(...played) - Math.min(...played)) * 40       // weight 2
  return cost
}
```

Expose the resulting stats in the UI — a small "every player partners 7 others, sits
out once" summary under the schedule. It's what converts a sceptical organiser.

---

## 3. Options worth supporting

- **Courts available** — often fewer than `floor(n/4)`; more byes per round.
- **Number of rounds** — default to the natural length (`n-1` for `n=8`), allow override.
- **Fixed partners** — some clubs run round robins where pairs stay together and only
  opponents rotate. Different algorithm (it's a simple circle method on `n/2` teams),
  worth a toggle since it's much easier.
- **Singles mode** — 2 per court, classic circle-method round robin. Trivial compared
  to doubles; include it, it costs almost nothing.
- **Scoring** — let people enter game scores and compute standings (wins, then point
  differential). This is the feature that turns a generator into something people
  come back to.

---

## 4. Output

Three views of the same schedule, and print is not an afterthought:

1. **By round** — what the desk reads out. Round 3: Court 1 — Chen/Marsden vs Okafor/Reid.
2. **By player** — a personal card. "You're on Court 2 in rounds 1, 3, 4, 6. Sitting
   out round 5." Print these and hand them out; it eliminates most questions.
3. **Scorecards** — one per game, with blank score lines. `@media print` with page
   breaks, black on white, no orange (nobody's printing in colour at a rec centre).

Share via URL: encode `{players, courts, rounds, seed}` into a compressed query
param so the organiser can text the link and everyone sees the same schedule. Regenerate
deterministically from the seed rather than serialising the whole schedule.

---

## 5. Design direction

The subject here is a paper draw sheet, and the honest move is to lean into that
rather than fight it — but crisply, not with fake texture.

**Concept: the grid is the interface.** Rounds run down, courts run across. The whole
schedule visible at once on a laptop, one round at a time on a phone. No cards, no
shadows, no rounded corners — hairline rules and precise alignment, like a well-set
timetable.

- Type: one grotesque with a strong condensed cut for names. **Tabular figures
  everywhere**, non-negotiable — the entire design depends on columns lining up.
- Mostly black on white. Orange does exactly one job: highlighting the round in
  progress. A sitting-out player is set in a lighter grey, never in a "bye" badge.
- Signature element: a partner matrix at the bottom — an `n × n` grid, one cell
  filled per pairing, showing at a glance that the schedule is complete and balanced.
  It's the proof, and it's genuinely nice to look at.
- Motion: none. This is a document. Elegance here is spacing and alignment.

---

## 6. Build order

1. `lib/rotation/` — types, cost function, unit tests **first**. Test with the known
   `n=8` table before writing any UI.
2. Greedy generator + restarts, validated against the cost function
3. Player entry (paste a list, one name per line — nobody types 16 names into 16 fields)
4. Schedule display, by round
5. Print stylesheet + scorecards
6. Per-player cards
7. Score entry + standings
8. Shareable seeded URLs

Steps 1–2 are the product. If the algorithm is right, a plain HTML table is already
useful to a club — ship that before polishing.
