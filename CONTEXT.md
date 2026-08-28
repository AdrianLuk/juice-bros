# Podcast Site

The Juice Bros Pickleball marketing and podcast hub (Home, Podcast, Gear, About, Contact) — the platform's primary public-facing property, expanding from a YouTube/Spotify podcast into episode pages, gear content, and eventually merch. This glossary covers the Podcast/Episode domain and the Instagram feed; other areas (Gear, About) stay plain content-site language until they need modeling.

## Language

**Episode**:
A published podcast video that qualifies as a full episode (not a Short — see Short), rendered at its own page under `/podcast/[slug]`. Generated live from its YouTube video data (title, description, thumbnail, published date, duration) on every request — there is no persisted "episode" record, so any qualifying video in the channel, past or future, automatically has a working page with no import/backfill step.
_Avoid_: Video (fine for the underlying YouTube data type; Episode specifically means "one that gets a page")

**Short**:
A channel upload identified as a YouTube Short: vertical (9:16) and 3 minutes or under, per the YouTube Data API's duration/dimension fields. Excluded entirely from Episode generation and from every video grid on the site (homepage, `/podcast`) — Shorts are for YouTube/Instagram discovery, not the podcast archive.
_Avoid_: Clip (reserved as a distinct future concept, not yet modeled)

**Slug**:
An Episode's URL segment, computed live as `slugify(currentTitle)` rather than stored. Because it's derived fresh from whatever the YouTube title currently is, editing a title after publish silently changes the slug too, unless caught by an Episode Override's `redirectFrom`.
_Avoid_: Episode ID, video ID (the YouTube video ID is a separate, permanent identifier used only to key Episode Overrides — it never appears in the URL)

**Episode Override**:
A hand-maintained, opt-in exception record for one Episode, keyed by its YouTube video ID (`content/episode-overrides.ts`). Left empty for the vast majority of episodes. Two independent optional fields: `redirectFrom` (a former slug that should redirect here, added the one time a title is deliberately renamed post-publish) and `showNotes` (a hand-written replacement for the auto-displayed YouTube description, for once real show notes get written). Also carries the episode's title as a human-readable label for finding entries in the file — never read as a data source, since the real title always comes live from YouTube.
_Avoid_: Content layer, scaffold (there is no per-episode authored record beyond this override — everything else about an Episode is generated, never authored)

**Instagram Post**:
One item from the **@juicebrospickleball** Instagram account, fetched live from the Instagram API (Instagram Login) and shown as a thumbnail in the "On Instagram" grid on the homepage and the Contact page. Display-only: not persisted, modeled as nothing more than `{ id, caption, permalink, thumbnail, timestamp, type }`, and always links out to Instagram. A Reel or feed video appears as its thumbnail frame with a play badge (`type: "video"`). The grid shows the 6 most recent (`INSTAGRAM_POST_COUNT`); when the API returns nothing — no token, expired token, request failed — the whole section is hidden rather than rendering empty.
_Avoid_: Instagram Feed (that's the section/grid, not the item); "embed" (there is no Instagram-hosted iframe or script — it's our own markup over server-fetched data)

See [docs/adr/0001-youtube-data-api-for-shorts-detection.md](docs/adr/0001-youtube-data-api-for-shorts-detection.md), [docs/adr/0002-episodes-generated-live-not-scaffolded.md](docs/adr/0002-episodes-generated-live-not-scaffolded.md), and [docs/adr/0003-instagram-token-in-edge-config.md](docs/adr/0003-instagram-token-in-edge-config.md).
