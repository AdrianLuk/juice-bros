# Site Implementation Brief — Progress

Tracking against the phases in the original implementation brief. Checked = done, unchecked = not started (or blocked on a dependency noted inline).

## Phase 1 — Bugs and stubs

- [x] **1.1 Fix the Podcast page episode fetch** — `/podcast` and the homepage already shared one fetch (`getLatestVideos` in `src/lib/youtube.ts`) with hourly ISR caching. Added the missing piece: a committed fallback snapshot (`content/videos-fallback.json`, refreshed via `npm run snapshot:videos`) so the page still renders the full episode list if the live YouTube feed is ever unreachable.
- [x] **1.2 Build the real Contact page** — Working form (Name, Email, Reason select, Message) at `/contact`, wired to Resend via `src/app/api/contact/route.ts`. Honeypot + submit-timing guard + per-IP rate limiting, inline success/error states, "Follow the Juice Bros" section kept below.
- [x] **1.3 Host bio placeholders** — Replaced "Bio coming soon" with `content/team.ts` (name/role/bio/funFact/instagramUrl/imageSrc per host) and on-brand interim copy on `/about`.

## Phase 2 — Episode pages

Design settled via a domain-modeling/grilling session — see [CONTEXT.md](CONTEXT.md), [docs/adr/0001-youtube-data-api-for-shorts-detection.md](docs/adr/0001-youtube-data-api-for-shorts-detection.md), and [docs/adr/0002-episodes-generated-live-not-scaffolded.md](docs/adr/0002-episodes-generated-live-not-scaffolded.md). Episodes are generated live from YouTube data (no content layer, no scaffold script); the only persisted piece is a small hand-edited overrides file.

- [x] **2.1 Switch to the YouTube Data API** — `getLatestVideos()` now calls the YouTube Data API (`playlistItems.list` against the channel's uploads playlist, then `videos.list` for `contentDetails.duration` + `player.embedHeight`) instead of the RSS feed; every `YoutubeVideo` gains `duration` (ISO 8601) and `orientation` (`landscape`/`portrait`, derived from the embed-height/reference-width ratio — neither API exposes native pixel dimensions directly). New `YOUTUBE_API_KEY` env var, documented in `.env.example`; a missing key or failed/unreachable call both fall back to `content/videos-fallback.json`, unchanged from today's behavior. That snapshot's own `duration` values are estimated from each description's last chapter timestamp (no live key available to regenerate it against the real API in this environment) — re-run `npm run snapshot:videos` with a real key to replace them with exact API-sourced values; `orientation` is accurately `landscape` for all of them since the channel hasn't posted a Short yet. Purely a data-source swap — no visible change to the homepage/`/podcast` grids. Both API calls carry an 8s `AbortSignal.timeout` and log a `console.error` on a non-ok response, matching the convention `booking-buddy/gmail-client.ts` and `google-places-client.ts` already established, rather than failing silently/indefinitely like the old RSS fetch did. `parsePlaylistItems`/`parseVideoDetails` skip a malformed item instead of throwing (one bad entry no longer takes the whole batch down) and skip rather than default a missing `embedHeight` (defaulting it to 0 would silently misclassify an orientation-less video as `landscape` — the opposite of safe for a field whose purpose is spotting vertical Shorts). `snapshot-videos.mts` now refuses to run without `YOUTUBE_API_KEY` set, rather than silently rewriting the snapshot with its own stale contents and reporting success. A multi-angle `/code-review` pass caught all of the above, plus a real API key that had appeared in `.env.example` (not from this session's own edits) — blanked before commit; if it's a live key it should be rotated in Cloud Console. Verified: `node --test` (481/481; new `youtube.test.ts` covers `deriveOrientation`, `parsePlaylistItems`, `parseVideoDetails`, `getEpisodeHook`), `tsc --noEmit`, `eslint .`.
- [x] **2.2 Create the episode route** — `/podcast/[slug]` (#139), rendered on request from `getEpisodes()`: title, description/show-notes, thumbnail, publish date, and the reused `WatchListenButtons`. Slug is `slugify(currentTitle)` computed live, not stored. A request matching an override's `redirectFrom` redirects to the episode's current slug; a Short's slug 404s.
- [x] **2.3 Rewire existing links to point internally** — Homepage grid, featured card, and `/podcast` list now link to `/podcast/[slug]` internally instead of out to YouTube (#140).
- [x] **2.4 Episode overrides file** — `content/episode-overrides.ts` (#139): hand-maintained, keyed by videoId, with optional `redirectFrom` and `showNotes`. Empty at launch, as planned.

## Phase 3 — Technical SEO

- [x] **3.1 Structured data**
  - [x] `Organization` + `WebSite` JSON-LD sitewide (`src/lib/structured-data.ts`, rendered in root layout)
  - [x] `PodcastSeries` JSON-LD
  - [x] `PodcastEpisode` + `VideoObject` JSON-LD on each episode page (#141), `VideoObject` nested as the `PodcastEpisode`'s `associatedMedia`
  - [x] `BreadcrumbList` on each episode page (#141)
  - [x] `BreadcrumbList` + `ItemList` of `Product` on `/gear` (#165) — no `offers`/price, since those are external affiliate links we don't control pricing or availability for
  - [x] `BreadcrumbList` + `ItemList` of `SoftwareApplication` on `/tools`, plus a per-app `BreadcrumbList` + `SoftwareApplication` on `/tools/pickle-point-pal` (#165)
  - [x] `BreadcrumbList` + lightweight `ItemList` linking to each episode page on `/podcast` (#165)
  - [x] `/gear`, `/tools`, `/tools/pickle-point-pal`, and `/podcast` validated against Google's Rich Results Test by Adrian — clean (#165)
  - [x] Episode page (`PodcastEpisode`/`VideoObject`/`BreadcrumbList`) validated against Google's Rich Results Test by Adrian — clean (#141)
- [x] **3.2 Sitemap and robots**
  - [x] `app/sitemap.ts` exists, covers all current static pages with `lastModified`
  - [x] `app/robots.ts` exists, references the sitemap; allows the marketing/podcast site and Booking Buddy's public pages (`/booking-buddy` landing, sign-in, privacy), disallows Booking Buddy's signed-in-only feature routes (friends/groups/orgs/bookings/slots/settings, built from `routes.ts` constants) and the tokenised guest Slot Links (`/s/`). `/booking-buddy` is in `sitemap.ts`.
  - [x] One entry per Episode, `lastModified` set from each episode's publish date (#141)
- [x] **3.3 Metadata improvements** — Homepage title changed from bare "Juice Bros Pickleball" to "Juice Bros Pickleball | The Podcast for Everyday Players" (`siteConfig.tagline`, used in root layout + OG/Twitter tags). Canonical URLs and OG image were already correctly wired via `pageMetadata()`. Episode pages get their own title/description via `generateMetadata()` (#139). Episode pages now also emit `og:type=video.other`, an `og:image` of the video's `maxresdefault` thumbnail (not the generic site card), and `og:video` embed tags, all via a new optional `image`/`video` arg on `pageMetadata()`. `/tools` got a fuller meta description. Episode-page `BreadcrumbList` JSON-LD now starts at "Home" like `/gear` and `/tools`.
- [x] **3.4 Image alt text audit** — Swept. Content images (home/about hero photos) carry real `alt`; genuinely decorative images (video-grid + episode-page thumbnails, which sit next to the episode title as text; header/footer logos, which sit next to the wordmark) keep `alt=""` and now carry a comment explaining why, so a future sweep doesn't re-flag them. Homepage featured card is an `<iframe>` + an `aria-hidden` background wash now, not a thumbnail.
- [ ] **3.5 Performance check** — No Lighthouse run yet on homepage or an episode page (episode pages don't exist).

## Phase 4 — Conversion

- [ ] **4.1 Newsletter upgrade** — Existing homepage/footer signup (`NewsletterForm`) still has the original placeholder offer copy; no inline block on episode pages yet, no lead-magnet delivery flow, ESP not confirmed with Adrian.
- [ ] **4.2 "Send us your story" flow** — Not started.

## Phase 5 — Backlog (explicitly scope-later, not build-now)

- [ ] Courts & clubs directory
- [ ] Ontario tournament calendar
- [ ] Club spotlight pages
- [ ] Gear page write-ups
- [ ] Round Robin Generator — removed from the live `/tools` listing (`src/data/apps.ts`) and put on the backburner; brief still at `briefs/juice-bros-round-robin-brief.md` if it gets picked back up.
- [x] Pickleball Referee scorekeeper — shipped as "Pickle Point Pal" at `/tools/pickle-point-pal`. Mostly done; Adrian may still add to it.
- [x] Booking Buddy — friend-group scheduling app (Apps section), Supabase-backed per CLAUDE.md's carve-out. Fully implemented and deployed: auth, friend connections/visibility, Facilities, Bookings (with Players, editable name/notes, full in-place editing), Slots (poll → confirmed lifecycle, gendered Capacity, Slot Links/Guest RSVP), Availability Windows, a dashboard calendar with a friend-calendar view, email/push Reminders, PWA installability, Sync from Email (CourtReserve parsing), and a privacy policy. Every ticket in the tracker is shipped, zero open issues as of 2026-08-25 — see [booking-buddy/CONTEXT.md](booking-buddy/CONTEXT.md), [booking-buddy/docs/adr/](booking-buddy/docs/adr/), and [booking-buddy/PROGRESS.md](booking-buddy/PROGRESS.md). **Launched on the public site 2026-08-26**: first entry in `src/data/apps.ts`, so it's the lead card on `/tools`. `/booking-buddy` is now a public marketing page for signed-out visitors and the dashboard for signed-in ones — a server-side session branch in `page.tsx`, with the proxy no longer gating the root path (`requiresSession` returns false for the exact `/booking-buddy`; every nested route stays gated, and the page still calls `verifySession` before rendering the dashboard). The landing page (`src/components/booking-buddy/landing/`) inherits the JB marketing section rhythm inside `.bb-theme`, with hand-authored illustrative mockups of real surfaces (a Slot's responses, friends' availability, a week view) and a shared FAQ list that also feeds `FAQPage` JSON-LD. `/booking-buddy` is in `sitemap.xml` and `robots.ts` (the disallow list still covers the signed-in-only feature routes and `/s/`). Sign-in still has a Gmail allowlist for the email-sync feature, but sign-in itself is open.

## Manual (Adrian, not Claude Code)

- [ ] Google Search Console + Bing Webmaster Tools, submit sitemap
- [x] Run an episode page through Google's Rich Results Test once deployed, to validate the `PodcastEpisode`/`VideoObject`/`BreadcrumbList` JSON-LD (#141) — done, clean
- [x] Run `/gear`, `/tools`, `/tools/pickle-point-pal`, and `/podcast` through Google's Rich Results Test once deployed, to validate the `Product`/`SoftwareApplication`/`ItemList`/`BreadcrumbList` JSON-LD (#165) — done, clean
- [ ] Submit RSS feed to Apple Podcasts, Amazon Music, Pocket Casts, Overcast, iHeart, Podcast Index
- [ ] Submit to podcast directories (Feedspot, MillionPodcasts)
- [ ] Add site URL to YouTube video descriptions + pin a comment linking the episode page
- [ ] Write real host bios and per-episode show notes (the latter via the `showNotes` field in `content/episode-overrides.ts`)
