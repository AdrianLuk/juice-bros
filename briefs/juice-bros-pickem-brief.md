# Juice Bros Pick'em — Implementation Brief

A season-long prediction game for local pickleball tournaments. Players pick winners
before matches lock, earn points, and climb a leaderboard. Points only — no money.

Stack: Next.js (App Router) on Vercel, Postgres via Supabase, Drizzle ORM, Tailwind.
Matches the existing juice-bros site stack.

---

## 1. Data model

```
tournaments
  id            uuid pk
  name          text            -- "Burlington Fall Classic"
  location      text
  starts_on     date
  ends_on       date
  source_url    text            -- link back to the official listing
  status        enum('draft','open','live','final')

divisions
  id            uuid pk
  tournament_id uuid fk
  name          text            -- "Men's Doubles 4.0"
  skill_level   text            -- "4.0"
  age_bracket   text nullable   -- "50+"

teams                            -- a doubles pair or a singles player
  id            uuid pk
  division_id   uuid fk
  display_name  text            -- "Chen / Marsden"
  seed          int nullable

matches
  id            uuid pk
  division_id   uuid fk
  round         text            -- "QF", "SF", "F", "Pool A"
  team_a_id     uuid fk nullable -- null until bracket resolves
  team_b_id     uuid fk nullable
  scheduled_at  timestamptz nullable
  locks_at      timestamptz     -- picks close here
  winner_id     uuid fk nullable
  score         text nullable   -- "11-9, 8-11, 11-6"
  point_value   int default 10  -- later rounds worth more
  status        enum('pending','locked','final','void')

users
  id            uuid pk
  email         text unique
  display_name  text
  created_at    timestamptz

picks
  id            uuid pk
  user_id       uuid fk
  match_id      uuid fk
  team_id       uuid fk         -- who they picked
  confidence    int nullable    -- optional 1-3 multiplier
  created_at    timestamptz
  UNIQUE (user_id, match_id)

scores                           -- materialized, recomputed on result entry
  user_id       uuid fk
  tournament_id uuid fk
  points        int
  correct       int
  total_picks   int
  PRIMARY KEY (user_id, tournament_id)
```

Notes:
- `matches.team_a_id` nullable is important. In a bracket, the semifinal
  participants don't exist until the quarterfinals finish. The UI must handle
  "Winner of QF1 vs Winner of QF2" as a pickable slot or hide it until resolved.
  Simplest v1: only open picks for matches with both teams known.
- `point_value` lets finals be worth more than pool play without a separate table.

---

## 2. Pick locking

The single rule that keeps the game honest: **a pick is only valid if it was
created before `matches.locks_at`, evaluated server-side against the DB clock.**

- Never trust a client timestamp.
- Set `locks_at` to match start time minus 5 minutes, or if scheduling is loose
  (common at local events), lock the whole division at the tournament's daily
  start time.
- Enforce in the server action, not just the UI:

```ts
// app/actions/submit-pick.ts
'use server'

export async function submitPick(matchId: string, teamId: string) {
  const user = await requireUser()
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) })

  if (!match) throw new Error('Match not found')
  if (match.status !== 'pending') throw new Error('Picks are closed for this match')
  if (new Date() >= match.locksAt) throw new Error('Picks are closed for this match')
  if (teamId !== match.teamAId && teamId !== match.teamBId) {
    throw new Error('That team is not in this match')
  }

  await db.insert(picks)
    .values({ userId: user.id, matchId, teamId })
    .onConflictDoUpdate({
      target: [picks.userId, picks.matchId],
      set: { teamId, createdAt: new Date() },
    })

  revalidatePath(`/t/${match.tournamentSlug}`)
}
```

- Add a Postgres CHECK or a `BEFORE INSERT` trigger as a second line of defense if
  you want belt and braces.
- A cron job (Vercel Cron, every 5 min) flips `pending` → `locked` so the UI
  doesn't rely on per-request time comparisons for display.

---

## 3. Scoring

Run on result entry, not on read. Keep it a pure function so it's testable.

```ts
export function pointsForPick(pick: Pick, match: Match): number {
  if (match.status !== 'final' || !match.winnerId) return 0
  if (pick.teamId !== match.winnerId) return 0

  const base = match.pointValue
  const multiplier = pick.confidence ?? 1
  return base * multiplier
}
```

Suggested `point_value` ladder: pool play 10, R16 15, QF 20, SF 30, F 50.

**Upset bonus (optional, adds a lot of fun):** if the winning team's seed is
numerically higher than the loser's, award `+ (winnerSeed - loserSeed) * 2`. It
rewards the people who actually watch local play instead of just picking seeds.

Voided matches (walkovers, retirements, withdrawals) set `status='void'` and score
zero for everyone. Local tournaments have a lot of these — plan for it from day one.

---

## 4. Getting the data in

There is no public, self-serve API that exposes bracket and match data for
PickleballTournaments.com / PickleballBrackets.com, and their terms prohibit
automated collection. So the app should be designed around **admin ingest** —
which at your scale is genuinely the faster path anyway.

Build an ingest layer with one interface and multiple adapters:

```ts
interface TournamentSource {
  fetchTournament(ref: string): Promise<TournamentPayload>
}
```

**Adapter 1 — CSV / paste (build this one).**
An `/admin/import` page with a textarea. Paste tab-separated rows, preview the
parse, confirm, commit. Format:

```
division	round	team_a	team_b	scheduled_at	seed_a	seed_b
Men's 4.0	Pool A	Chen / Marsden	Okafor / Reid	2026-09-12T09:00	3	6
```

Most tournament directors can export exactly this from their bracket software, and
for a single local event you can type the whole thing in about fifteen minutes.
Use `papaparse` for the parsing. Validate: division exists or gets created, team
names dedupe case-insensitively, no match with the same two teams in the same round.

**Adapter 2 — results entry.**
A mobile-friendly `/admin/results` list: each locked match shows two big buttons
(team A won / team B won) plus an optional score field and a "void" option. You'll
be doing this courtside on a phone, so make the tap targets large. On submit,
recompute `scores` for that tournament in a transaction.

**Adapter 3 — API (stub it, don't build it yet).**
Leave the interface in place so that if you get a partner key from Pickleball Play
Solutions, or the event runs on Exposure Events (which has a documented,
key-authenticated API with pool and bracket endpoints), you swap in an adapter
without touching the rest of the app. Email the tournament director first — for a
non-commercial community project, most will just send you the bracket export.

---

## 5. Routes

```
/                        current tournament, your picks, standings snapshot
/t/[slug]                tournament: divisions, matches, pick UI
/t/[slug]/leaderboard    standings for this event
/season                  season-long standings across tournaments
/me                      your pick history, hit rate
/admin/import            paste ingest
/admin/results           result entry
/join/[token]            magic-link invite
```

Auth: Supabase magic link, invite-only. Gate signup behind `/join/[token]` so it
stays a friends' league and doesn't become a public gambling-adjacent product.

---

## 6. Design direction

Inherit the Juice Bros identity — orange, black, white — but the pick UI needs its
own logic, because a betting-style card grid is the templated answer here and it
reads wrong for the brand.

**Concept: the scorecard.** Lean on the paper scorecard that actually gets passed
around at local tournaments. Matches stack as horizontal rows with a hand-marked
feel: your pick gets a thick orange stroke through the team you chose, the way you'd
circle a winner with a pen. Locked matches go monochrome. Correct picks stamp
in orange after results land.

- Type: a condensed bold display face for team names and round labels (the
  vernacular of draw sheets), a clean grotesque for body. Tabular figures for all
  scores and standings — non-negotiable, misaligned numbers in a leaderboard look
  broken.
- The signature element: the leaderboard as a live draw sheet, not a table. Names
  in a column, a horizontal track per player showing each pick as a hit or miss
  across the tournament, so you can see at a glance who ran hot in the late rounds.
- Motion: one thing only — the stroke animating across a team name when you commit
  a pick. Respect `prefers-reduced-motion`.
- Mobile first, genuinely. Everyone will use this standing beside a court.

Empty states matter here: before a tournament opens, `/` should say what's coming
and when picks open, not "No data."

---

## 7. Build order

1. Schema + migrations, seed with one fake tournament
2. Auth + invite tokens
3. CSV import (admin)
4. Pick UI + server-side lock enforcement
5. Results entry + scoring recompute
6. Leaderboard
7. Season aggregation
8. Polish: pick history, hit rate, share cards for socials

Ship 1–6 before adding anything else. The share cards in step 8 are what make it
spread on the podcast, but they're worthless without a working game underneath.
