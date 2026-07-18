import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";

export function WatchListenButtons({ youtubeUrl }: { youtubeUrl: string }) {
  return (
    <>
      <Button
        size="lg"
        nativeButton={false}
        className="h-11 bg-[#ff0000] px-6 text-base text-white hover:bg-[#d90000]"
        render={<a href={youtubeUrl} target="_blank" rel="noopener noreferrer" />}
      >
        <YoutubeIcon className="size-5" />
        Watch on YouTube
      </Button>
      <Button
        size="lg"
        nativeButton={false}
        className="h-11 bg-[#1db954] px-6 text-base text-white hover:bg-[#1aa64c]"
        render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
      >
        <SpotifyIcon className="size-5" />
        Listen on Spotify
      </Button>
    </>
  );
}
