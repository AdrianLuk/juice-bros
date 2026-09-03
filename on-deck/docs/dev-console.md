# The On Deck dev console

`/on-deck/dev` fills a real Session with synthetic players and drives it, so the
crowd-dependent surfaces (Match Me, On Deck foursomes, Variety, Queue Together,
the idle-court nudge, turn notifications) can be hand-tested from one phone
instead of rounding up sixteen people. It runs against whatever database the
deploy is pointed at — local, a Vercel preview, or production.

It is not a real surface. The players it makes carry bird names and a `· B.`
last initial so they stand out on the floor screen or Display if a test Session
is ever left open. Every action it fires is a genuine event on the real log —
`Close` writes a permanent Session Summary and purges the roster (ADR 0001),
same as a real night.

## One-time setup per environment

### 1. A Club owned by your account

On Deck has no self-serve club creation and RLS gives even the owner no INSERT
on `on_deck_clubs`, so the first Club is made by hand with the service role.

- **Local:** `npm run seed:on-deck` (creates the Organizer account
  `on-deck-organizer@example.com` / `pickleball123` and the "TO Pickleball
  Club"). Re-runs are idempotent; it wipes and re-seeds after `supabase db
  reset`.
- **Preview / production:** sign in once at `/on-deck/sign-in` (so `auth.users`
  has your row), then run this in the Supabase SQL editor for that project:

  ```sql
  insert into public.on_deck_clubs
    (owner_id, name, venue_name, court_count, group_cap, floor_mode)
  values (
    (select id from auth.users where email = 'YOUR_ON_DECK_SIGN_IN_EMAIL'),
    'Juice Bros Test',
    'Test Venue',
    8,          -- court_count
    4,          -- group_cap
    'hybrid'    -- 'hybrid' | 'self-serve' | 'volunteer-run'
  );
  ```

  One Club per owner (a partial unique index). To start over, `delete from
  public.on_deck_clubs where owner_id = (select id from auth.users where email =
  '…')` first. Floor Mode and group cap set here are the ceiling every Session
  starts from — change them later in `/on-deck/home/settings` or in SQL.

### 2. The dev key

`ON_DECK_DEV_KEY` gates the route. Unset (the default), `/on-deck/dev` 404s for
everyone.

- **Local:** add `ON_DECK_DEV_KEY=<any string>` to `.env.local`, restart `npm
  run dev`.
- **Preview / production:** Vercel project → Settings → Environment Variables →
  add `ON_DECK_DEV_KEY` for the target environments, value a long random string.
  Redeploy.

### 3. Unlock it on your phone

Open once:

```
https://<deploy-host>/on-deck/dev/enter?key=<the value from step 2>
```

That checks the key, sets an httpOnly cookie scoped to `/on-deck`, and redirects
to `/on-deck/dev`. Every later visit rides the cookie, so the key is only ever in
a URL on that first hop. Sign in as the Organizer if prompted.

To rotate the key: change the env var and redeploy. Existing cookies stop
matching; re-run the `enter` link on each device.

## Driving a test night

A fresh Session starts with empty courts. The usual sequence:

1. **Start a session** (or **Reset** if one is already open — it closes the old
   one and opens a clean one).
2. **Players → + 8** a couple of times. They land in the queue.
3. **Simulate → Fill courts.** Seats foursomes onto every empty court from the
   queue — this is the "Send next four" tap a real night does at the start,
   looped. **Send next four** does just the one court.
4. From here, **Finish a court** (random occupied one) or **Finish all courts**
   to turn games over and watch the rotation, On Deck foursomes, and Wait Times
   move.
5. **Form a group**, **A player short** (no-show swap), **Fix a skill level**,
   **Set someone aside** / **Bring someone back** each fire the matching
   operational event against random valid targets.
6. **Last call** then **Close session** to exercise the wrap-up and the Session
   Summary.

The card at the top shows live counts (roster / queued / playing / on deck /
paused / groups) and a court grid (filled courts lit). Every action refreshes it
and prints a one-line result.

## Seeing the other surfaces

**Jump to** links open the real surfaces for the running Session, so you can put
the dev console on one phone and watch a surface on another (or in another tab):

| Link | Route | Notes |
| --- | --- | --- |
| Floor | `/on-deck/session/<id>/floor` | the Organizer's operational screen |
| Display | `/on-deck/session/<id>/display` | read-only board, no controls |
| Kiosk | `/on-deck/session/<id>/kiosk` | courtside turnover taps; needs Floor Mode `self-serve` or `hybrid` |
| Player view | `/on-deck/session/<id>` | join as yourself, see your own position |
| Volunteer link | `/on-deck/session/<id>/volunteer/<token>` | shown only when Floor Mode includes volunteers |
| Club QR | `/on-deck/c/<clubId>` | what the printed sign points at |

Realtime is live, so a `Finish a court` on the dev console lands on an open Floor
or Display within about a second, no reload.

## Testing turn notifications

The opt-in push ("you're up, Court 5") needs Floor Mode `self-serve` or `hybrid`
**and** VAPID keys on the deploy (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — the same pair Booking Buddy uses). With
those set: open **Player view** on a phone, join, enable the notification, then
drive the console until that player's foursome hits On Deck or a court. Without
VAPID keys the control degrades silently and there is nothing to test.

## Automated tests

The console itself is covered by:

- `src/lib/on-deck/dev-players.test.ts` — the synthetic name / skill generator.
- `src/lib/on-deck/routes.test.ts` — `/on-deck/dev` and `/on-deck/dev/enter` are
  not Organizer-gated (they 404 without the key rather than redirecting).

There is no pgTAP or Playwright for it — it adds no SQL, and it is a manual tool,
not a shipped surface.
