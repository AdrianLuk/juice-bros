import type { Metadata } from "next";

import { getLatestVideos } from "@/lib/youtube";
import { Header } from "./sections/header";
import { Episodes } from "./sections/episodes";

export const metadata: Metadata = {
  title: "Podcast",
};

export default async function PodcastPage() {
  const videos = await getLatestVideos();

  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <Header />
      <Episodes videos={videos} />
    </div>
  );
}
