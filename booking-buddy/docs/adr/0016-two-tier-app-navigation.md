# Two-tier app navigation, in the section layout, with a standalone shell

The signed-in Booking Buddy nav was seven flat peers of equal weight —
`Dashboard | Bookings | Slots | Friends | Groups | Facilities | Settings | Sign out` —
rendered per page as `<BookingBuddyNav current="…">` beside the `PageHeading`, scrolling
sideways on mobile. An `/impeccable` audit (issue #196) flagged it as unnatural, and the
specifics held up:

- **No hierarchy.** Account chrome (Settings, Sign out) sat indistinguishable from primary
  navigation.
- **Order fought the workflow** — Bookings ahead of Slots, though you coordinate a time
  before you reserve a court.
- **Flattened relationships.** `Groups` is a child of `Friends`; `Facilities` belongs to
  the booking world, not among the social items. Every page then carried hand-picked
  `FooterNav` cross-links (Friends↔Groups, Bookings↔Facilities) that only existed because
  the nav didn't express those relationships.
- **"Slots" is jargon** a new user has to decode — the page literally explained "same as a
  poll" — the same way "Org" was, which is why the UI already renames Org → "Facilities".
- **It read as a website, not an app.** BB rendered inside the global marketing chrome
  (`SiteHeader` + `SiteFooter`), so the nav was "more links on a website".

## Decision

### Section tree (two tiers)

Five sections, each naming the child its tab / dropdown trigger navigates to:

| Section  | Children                     | Routes                                    |
| -------- | ---------------------------- | ----------------------------------------- |
| Dashboard| —                            | `/booking-buddy`                          |
| Plan     | Games, Availability          | `/booking-buddy/slots`, `/booking-buddy/availability` |
| Bookings | —                            | `/booking-buddy/bookings`                 |
| Friends  | Friends, Groups              | `/booking-buddy/friends`, `/booking-buddy/groups` |
| Settings | Settings, Facilities         | `/booking-buddy/settings`, `/booking-buddy/orgs` |

_(Bookings originally carried Facilities as a second child; Availability / Find a time
joined Plan later, and Facilities moved to Settings — see Consequences.)_

Section labels repeat the primary child's label (GitHub's "Code" tab pattern) except where
a section genuinely spans two peers. The tree lives as `BB_SECTIONS` in
`src/lib/booking-buddy/routes.ts`, beside the path constants and free of Next / icon
imports, with `sectionForPath` / `siblingsForPath` helpers — one definition the layout nav
and the pill row both read, unit-tested the way `requiresSession` is.

### The nav lives in `src/app/booking-buddy/layout.tsx`, and reads the pathname

The old `bb-nav.tsx` took a `current` prop and a `BbNavKey` type on the deliberate
rationale that "every page rendering this already knows its own route as a server
component, so don't read the pathname client-side". **This ADR reverses that.** One nav in
the layout, `usePathname`-driven, is worth a small client component: it deletes the
per-page `<BookingBuddyNav current=…>` call and the `BbNavKey` union, and it's the only way
a persistent bar (that doesn't unmount on navigation) works.

- **Desktop** (`BbAppShell`): a sticky full-width top bar — "Booking Buddy" wordmark →
  dashboard, then Dashboard / Plan / Bookings / Friends. Bookings and Friends are also
  dropdown triggers (CSS hover / focus-within, no JS) exposing their children; the trigger
  itself is a link to the primary child. Settings sits in a right-aligned cluster past a
  divider. Plan ships as a plain link — its one child is the primary.
- **Mobile**: a fixed bottom tab bar — Dashboard / Plan / Bookings / Friends / Settings,
  each navigating to the primary child. Not a bottom-right FAB: that corner is the
  dashboard's quick-add.
- **Both breakpoints**: a secondary pill row under the `PageHeading` on section pages with
  real siblings (`BbSectionNav`, prop-less, `usePathname`-driven) — "Bookings · Facilities",
  "Friends · Groups". One shared component; only the primary bar differs by breakpoint. On
  desktop it's deliberately redundant with the dropdown — it's the persistent "where am I"
  signal.
- **Sign out** moves to the bottom of the Settings page, keeping its confirm dialog
  (`SignOutButton`). Out of the nav entirely.

The layout still does not *gate* — it does not `verifySession` (the sign-in page lives
beneath it; the proxy + per-page checks are the gate, ADR 0003). It now does
`await getOptionalSession()` purely to pick chrome, and `getOptionalSession` is
React-`cache`d, so the pages beneath don't pay for it twice:

- **Signed in** → the standalone `BbAppShell`, no global chrome.
- **Signed out** → the pre-auth pages (landing, sign-in, privacy, join) are marketing / auth
  surfaces, not the app — the landing in particular takes cold traffic from `/tools` and
  shared links. They keep the normal Juice Bros `SiteHeader` / `SiteFooter` (rendered from
  this layout, since the root layout's copy is suppressed below), so the marketing hero
  still bleeds behind the floating pill nav and the footer's site links / socials stay.

### Standalone app shell

- The root layout's `SiteHeader` + `SiteFooter` are suppressed across `/booking-buddy` (a
  `SiteChromeSlot` client wrapper, mirroring `routes.ts`'s `isUnderRoot` so
  `/booking-buddy-press-kit` keeps the chrome). The signed-out BB layout re-renders them
  itself; the signed-in shell renders neither. **Not** suppressed on `/s/[token]` — the
  Guest Slot Link page is a public marketing surface, not part of the app.
- `FooterNav` / `FooterLink` are deleted. Every signed-in page ends on `BbFooter`: just
  **Privacy** and a quiet **Juice Bros Pickleball** link to `/` — the only way out of the
  shell now that the site header is gone. All the cross-links go; the two-tier nav
  expresses those relationships. (Pre-auth pages keep their own small footer / the global
  `SiteFooter`.)

### Slots → "Games" in copy, `Slot` stays the entity (rings 1–2 only)

"Slot" is decoded jargon in the UI, so visible copy moves to "Games": the nav label, the
page `<h1>` and `<title>`, in-page section headings and buttons ("Your games", "Post a
game", "Delete game", "Keep game"), empty-state and helper blurbs, the section error page,
the reminder opt-in copy.

What stays `Slot`:

- **`Slot Link`** — a proper-noun feature name. Renaming it ripples into the guest-RSVP
  flow, `slot-links.tsx`, and `/s/[token]`.
- **The entity, everywhere non-visible**: the database, all code (`createSlot`, `SlotRow`,
  `getSlotDetail`, …), the analytics event `bb_first_slot`, this ADR, and CONTEXT.md's
  **Slot** entry.
- **The URL** `/booking-buddy/slots` (and `slotPath`). The e2e specs `goto` it; a redirect
  is churn for no user benefit.
- **Visibility copy** ("Slots I share with them", "Slot Visibility") — that's the
  Visibility lattice (ADR 0007), a separate surface, out of scope for this pass.

The marketing landing page, its mockups, and the FAQ block are a separate copy pass
(rings 3–4), along with compound feature names.

## Consequences

- `bb-nav.tsx` and `footer-nav.tsx` are deleted; `BbNavKey` is gone. New components:
  `bb-app-shell.tsx`, `bb-section-nav.tsx`, `sign-out-button.tsx`, `bb-footer.tsx`, and
  `layout/site-chrome-slot.tsx`.
- `sectionForPath` is the single point that has to agree with the route table — covered by
  `routes.test.ts`.
- A signed-in user viewing `/booking-buddy/privacy` gets the app shell with no active tab
  (privacy belongs to no section); that's fine — it's still the app.
- The mobile layout wrapper carries `pb-[calc(4rem+env(safe-area-inset-bottom))]` to clear
  the fixed bottom bar (the bar carries the same safe-area inset); the dashboard quick-add
  FAB already sits at `bottom-24`, above it.
- "Availability" (`/booking-buddy/availability`, labelled "Open time" until issue #229) landed
  as Plan's second child in issue #197, so Plan is now a dropdown like Bookings and Friends and
  carries its own pill row.
- **Facilities moved from Bookings to Settings.** Managing the venues you play at is setup, not
  a day-to-day booking task, and pairing it with the lone Bookings page gave that section a
  two-item dropdown for no real navigational gain. `Facilities` (`/booking-buddy/orgs`) is now
  Settings' second child: Settings became a dropdown / pill-row section ("Settings · Facilities"),
  Bookings dropped back to a plain link, and the desktop account cluster renders Settings through
  the shared `DesktopSectionItem` (dropdown anchored to the right edge) rather than its own
  hand-rolled link. The `/orgs` route and the "Facilities" product label are unchanged. The
  sibling row also renders as a segmented control now, not a bare hover-fill pill row, so the
  inactive tabs read as navigation.
