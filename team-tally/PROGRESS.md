# Team Tally: Implementation Progress

Scoring for captained team events (Apps section), at `/tools/team-tally`. Spec:
issue [#621](https://github.com/AdrianLuk/juice-bros/issues/621). Domain model in
[CONTEXT.md](CONTEXT.md), decisions in [docs/adr/](docs/adr), the visual world in
[DESIGN.md](DESIGN.md).

Built test-first at the seams On Deck and Booking Buddy settled on: pure
functions under `node --test`, schema, grants and RLS under pgTAP, server
helpers under `test:db`, journeys under Playwright. Unlike On Deck there is no
event log: a Team Event is plain tables (ADR 0001), and the SQL functions own
every state change.

**File layout**
- `src/app/tools/team-tally/`: routes. The landing page is marketing;
  `events/*` is Organizer-gated; `score/[token]` (a captain's Score Link) and
  `live/[token]` (the Public Link, also the venue TV) are open, the token is
  the credential.
- `src/lib/team-tally/`: pure rules (`score.ts`, `standings.ts`, `seeding.ts`,
  `matchup-done.ts`, `final-places.ts`, `brief.ts`, `parse-brief.ts`,
  `tv-screens.ts`), relative imports only; `event-doc.ts` is the one shape every
  screen reads; `actions/` holds the Server Actions.
- `src/components/team-tally/`: components. `team-tally.css` scopes the world
  to `.tt-surface`.
- `supabase/migrations/*team_tally*`, `supabase/tests/team_tally_*`: schema,
  token functions, grants (`team_tally_` prefix).
- `e2e/team-tally*.spec.ts`, helpers in `e2e/support/team-tally.ts`.

## Hosted DB

All four migrations went up 2026-10-08, right after PR #629 merged:
`20261008150000_team_tally_events`, `20261009120000_team_tally_live_scoring`,
`20261009150000_team_tally_flights`, `20261010120000_team_tally_review_fixes`.
The `--dry-run` before listed exactly those four, and the one after reported
"Remote database is up to date".

`20261010120000` matters on hosted Supabase in particular: it spells out
EXECUTE for `public`, `anon` and `authenticated` on all 35 Team Tally
functions, because a hosted project can grant new functions to `anon` by
default. Only the token entry points are callable without an account
(`team_tally_score_game`, `_set_slots`, `_mark_done`, `_set_dreambreaker`,
`_score_link_event`, `_public_event`, `_score_problem`).
`team_tally_grants.test.sql` pins every one; add a new function to it, or the
test fails.

Live updates use Realtime Broadcast (an empty "changed" on
`team-tally:<event id>`), not Postgres Changes, because `anon` has no table
SELECT for Realtime to authorize. Nothing to configure in the dashboard.

## Done

All shipped together in PR #629 (squash `004dfba`), built on
`spec/621-team-tally`.

- [x] **#622: shell, setup and the Brief.** Organizer sign-in (shared Google
  button), the Team Event list, the setup form (Teams, captains, three Player
  slots, Home courts, opening Matchups by court pair) and the Brief Team Tally
  writes for the group chat, in the organizer's own format (em-dashes and
  emoji kept verbatim).
- [x] **#627: the look.** Impeccable, seed `fb8e9ead`: the Broadcast package
  look fused with the Tournament leaderboard's structure. Score bug (R1 R2 R3
  TOT), timing tower with a Flight band every pair, navy plates for live
  numbers only, red and blue for a Matchup's two sides, ball yellow for "now".
  Sofia Sans and Sofia Sans Extra Condensed. The route leaves the marketing
  site's dark shell (`DARK_EXCEPTIONS`).
- [x] **#626: paste an old brief.** `parse-brief.ts` reads both layouts the
  organizer has used and prefills the setup form; anything it can't read is
  left blank and highlighted. Fixtures in `src/lib/team-tally/fixtures/`.
- [x] **#623: Score Links and live scoring.** Captains score their own
  Matchup with no account; every Game says which Team entered it. The score
  rule lives in three places that must agree: `score.ts`, a CHECK constraint,
  and the RPC refusal ("13-9 can't happen: the game ends at 11-9"). A scored
  Round pins its slot, so a rename or reorder only moves unscored Rounds.
- [x] **#624: Matchup done, Seeding and Flights.** A tie needs its
  Dreambreaker winner before done. The last opening Matchup done places the
  Flights by itself (row lock on the Team Event, so two at once seed once).
  `seeding.ts` is mirrored in SQL by `team_tally_seed_order`. The Organizer
  has Seed now, Reopen, court-pair swaps and the call on a full tie.
- [x] **#625: results, summary, big screen.** The last Flight Matchup done
  ends the night: Score Links go read-only and the Public Link becomes the
  results page (Flight champions, final places, opening standings, every
  Matchup). The big-screen stage is picked by viewport in CSS and hard-cuts
  between whole screens on a timer, never scrolling. Delete with an in-page
  confirm.
- [x] **Review fixes** (`6474c5a`, `8829cbe`). Setup locks once any Game is
  scored or the Flights are placed. No Dreambreaker changes after the night is
  finished. The Organizer can still put one tied Team ahead after auto-seeding,
  until either Flight has a score. Explicit grants. TV type sized for reading
  across a room.

## Tooling

- `npm test`: the pure rules (`src/lib/team-tally/*.test.ts`).
- `npm run test:db`: `events`, `live-events`, `flights` `.db-test.ts`
  against the local Supabase.
- `npm run test:rls`: `supabase/tests/team_tally_*.test.sql`.
- `npx playwright test e2e/team-tally`: run the spec files one at a time; a
  batched run with a regex `testMatch` hung during #625.
- Test events are cleaned up by the e2e helpers; leftover
  `team-tally-*` test users in the shared local DB are safe to delete.

## Next

- [ ] **First real night: Tuesday 2026-10-13** at Backyard, run by the
  organizer the app was designed around.
- [ ] A demo night to show that organizer before then, like On Deck's
  `/on-deck/demo` (#519, #522).
- Not planned: other team formats (MLP-style gender doubles and the like).
  CONTEXT.md says to add a second Format when one is needed, not to
  generalise now.
