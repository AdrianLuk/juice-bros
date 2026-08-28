import { EpisodeCard } from "@/components/episode-card";
import { RevealGroup } from "@/components/motion/reveal";
import type { Episode } from "@/lib/episodes";

const GRID_CLASS = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

/**
 * `stagger` turns the grid into a reveal cascade - the tiles settle in a short
 * wave as the grid scrolls into view. Used where the grid is the page's main
 * content (the Podcast archive); left off where a section-level reveal already
 * carries the block (the home page's Latest Videos).
 *
 * `morph` makes each tile's thumbnail a shared element for the transition into
 * the episode page (see `EpisodeCard`). On the Podcast archive only - the home
 * page's grid links to the same routes but is a secondary block, so it keeps
 * the plain page cross-fade.
 */
export function VideoGrid({
  videos,
  stagger = false,
  morph = false,
}: {
  videos: Episode[];
  stagger?: boolean;
  morph?: boolean;
}) {
  const tiles = videos.map((episode) => (
    <EpisodeCard key={episode.id} episode={episode} morph={morph} />
  ));

  return stagger ? (
    <RevealGroup className={GRID_CLASS}>{tiles}</RevealGroup>
  ) : (
    <div className={GRID_CLASS}>{tiles}</div>
  );
}
