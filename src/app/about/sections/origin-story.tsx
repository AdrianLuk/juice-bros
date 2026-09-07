import { getYoutubeVideoId } from "@/lib/utils";
import { EpisodePlayer } from "@/components/bx/episode-player";

// The very first episode - where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";
const ORIGIN_EPISODE_ID = getYoutubeVideoId(ORIGIN_EPISODE_URL) ?? "";

/**
 * How the show started, with the first episode playing beside it.
 *
 * The episode is the evidence for the paragraph next to it, so it plays in
 * place through the same click-to-load embed the episode pages use - no
 * iframe, and none of YouTube's player JS, until somebody asks for it.
 *
 * All copy here is the published About page's own, unchanged.
 */
export function OriginStory() {
  return (
    <section className="bx-measure bx-hair py-16 sm:py-24">
      <div className="grid gap-9 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-center lg:gap-14">
        <EpisodePlayer
          videoId={ORIGIN_EPISODE_ID}
          title="Welcome to Juice Bros Pickleball"
        />

        <div>
          <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            How this whole thing started
          </h2>
          <div className="bx-prose mt-5">
            <p>
              It started on the sidelines, the way most good ideas do. Daven and
              Adrian were two regulars at their local courts - always the last
              two still talking after everyone else had packed up their paddles
              and gone home. Wins, losses, weird matchups, the friend who
              won&apos;t stop coaching from the fence - it was all fair game.
            </p>
            <p>
              Eventually one of us said, &ldquo;we should just record
              this.&rdquo; So we did.
            </p>
            <p>
              Juice Bros Pickleball started as two friends riffing after a few
              games. It&apos;s grown into a show about the people, stories, and
              community that make this sport what it is - but the vibe
              hasn&apos;t changed. <strong>Pull up a chair. You&apos;re one of
              us now.</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-14 sm:mt-20">
        <h3 className="bx-h2 text-lg sm:text-xl">How we got the name</h3>
        <div className="bx-prose mt-5">
          <p>
            Back when we first started, we both played at the same local park.
            Adrian&apos;s shot has always been the backhand roll. One day Daven
            watched him hit one and said, &ldquo;that backhand roll is so
            juicy.&rdquo; It stuck. After that, whenever the roll landed, Daven
            would yell &ldquo;juuuice&rdquo; from the other side of the court.
          </p>
          <p>
            Then Adrian started calling it back every time Daven hit something
            clean, and &ldquo;juice&rdquo; stopped being about one shot. It was
            just the thing we said to each other out there. And thus the Juice
            Bros were born.
          </p>
        </div>
      </div>
    </section>
  );
}
