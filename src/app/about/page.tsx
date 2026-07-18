import type { Metadata } from "next";

import { getYoutubeEmbedUrl } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About",
};

// The very first episode — where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";

export default function AboutPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
        Who We Are
      </p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        About Juice Bros Pickleball
      </h1>

      <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/brand/JB_Banner.jpeg"
          alt="The Juice Bros"
          width={1600}
          height={900}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Juice Bros Pickleball started the way most good ideas do — two friends who
            couldn&apos;t stop talking about pickleball decided to hit record. What began as
            court-side rants turned into a podcast about the game, the gear, and the culture
            growing up around it.
          </p>
          <p className="text-muted-foreground">
            We&apos;re not pros. We&apos;re paddle-obsessed regulars who talk to the players,
            brands, and characters shaping the sport, and bring it back to you every week.
          </p>
        </div>
      </div>

      {/* Origin episode */}
      <div className="mt-16 border-t pt-16">
        <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
          Where It Started
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome to Juice Bros Pickleball
        </h2>

        <div className="mt-6 grid gap-8 sm:grid-cols-5 sm:items-center">
          <div className="overflow-hidden rounded-2xl border sm:col-span-3">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={getYoutubeEmbedUrl(ORIGIN_EPISODE_URL)}
                title="Welcome to Juice Bros Pickleball"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:col-span-2">
            <p className="text-muted-foreground">
              The first episode we ever recorded — who we are and why we started this
              podcast. If you&apos;re new here, start with this one.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                nativeButton={false}
                className="h-11 bg-[#ff0000] px-6 text-base text-white hover:bg-[#d90000]"
                render={<a href={ORIGIN_EPISODE_URL} target="_blank" rel="noopener noreferrer" />}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
