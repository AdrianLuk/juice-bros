# On Deck — Implementation Progress

Live court rotation for club pickleball socials (Apps section). Spec: issue
[#238](https://github.com/AdrianLuk/juice-bros/issues/238). Domain model and
load-bearing decisions in [CONTEXT.md](CONTEXT.md) and [docs/adr/](docs/adr).

Built test-first at the seams Booking Buddy settled on (`booking-buddy/PROGRESS.md`):
pure functions under `node --test`, schema/RLS under pgTAP, journeys under
Playwright. The `reduceSession` fold is the centre of gravity — a config plus an
event array plus assertions about the resulting state.

**File layout**
- `src/app/on-deck/` — routes (landing is marketing; `home` is Organizer-gated; `c/[clubId]` and `session/[sessionId]` are open)
- `src/lib/on-deck/session/` — the pure fold (`reduce.ts`, `types.ts`), relative imports only
- `src/lib/on-deck/` — server helpers, `actions/` — Server Actions
- `src/components/on-deck/` — components
- `supabase/migrations/`, `supabase/tests/` — schema + RLS (`on_deck_` prefix)

## Done

- [x] **#241 — Club and Session foundation, one-tap start.** Schema for
  `on_deck_clubs` / `on_deck_sessions` / `on_deck_session_events` with the
  ADR 0003 hybrid RLS posture and the ADR 0006 open-Session-is-public twist.
  Organizer auth (magic link + password, own sign-in / callback / DAL,
  proxy extended to `/on-deck`). `reduceSession` folds `SESSION_STARTED` into
  a minimal `SessionState`. Organizer home shows the Club and a one-tap Start;
  the stable Club QR path resolves to the open Session or "nothing running".
  One open Session per Club enforced by a partial unique index. Tests:
  `reduce.test.ts`, `routes.test.ts`, `on_deck_club_session.test.sql`,
  `e2e/on-deck.spec.ts`.

## Next

The rest of #238 — Players joining via the QR and the Queue, Match Me
selection and On Deck foursomes, Queue Together, the Volunteer link surface,
the Display and Kiosk, Last Call and the Session Summary purge.
