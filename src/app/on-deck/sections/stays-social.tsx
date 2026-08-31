import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/typography/section-heading";

export function StaysSocial() {
  return (
    <section className="relative overflow-hidden bg-brand-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--brand-orange),transparent_86%)_0%,transparent_60%)]"
      />
      <Reveal
        variant="scale"
        className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8"
      >
        <SectionHeading
          eyebrow="No Scoreboard"
          title="It stays a social"
          align="center"
        />
        <p className="max-w-md text-white/70">
          Nobody keeps score. There are no winners recorded and no leaderboard.
          The only thing a game leaves behind is that its four players have now
          shared a court, which feeds back into who they get matched with next.
        </p>
        <p className="max-w-md text-white/70">
          We&apos;re building On Deck with TO Pickleball Club for their Saturday
          socials, and making it work for any club that runs one. If that sounds
          like yours, we&apos;d love to hear how your night goes.
        </p>
        <div className="mt-5">
          <Button
            size="lg"
            nativeButton={false}
            className="h-12 rounded-full bg-brand-orange px-8 text-base font-semibold text-white shadow-brand hover:bg-brand-orange/90"
            render={<Link href="/contact" />}
          >
            Talk to us about your club
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
