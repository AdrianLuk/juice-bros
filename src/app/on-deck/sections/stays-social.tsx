import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { ClubIntentLink } from "@/components/on-deck/club-intent-link";
import { ON_DECK_DEMO_PATH } from "@/lib/on-deck/routes";

export function StaysSocial() {
  return (
    <section className="odl-section w-full text-white">
      <Reveal
        variant="scale"
        className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8"
      >
        <h2 className="odl-display text-3xl text-white sm:text-4xl">
          It stays a social
        </h2>
        <p className="odl-body max-w-md text-white/70">
          Nobody keeps score. There are no winners recorded and no leaderboard.
          The only thing a game leaves behind is that its four players have now
          shared a court, which feeds back into who they get matched with next.
        </p>
        <p className="odl-body max-w-md text-white/70">
          On Deck is free to use. There is no trial to run out and no card to
          enter.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          <span className="odl-cta-glow">
            <Button
              size="lg"
              nativeButton={false}
              className="odl-key odl-key--go h-12 px-8 text-base"
              render={<Link href={ON_DECK_DEMO_PATH} />}
            >
              Try the demo night
            </Button>
          </span>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="odl-key odl-key--neutral h-12 px-7 text-base"
            render={<ClubIntentLink from="landing-close" />}
          >
            Create your Club
          </Button>
        </div>
        <p className="odl-mono mt-1">
          Two fields to start a Club. Nothing to install at the venue.
        </p>
      </Reveal>
      <style>{`
        .odl-cta-glow { display: inline-flex; filter: drop-shadow(0 0 32px oklch(0.68 0.19 40 / 0.4)); }
      `}</style>
    </section>
  );
}
