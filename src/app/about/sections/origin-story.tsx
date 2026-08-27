import { getYoutubeVideoId } from "@/lib/utils";
import { SectionHeading } from "@/components/typography/section-heading";
import { WatchListenButtons } from "@/components/watch-listen-buttons";
import { YoutubeEmbed } from "@/components/youtube-embed";

// The very first episode - where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";
const ORIGIN_EPISODE_ID = getYoutubeVideoId(ORIGIN_EPISODE_URL) ?? "";

export function OriginStory() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Where It Started" title="How this whole thing started" />
      <div className="mt-8 grid gap-8 sm:grid-cols-5 sm:items-center">
        <div className="rounded-[1.75rem] bg-black/3 p-1.5 ring-1 ring-black/5 sm:col-span-2">
          <div className="aspect-video overflow-hidden rounded-[1.25rem]">
            <YoutubeEmbed
              videoId={ORIGIN_EPISODE_ID}
              title="Welcome to Juice Bros Pickleball"
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
      <div className="mt-12 max-w-3xl sm:mt-16">
        <h3 className="font-heading text-xl font-bold tracking-[-0.02em]">
          How we got the name
        </h3>
        <div className="mt-4 flex flex-col gap-4 text-lg text-muted-foreground">
          <p>
            Back when we first started, we both played at the same local park.
            Adrian&apos;s shot has always been the backhand roll. One day Daven watched
            him hit one and said, &ldquo;that backhand roll is so juicy.&rdquo; It stuck.
            After that, whenever the roll landed, Daven would yell &ldquo;juuuice&rdquo;
            from the other side of the court.
          </p>
          <p>
            Then Adrian started calling it back every time Daven hit something clean, and
            &ldquo;juice&rdquo; stopped being about one shot. It was just the thing we
            said to each other out there. And thus the Juice Bros were born.
          </p>
        </div>
      </div>
    </section>
  );
}
