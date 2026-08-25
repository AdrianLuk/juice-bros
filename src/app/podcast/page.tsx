import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { Header } from "./sections/header";
import { Episodes } from "./sections/episodes";
import { SpotifyEmbed } from "./sections/spotify-embed";

export const metadata: Metadata = pageMetadata({
  title: "Podcast",
  description:
    "Every episode of Juice Bros Pickleball in one place - watch on YouTube, listen on Spotify, or browse the full archive.",
  path: "/podcast",
});

export default async function PodcastPage() {
  const videos = await getEpisodes();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
      <Header />
      <Episodes videos={videos} />
      <SpotifyEmbed />
    </div>
  );
}
