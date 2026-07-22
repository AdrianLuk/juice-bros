import { getYoutubeEmbedUrl } from "@/lib/utils";
import { SectionHeading } from "@/components/typography/section-heading";
import { WatchListenButtons } from "@/components/watch-listen-buttons";

// The very first episode - where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";

export function OriginStory() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Where It Started" title="How this whole thing started" />
      <div className="mt-6 grid gap-8 sm:grid-cols-5 sm:items-center">
        <div className="overflow-hidden rounded-2xl border sm:col-span-2">
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
        <div className="flex flex-col gap-4 text-lg text-muted-foreground sm:col-span-3">
          <p>
            It started on the sidelines, the way most good ideas do. Daven and Adrian
            were two regulars at their local courts - always the last two still talking
            after everyone else had packed up their paddles and gone home. Wins, losses,
            weird matchups, the friend who won&apos;t stop coaching from the fence - it
            was all fair game.
          </p>
          <p>Eventually one of us said, &ldquo;we should just record this.&rdquo; So we did.</p>
          <p>
            Juice Bros Pickleball started as two friends riffing after a few games.
            It&apos;s grown into a show about the people, stories, and community that
            make this sport what it is - but the vibe hasn&apos;t changed. Pull up a
            chair. You&apos;re one of us now.
          </p>
          <div className="flex flex-wrap gap-3">
            <WatchListenButtons youtubeUrl={ORIGIN_EPISODE_URL} />
          </div>
        </div>
      </div>
    </section>
  );
}
