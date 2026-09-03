# Running a test night

`/on-deck/dev` fills a real Session with synthetic players and lets you drive it
from one phone, so you can shake out On Deck before handing it to friends or
releasing it. Use it against a Vercel preview or production.

Setup (Club row + `ON_DECK_DEV_KEY` + the `/on-deck/dev/enter?key=…` unlock) is
in PR #351. This doc is just the walkthrough.

## The run

Open `/on-deck/dev` (signed in as the Organizer). The card at the top shows live
counts — roster, queued, playing, on deck, paused, groups — and a court grid
(filled courts lit). Every button refreshes it and prints a one-line result.

1. **Start a session.** (Or **Reset**, if one is already open — it closes the old
   one and opens a clean one.)
2. **Players → + 8**, three or four times, until you have 25 to 30 in the queue.
3. **Simulate → Fill courts.** Seats a foursome onto every court from the queue.
   *Check:* every court lights up, "playing" jumps, "queued" drops by the same,
   two On Deck foursomes appear.
4. **Simulate → Finish a court** a handful of times. *Check:* the four coming off
   re-queue at the back, the leading On Deck foursome walks straight onto the
   freed court, a fresh one forms. Longest-waiting players get sent first.
5. **Add more players mid-run** (`+ 4`) and finish a few more courts. *Check:*
   new players slot in behind everyone already waiting; an incomplete On Deck
   foursome tops up without reshuffling.
6. **Form a group.** *Check:* it shows as one unit in the queue at the middle of
   its members' wait times, and walks on together when it reaches the front.
7. **A player short.** *Check:* a no-show is swapped out for a waiter without the
   game restarting.
8. **Set someone aside**, then **Bring someone back.** *Check:* they leave the
   rotation, then return without losing their place in line.
9. **Fix a skill level.** *Check:* the next foursome selection reflects it; a
   foursome already on deck does not reshuffle.
10. **Last call**, then **Close session.** *Check:* no new foursomes form after
    last call, games in progress still finish, and close ends the night.

## Watch it on the other screens

Put the console on one phone and open a **Jump to** link on another (or a second
tab). Changes land in about a second, no reload.

- **Floor** — the Organizer's operational screen.
- **Display** — the read-only board for a tablet on the snack table.
- **Kiosk** — courtside turnover taps (needs Floor Mode `self-serve` or
  `hybrid`).
- **Player view** — join as yourself and watch your own position move as you
  finish courts on the console.
- **Volunteer link** — the no-account floor screen (shown only when Floor Mode
  includes volunteers).
- **Club QR** — what the printed sign points at.

## Turn notifications

Only worth testing if Floor Mode is `self-serve` or `hybrid` **and** the deploy
has VAPID keys. Open **Player view** on a real phone, join, turn on the
notification, then finish courts on the console until that player's foursome
reaches On Deck or a court — the phone should buzz once.

## Before you release

- Run through the list above on a **preview** deploy first, then production.
- On production, **Reset** or **Close** your test Session when you're done so the
  Club QR shows "nothing running" and no synthetic players are on the board.
- Rotate `ON_DECK_DEV_KEY` (change the env var, redeploy) if the link has been
  anywhere it shouldn't.
