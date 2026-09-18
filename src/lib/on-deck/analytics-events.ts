/**
 * The six adoption-funnel event names (issue #524), in one place because the
 * read is manual: somebody scanning the Vercel Analytics console needs the
 * list, and there is no table and no dashboard to get it from.
 *
 * Types only, and no imports at all — the two demo events fire from the
 * browser and the other four from Server Actions, so both halves have to be
 * able to reach this file. The server emitters live in `./analytics.ts`
 * (`server-only`, and the only place the Supabase-backed first-time gates
 * are); the client sites call `@vercel/analytics`'s browser `track` directly,
 * the way `gear-card.tsx` and `onboarding-modal.tsx` already do.
 *
 * See `on-deck/docs/adr/0008-adoption-funnel-analytics.md` for what each one
 * means, what it can and cannot be joined to, and how to read them.
 */
export type OnDeckFunnelEvent =
  /** A visitor mounted the demo. Browser-side, anonymous, once per page load. */
  | "od_demo_opened"
  /**
   * That visitor watched enough turnovers to have formed a view. Browser-side,
   * anonymous, once per page load. "Enough" is a chosen number rather than a
   * derived one — the demo's night has no ending to reach (ADR 0002: a rolling
   * queue with no time cap), so there is nothing else for "finished" to mean.
   */
  | "od_demo_finished"
  /**
   * Somebody clicked toward creating a Club. Browser-side and fired *before*
   * authentication, which is the whole point of it: without this event, "the
   * demo did not convince them" and "signing up was too much friction" are the
   * same number, and they need opposite fixes.
   */
  | "od_club_intent"
  /** An Organizer created their Club. Server-side, once per account. */
  | "od_club_created"
  /** That Club's first ever Session opened. Server-side, once per Club. */
  | "od_first_session_started"
  /**
   * That Club's first ever Session closed, carrying `auto` — true when the
   * Session closed itself after going quiet (issue #516) rather than the
   * Organizer tapping Close. Server-side, once per Club.
   */
  | "od_first_session_closed";

/**
 * Which "Create your Club" a visitor clicked, carried as a dimension on
 * `od_club_intent` rather than split into three events: they are the same
 * intent, and the interesting comparison is between them.
 *
 * `demo` is the one the release actually cares about — it is the only one that
 * can have been preceded by `od_demo_finished` in the same visit.
 */
export type ClubIntentSource = "demo" | "landing-hero" | "landing-close";
