# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: recreational/casual pickleball players - "everyday players," not tour pros
or competitive coaches. People who play pickup and rec-league games, argue about
line calls, fight for court time, and want pickleball content and tools built for
their level rather than a serious/competitive audience. Secondary: friend groups
within that audience who want to coordinate playing time (Booking Buddy) or run
local events (Rotation Board / Round Robin / Pick'em, once shipped).

## Product Purpose

Juice Bros Pickleball is a podcast (already live on YouTube + Spotify) expanding
into a full brand platform - podcast site -> blog/content hub -> free pickleball
tools -> Shopify merch - built by two rec-level co-hosts, Daven and Adrian, for
players like themselves. The podcast covers the psychology, friendships, and
stories around pickleball rather than technique or gear reviews (already well
covered elsewhere). Success right now is audience growth (YouTube/Spotify
subscribers, podcast reach) - the site and its tools exist to support and extend
that growth, not to be an independent revenue driver yet.

## Positioning

Hosted by rec players, for rec players - not tour pros, not certified coaches.
Most pickleball media is hosted by people who've "already arrived"; Juice Bros is
explicitly the show for players who lose to the same teams every week and fight
for the same 8pm court booking. That gap - relatable, non-technical,
community-and-personality-first content - is the mechanism a more credentialed
competitor couldn't copy without losing the relatability.

## Operating Context

- Content originates on YouTube/Spotify; the site's Podcast section (episodes,
  shorts) is generated live from YouTube data - an Episode has no persisted CMS
  record beyond a hand-maintained override file for the rare title-change or
  show-notes case (`docs/adr/0002-episodes-generated-live-not-scaffolded.md`).
- The Apps section is a growing set of free, standalone pickleball tools distinct
  from the podcast content itself: Pickle Point Pal (shipped - referee-facing
  scorekeeping PWA) and Booking Buddy (shipped - friend-group scheduling app with
  Supabase-backed accounts) are live; a Pick'em prediction game, an Open Play
  Rotation Board (kiosk queue app), and a Round Robin Generator are specced in
  `/briefs` but not yet built.
- Gear page: monetizable via future affiliate links (not live yet) - paddles,
  shoes, accessories the hosts actually use.
- Store: Shopify merch, currently unbuilt (planned as a Phase 1 redirect to a
  Shopify storefront).

## Capabilities and Constraints

- No backend/no auth for the marketing/podcast pages (Home, Podcast, Gear, About,
  Contact) - server components, no database.
- Supabase is scoped only to Booking Buddy's routes (accounts, friend
  connections, availability/slot data) - not used elsewhere on the site.
- The free tools (Pickle Point Pal, Booking Buddy, and the future
  Pick'em/Rotation Board/Round Robin tools) are free today; whether any of them
  go paid/premium later is an explicitly open, undecided question - not ruled in
  or out.
- Gear/merch monetization (affiliate links, Shopify store) is the confirmed
  near-term monetization path; the tools are not currently expected to be that
  path, but could become one.
- Team bios in `content/team.ts` are explicitly interim placeholder copy pending
  Adrian writing the real bios in each host's own words - future work should not
  treat that copy as final.

## Brand Commitments

- Name: Juice Bros Pickleball. Hosts: Daven and Adrian, both rec players (not
  pros/coaches) - their identity as "regular players, not tour pros" is core to
  the show's positioning and shouldn't be diluted.
- Voice: casual, self-deprecating, relatable - "pull up a chair, you're one of us
  now." Content favors the psychology, friendships, and stories of the sport over
  technique or gear ranking.
- Brand assets: logo (`public/brand/JB_Logo.svg`, white/whitebg variants), banner
  (`public/brand/JB_Banner*.jpeg`), OG image, host photo
  (`public/pictures/adrian-dav.jpg`).
- Visual design comes from Daven (Figma); this repo implements it.
- Brand orange (`--brand-orange` / `#f26522`) is used as white-on-orange button
  fills and as orange-on-white text sitewide even though that pairing measures
  ~3.15:1 contrast - below WCAG AA's 4.5:1 for normal text. This is an
  intentional decision by Adrian to keep the brand color as-is, not an
  oversight to "fix" by darkening the orange. Don't flag or silently correct
  this contrast ratio in future design work; if an a11y pass wants to address
  it, do so without changing the color itself (e.g. weight, size, outline, or
  adjacent non-color cues).

## Evidence on Hand

- Real, published About page copy (origin story, mission, differentiation) -
  already written and shipped; treat as confirmed brand voice, not draft.
- Real host photo and Instagram links for both co-hosts.
- Real logo/banner/OG assets in `public/brand/`.
- No case studies, testimonials, or usage metrics on hand - do not fabricate any.
- Host bios in `content/team.ts` are explicitly interim/placeholder (see
  Capabilities and Constraints above) - do not treat as final copy.

## Product Principles

1. Relatability over authority - every surface (podcast, tools, copy) should read
   as "made by rec players, for rec players," not aspirational/pro-level content.
2. Audience growth is the current success metric - the site and its tools should
   be built to support YouTube/Spotify growth, not treated as an independent
   product needing its own conversion funnel yet.
3. Free tools stay free until further notice, but don't hard-code monetization
   decisions into the tools' architecture - the paid/premium question is open.
4. Ship simple, evolve later - no backend/monorepo/Supabase beyond what a
   specific feature (Booking Buddy) already requires.
5. Preserve real brand voice and assets - the self-deprecating, non-technical
   tone and Daven/Adrian's identity as rec players is a durable brand commitment,
   not a stylistic default to override.
