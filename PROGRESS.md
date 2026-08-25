# Site Implementation Brief — Progress

Tracking against the phases in the original implementation brief. Checked = done, unchecked = not started (or blocked on a dependency noted inline).

## Phase 1 — Bugs and stubs

- [x] **1.1 Fix the Podcast page episode fetch** — `/podcast` and the homepage already shared one fetch (`getLatestVideos` in `src/lib/youtube.ts`) with hourly ISR caching. Added the missing piece: a committed fallback snapshot (`content/videos-fallback.json`, refreshed via `npm run snapshot:videos`) so the page still renders the full episode list if the live YouTube feed is ever unreachable.
- [x] **1.2 Build the real Contact page** — Working form (Name, Email, Reason select, Message) at `/contact`, wired to Resend via `src/app/api/contact/route.ts`. Honeypot + submit-timing guard + per-IP rate limiting, inline success/error states, "Follow the Juice Bros" section kept below.
- [x] **1.3 Host bio placeholders** — Replaced "Bio coming soon" with `content/team.ts` (name/role/bio/funFact/instagramUrl/imageSrc per host) and on-brand interim copy on `/about`.

## Phase 2 — Episode pages

- [ ] **2.1 Create the episode route** — `/podcast/[slug]` + content layer (MDX or `content/episodes.ts`) not started.
- [ ] **2.2 Rewire existing links to point internally** — Homepage grid, featured card, and `/podcast` list still link out to YouTube directly.
- [ ] **2.3 Backfill content** — `scripts/import-episodes.ts` (scaffold episodes from the channel feed) and the caption-pull script not started.

## Phase 3 — Technical SEO

- **3.1 Structured data** — partial
  - [x] `Organization` + `WebSite` JSON-LD sitewide (`src/lib/structured-data.ts`, rendered in root layout)
  - [x] `PodcastSeries` JSON-LD
  - [ ] `PodcastEpisode` + `VideoObject` on episode pages — blocked on Phase 2
  - [ ] `BreadcrumbList` on episode pages — blocked on Phase 2
  - [ ] Validated against Google's Rich Results Test
- **3.2 Sitemap and robots** — mostly done
  - [x] `app/sitemap.ts` exists, covers all current static pages with `lastModified`
  - [x] `app/robots.ts` exists, allows all, references the sitemap
  - [ ] Episode page entries — blocked on Phase 2
- [x] **3.3 Metadata improvements** — Homepage title changed from bare "Juice Bros Pickleball" to "Juice Bros Pickleball | The Podcast for Everyday Players" (`siteConfig.tagline`, used in root layout + OG/Twitter tags). Canonical URLs and OG image were already correctly wired via `pageMetadata()`. Episode-page title/description/OG-image rules still blocked on Phase 2.
- [ ] **3.4 Image alt text audit** — Not swept yet. Found empty `alt=""` without an intentional-decorative comment on the homepage featured episode thumbnail, the video grid thumbnails (`src/components/video-grid.tsx`), and the header/footer logos.
- [ ] **3.5 Performance check** — No Lighthouse run yet on homepage or an episode page (episode pages don't exist).

## Phase 4 — Conversion

- [ ] **4.1 Newsletter upgrade** — Existing homepage/footer signup (`NewsletterForm`) still has the original placeholder offer copy; no inline block on episode pages yet (blocked on Phase 2), no lead-magnet delivery flow, ESP not confirmed with Adrian.
- [ ] **4.2 "Send us your story" flow** — Not started.

## Phase 5 — Backlog (explicitly scope-later, not build-now)

- [ ] Courts & clubs directory
- [ ] Ontario tournament calendar
- [ ] Club spotlight pages
- [ ] Gear page write-ups
- [ ] Round Robin Generator — removed from the live `/tools` listing (`src/data/apps.ts`) and put on the backburner; brief still at `briefs/juice-bros-round-robin-brief.md` if it gets picked back up.
- [x] Pickleball Referee scorekeeper — shipped as "Pickle Point Pal" at `/tools/pickle-point-pal`. Mostly done; Adrian may still add to it.
- [x] Booking Buddy — friend-group scheduling app (Apps section), Supabase-backed per CLAUDE.md's carve-out. Fully implemented and deployed: auth, friend connections/visibility, Facilities, Bookings (with Players, editable name/notes, full in-place editing), Slots (poll → confirmed lifecycle, gendered Capacity, Slot Links/Guest RSVP), Availability Windows, a dashboard calendar with a friend-calendar view, email/push Reminders, PWA installability, Sync from Email (CourtReserve parsing), and a privacy policy. Every ticket in the tracker is shipped, zero open issues as of 2026-08-25 — see [booking-buddy/CONTEXT.md](booking-buddy/CONTEXT.md), [booking-buddy/docs/adr/](booking-buddy/docs/adr/), and [booking-buddy/PROGRESS.md](booking-buddy/PROGRESS.md). Still deliberately **not** linked from the public site — no entry in `src/data/apps.ts`, so it's unreachable from `/tools` or the sitemap; getting there is a product decision (soft-launch, Gmail-allowlist real users) rather than remaining engineering work.

## Manual (Adrian, not Claude Code)

- [ ] Google Search Console + Bing Webmaster Tools, submit sitemap
- [ ] Submit RSS feed to Apple Podcasts, Amazon Music, Pocket Casts, Overcast, iHeart, Podcast Index
- [ ] Submit to podcast directories (Feedspot, MillionPodcasts)
- [ ] Add site URL to YouTube video descriptions + pin a comment linking the episode page
- [ ] Write real host bios and per-episode show notes
