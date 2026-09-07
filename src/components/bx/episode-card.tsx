"use client";

import Link from "next/link";
import { useRef } from "react";

import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { PlayMark } from "./play-mark";
import { formatAiredShort, formatRuntime } from "./format";

/**
 * One episode in a Broadcast Dark grid - the home page's archive and the
 * Podcast catalogue render the identical card, because they are the identical
 * object and a visitor moving between the two should not have to re-learn it.
 *
 * The tile is its own tab stop, named by `aria-label`, and the title beside it
 * is a second link to the same episode: a normal card pattern, and its
 * accessible name (the title alone) reads distinctly from the tile's
 * ("Play " + the title).
 *
 * `morph` (set by the Podcast catalogue, where the grid is the page's whole
 * content) makes the thumbnail the shared element for the route transition
 * into `/podcast/[slug]`: that page's poster carries the fixed name
 * `jb-episode-hero`, and on click this tile tags its own thumbnail with the
 * same name, so the browser grows one image into the other. The tag is set at
 * click time rather than in render on purpose - only the one image actually
 * navigated from may carry the name when the transition snapshots, or the
 * whole grid gets pulled out of the page snapshot to animate tile by tile. A
 * fresh mount re-renders the `<img>` without it, so nothing leaks.
 *
 * The home page leaves `morph` off: its grid links to the same routes but is
 * one section among several, so it keeps the plain page cross-fade.
 */
export function EpisodeCard({
  episode,
  morph = false,
  priority = false,
}: {
  episode: Episode;
  morph?: boolean;
  priority?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const title = episodeMetaTitle(episode.title);
  const runtime = formatRuntime(episode.duration);
  const href = `/podcast/${episode.slug}`;

  const tagForMorph = morph
    ? () => imgRef.current?.style.setProperty("view-transition-name", "jb-episode-hero")
    : undefined;

  return (
    // `h-full` + `mt-auto` on the metadata: grid items stretch to their row's
    // height, so pushing the date to the bottom of the card lines every date in
    // a row up with the others. Without it a one-line title and a two-line
    // title put their dates on different baselines, and a four-column grid of
    // real YouTube titles has both in almost every row.
    <article className="bx-card flex h-full flex-col">
      <Link
        href={href}
        onClick={tagForMorph}
        className="bx-tile group aspect-video"
        aria-label={`Play ${title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, already sized by the API */}
        <img
          ref={imgRef}
          src={episode.thumbnail}
          alt=""
          width={480}
          height={270}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
        <PlayMark />
        {runtime && <span className="bx-dur">{runtime}</span>}
      </Link>

      {/* The title link is deliberately not `.bx-actionlink`: that class is
          `inline-flex`, which makes the `<h3>`'s `line-clamp-2` clamp a single
          flex child instead of the text inside it, so a long episode title ran
          to three and four lines and broke the grid's rhythm. Same hover
          register, plain inline box. */}
      <h3 className="mt-3.5 line-clamp-2 text-[0.9375rem] leading-snug font-semibold">
        <Link
          href={href}
          onClick={tagForMorph}
          className="transition-colors duration-200 hover:text-[var(--bx-muted)]"
        >
          {title}
        </Link>
      </h3>
      {/* Date only, visually. The runtime is already on the thumbnail, in the
          chip a video player would put it in, so printing it again spends the
          metadata line on something the visitor read two lines above. It stays
          in the accessibility tree: the tile's `aria-label` names the play
          action, not the runtime, so this is the only place a screen reader
          can hear it. */}
      <p className="bx-meta mt-auto pt-1.5">
        {formatAiredShort(episode.published)}
        {runtime && <span className="sr-only">, {runtime}</span>}
      </p>
    </article>
  );
}

/**
 * The grid every episode list uses: one column on a phone, stepping to four on
 * the widest screens. The row gap is larger than the column gap so a wrapped
 * two-line title never crowds the card below it.
 */
export function EpisodeGrid({
  episodes,
  morph = false,
  priorityCount = 0,
}: {
  episodes: Episode[];
  morph?: boolean;
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {episodes.map((episode, index) => (
        <li key={episode.id}>
          <EpisodeCard
            episode={episode}
            morph={morph}
            priority={index < priorityCount}
          />
        </li>
      ))}
    </ul>
  );
}
