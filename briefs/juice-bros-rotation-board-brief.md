# Open Play Rotation Board — Implementation Brief

A kiosk web app that runs the queue at club open play. Players check in, the board
shows who's up next, and the desk taps a button when a game ends. Replaces the
paddle stack and the whiteboard.

Stack: Next.js (App Router) on Vercel, Supabase Postgres + Realtime, Drizzle, Tailwind.

**The core constraint that shapes everything: this runs on a tablet propped against
a fence, on rec-centre wifi, operated by whoever showed up. No logins, no typing
mid-session, no scrolling to find a button.**

---

## 1. The two surfaces

This is one app in two modes, sharing state over Supabase Realtime.

**Display** (`/session/[code]/display`) — a TV or tablet everyone can see. Read-only.
Shows current games per court, the up-next group, and the waiting queue. Large type,
readable at 15 feet. Never needs interaction.

**Control** (`/session/[code]`) — a phone or the desk tablet. Check players in,
end games, adjust the queue. Every action is a single tap.

Build Display first. It's the thing that makes people ask "what's that?"

---

## 2. Data model

```
sessions
  id            uuid pk
  code          text unique      -- 4-char join code, e.g. "JUCY"
  club_name     text
  court_count   int
  mode          enum('fifo','winners_stay','balanced')
  started_at    timestamptz
  ended_at      timestamptz nullable

players
  id            uuid pk
  session_id    uuid fk
  name          text             -- first name + last initial is enough
  skill         numeric nullable -- 3.0-5.0, optional
  status        enum('waiting','playing','resting','left')
  checked_in_at timestamptz
  games_played  int default 0
  last_game_at  timestamptz nullable

courts
  id            uuid pk
  session_id    uuid fk
  label         text             -- "1", "2", "Back court"
  status        enum('open','in_play','closed')

games
  id            uuid pk
  session_id    uuid fk
  court_id      uuid fk
  started_at    timestamptz
  ended_at      timestamptz nullable
  team_a        uuid[]           -- 1 or 2 player ids
  team_b        uuid[]
  winner        enum('a','b','none') nullable

queue_entries
  id            uuid pk
  session_id    uuid fk
  player_id     uuid fk
  position      int
  enqueued_at   timestamptz
```

`games_played` and `last_game_at` are denormalized onto `players` on purpose —
the queue sort runs constantly and you don't want to aggregate on every read.

---

## 3. Rotation logic

Put this in `lib/rotation.ts` as pure functions over plain objects. No DB calls, no
React. It's the part worth unit testing, and it's the part people will argue about
courtside, so it needs to be easy to reason about and easy to change.

### Mode: `fifo` (build this first)

Straight queue. When a court opens, take the four players at the front.

```ts
export function nextGroup(queue: Player[], size = 4): Player[] {
  return queue.slice(0, size)
}
```

The queue is sorted by `position`. Players who finish a game go to the back.
This is what most clubs already do and it's the least contentious.

### Mode: `winners_stay`

Winning pair keeps the court, losing pair goes to the back, two come off the queue.
Add a `max_consecutive` cap (default 3) or one strong pair holds a court all night
and everyone hates the board.

```ts
export function afterGame(game: Game, players: PlayerMap, mode: Mode) {
  if (mode !== 'winners_stay' || !game.winner || game.winner === 'none') {
    return { staying: [], returning: [...game.teamA, ...game.teamB] }
  }
  const winners = game.winner === 'a' ? game.teamA : game.teamB
  const losers   = game.winner === 'a' ? game.teamB : game.teamA
  const streak = winners.map(id => players[id].streak ?? 0)

  if (Math.max(...streak) >= MAX_CONSECUTIVE) {
    return { staying: [], returning: [...winners, ...losers] }
  }
  return { staying: winners, returning: losers }
}
```

### Mode: `balanced`

Sort the waiting pool by fewest `games_played`, then by longest wait, then pick four
whose skill values cluster. Pair the highest with the lowest to even the teams.

```ts
export function balancedGroup(waiting: Player[]): Player[] | null {
  if (waiting.length < 4) return null

  const pool = [...waiting].sort((a, b) =>
    a.gamesPlayed - b.gamesPlayed ||
    (a.lastGameAt?.getTime() ?? 0) - (b.lastGameAt?.getTime() ?? 0)
  )

  // take the 8 most-owed players, choose the 4 with tightest skill spread
  const candidates = pool.slice(0, 8)
  const best = combinations(candidates, 4)
    .sort((x, y) => spread(x) - spread(y))[0]

  return best ?? pool.slice(0, 4)
}

const spread = (g: Player[]) => {
  const s = g.map(p => p.skill ?? 3.5)
  return Math.max(...s) - Math.min(...s)
}

export function makeTeams(group: Player[]): [Player[], Player[]] {
  const s = [...group].sort((a, b) => (b.skill ?? 3.5) - (a.skill ?? 3.5))
  return [[s[0], s[3]], [s[1], s[2]]]   // strongest with weakest
}
```

**Fairness is the whole product.** Surface it: show each player's games played and
wait time on the display. Once people can see the queue is even, the arguments stop.
That transparency is the actual selling point to a club, not the automation.

---

## 4. Realtime

Supabase Realtime on the `games`, `queue_entries`, and `players` tables. Display
subscribes, Control writes. Two notes:

- Rec-centre wifi drops. Keep a local optimistic copy in the client and reconcile on
  reconnect; show a small "reconnecting" indicator rather than freezing or clearing
  the board.
- Debounce writes. Someone will tap "game over" three times.

---

## 5. Check-in

Two paths, both need to work:

1. **Kiosk tap** — a grid of large name tiles for anyone who's played here before
   (stored per club in `localStorage` or a `club_players` table). Tap your name,
   you're in the queue.
2. **QR to phone** — the display shows a QR to `/session/[code]/join`. Player types
   their name once on their own phone. Best for busy nights.

No accounts. A name is enough. Adding auth to this kills adoption.

---

## 6. Design direction

Inherit Juice Bros orange/black/white, but this is a utility running in a gym — it
needs to read as equipment, not as marketing.

**Concept: the departures board.** Model it on an airport flight board, because that
is exactly the information shape: things in progress, things about to happen, an
ordered queue behind them. Courts are rows. Status is the loudest thing on screen.

- Type: one condensed grotesque at three sizes only. Names huge, labels small,
  nothing in between. Tabular figures for wait times.
- Black background. Orange reserved for one job only — "you're up next." If orange
  appears anywhere else it stops meaning anything.
- The signature element: the up-next row. When a group is called, their names flip
  into place with a mechanical stagger, the way a split-flap board does. One second,
  once per game. That's the moment people look up for.
- Everything else static. No hover states on the display; nobody's holding a mouse.
- Respect `prefers-reduced-motion` — swap the flip for a crossfade.

Control surface is the opposite: plain, dense, boring, thumb-sized targets, no
animation. It's a remote control.

---

## 7. Build order

1. Schema + session creation with join code
2. Display surface, static, seeded data
3. Check-in (kiosk grid)
4. FIFO queue + "court open / game over" on Control
5. Realtime wiring between the two
6. Winners-stay and balanced modes behind a session setting
7. Session summary at the end of the night (games played per person)

Ship 1–5 and take it to a real club night before building 6. The mode people
actually want will be obvious after one evening, and it may not be the one you'd
have guessed.

---

## 8. Notes for later

- Multi-court clubs will ask for court-level skill tiers ("courts 1–2 are 4.0+").
  Model it as an optional `tier` on `courts` and filter the eligible pool.
- A session summary that's screenshot-friendly is free marketing.
- If a club asks to keep player history across nights, that's the moment this
  becomes a paid product — not before.
