/**
 * Hand-maintained, opt-in exceptions for individual Episodes, keyed by
 * YouTube video ID. Left empty for the vast majority of episodes - everything
 * else about an Episode is generated live from YouTube data, never authored.
 * See CONTEXT.md's "Episode Override" entry and
 * docs/adr/0002-episodes-generated-live-not-scaffolded.md.
 */
export type EpisodeOverride = {
  videoId: string;
  /** Human-readable label only, for finding entries in this file - never read as a data source. */
  title: string;
  /** Former slugs that should redirect here, added when a title is deliberately renamed post-publish. */
  redirectFrom?: string[];
  /** Hand-written replacement for the auto-displayed YouTube description. */
  showNotes?: string;
};

export const episodeOverrides: EpisodeOverride[] = [];
