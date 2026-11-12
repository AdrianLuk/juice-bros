# 0006 — Match Mixer gains a backend at Go Live

Date: 2026-11-12
Status: Accepted
Context: Match Mixer (RR-2 + RR-5, #685; this ADR is #686). Decided in the spec
before any code, so the vocabulary and the reversals are on record first.

## The decision

Match Mixer's opening line was "No account, no database, no network". All three
now exist, behind one opt-in step: **Go Live**. An organizer who wants scores
entered from every phone commits a board to the database and gets two links, an
**Organizer Link** and a **Player Link**. What the commit creates is a **Live
Mixer**.

The reason is a direct request. An organizer who wants to run weekly mixers asked
for scores entered from every phone and Standings everyone can read. RR-5 already
named that as the one feature that justifies a backend, and gated it on evidence
that organizers use scores. The request is that evidence. RR-2 (Courtside mode)
and RR-5 (Live score sync) are therefore built as one piece of work, on the
backend, rather than shipping RR-2 first on a single phone and migrating it later.
The round timer stays in RR-2 and is out of scope here.

## What stays true

- **Drawing a board is still offline.** Paste a Roster, draw, print, find-me, make
  a Share Link: all of it runs in the browser with no account and no request, so
  it still works on rec-centre wifi.
- **A board that never goes live is untouched.** It behaves exactly as it does
  today, and `unchanged-boards.test.ts` must keep passing to prove it.
- **The Schedule is still never stored.** Every phone, and the server when it
  checks a write, rebuilds it from the Config plus the player added and player
  left events. Regeneration after a late arrival must be deterministic from those
  inputs. Do not turn this into a stored grid.
- **Players never have an account.** They hold a link, and find-me's existing
  Selection says which Games they may score.
- **The Share Link still carries a plan, not a night in progress.** Scores never
  go in it (RR-3's rule).

## What is reversed

- **RR-5's "No accounts".** An organizer may now sign in, optionally. Every Live
  Mixer always has an Organizer Link, so no account is needed to run a night;
  signing in attaches the Live Mixer to the account as its **Owner**, which is
  what gives the organizer My Mixers and Run it again. Only organizers sign in.
- **The opening paragraph of `CONTEXT.md`** and the line in `CONTEXT-MAP.md` that
  says Match Mixer has "no accounts, no storage beyond the browser". Both are
  amended in the same change as this ADR.
- **`CONTEXT-MAP.md`'s "the only context where a Game has a score".** Team Tally
  is no longer the only one.

## This is where ADR 0001's event log begins

[ADR 0001](0001-config-and-schedule-are-not-event-sourced.md) drew the line at
commitment: "events exist only above a Schedule that has been committed", and
named score entry and mid-session arrivals as the first things that cannot be
expressed as Config. Go Live is that commitment. A Live Mixer stores two things:

- its **Config**, as the existing Share Link payload string, which already pins
  `GENERATOR_VERSION`, so a Schedule rebuilt later is the Schedule drawn at Go
  Live; and
- an **append-only event list**: round started, score entered, score cleared, Game
  Rule changed, player added, player left, finished.

ADR 0001 is upheld, not overturned. Before Go Live the Config is plain mutable
state and nothing is logged. After it, the Config is fixed and the log grows
above it. The first event folds forward from the Schedule the Config already
produces.

## Authorization

One check on every write: the caller holds the Organizer Link token, OR owns the
Live Mixer, OR is a superadmin. Superadmin follows Team Tally's and Mic Drop's
pattern: a `match_mixer_superadmins` table with one row added by hand on prod. The
email never goes in the repo, because the repo is public. The server rebuilds the
Schedule from the Config to check that a Player Link's Selection actually sits in
the Game being scored.

The Player Link's Selection guards against honest mistakes only. Without accounts
nothing stops someone choosing another name on purpose, and the organizer can
correct anything wrong.

## Consequences

- Supabase, scoped to Match Mixer's routes, like Team Tally and Mic Drop. The
  static marketing pages stay off it.
- Live sync copies `use-team-event-sync.ts`: every write broadcasts "changed" on
  the Live Mixer's topic, clients invalidate their TanStack Query reads, and a
  slow poll covers a dropped socket. That is the "client syncing" trigger CLAUDE.md
  requires before Query is used outside Booking Buddy.
- Standings are computed from the scores every time and never stored, for the same
  reason the Schedule is not.
- A Live Mixer finishes on its own 12 hours after it went live. The rule is checked
  on write, so it needs no cron.
- The page's own copy, which already says a Share Link means "it is no longer true
  that nothing leaves the browser", must say plainly that Go Live is the step where
  something does.

## Amendment, 2026-11-12: going live requires sign-in during the beta

Decided while building Go Live (#687), before anyone used it. The text above
says the account is optional and no account is needed to run a night. For the
beta, going live now requires a signed-in organizer, who becomes the Owner.

Why:

- **Security.** An anonymous Go Live is the first write in this repo that needs
  neither an account nor an existing token, so anyone holding the public key
  could fill the table. Requiring sign-in removes anonymous writes entirely and
  makes the rate limit a simple per-account one (20 Live Mixers a day), with no
  IP hashing.
- **The first user runs repeat events.** Every Live Mixer has an Owner from the
  first one, so My Mixers and Run it again (#691) have history to show.
- **One path.** Later slices build on a signed-in Owner instead of handling
  owned and ownerless Live Mixers twice.

What it does not change: drawing, printing, find-me and Share Links stay
account-free and offline; players never sign in; running a night needs only
the Organizer Link, so a co-organizer it is handed to needs no account.

Google is the only sign-in method for now. Email sign-in waits until someone
is turned away by it: it needs a custom mail server for Supabase and its own
abuse limit. If growth ever needs account-free Go Live, the fallback is the
server validating every Config before insert plus a per-IP rate limit.
