import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { getLatestVideos } from "@/lib/youtube";
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
  const videos = await getLatestVideos();

  return (
    <div className='flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8'>
      <Header />
      <Episodes videos={videos} />
      <SpotifyEmbed />
    </div>
  );
}
