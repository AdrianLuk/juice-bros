import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podcast",
};

export default function PodcastPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Podcast</h1>
      <p className="mt-2 text-muted-foreground">Episodes coming soon.</p>
    </div>
  );
}
