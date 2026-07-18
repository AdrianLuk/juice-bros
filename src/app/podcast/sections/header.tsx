import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { PageHeading } from "@/components/typography/page-heading";

export function Header() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <PageHeading title="Podcast" description="Every episode, straight from the channel." />
      </div>
      <div className="flex gap-4 text-sm font-medium">
        <a
          href={siteConfig.links.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-[#ff0000]"
        >
          <YoutubeIcon className="size-4 text-[#ff0000]" />
          YouTube
        </a>
        <a
          href={siteConfig.links.spotify}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-[#1db954]"
        >
          <SpotifyIcon className="size-4 text-[#1db954]" />
          Spotify
        </a>
      </div>
    </div>
  );
}
