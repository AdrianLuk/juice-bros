import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

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
          Nobody keeps score. There are no winners recorded and no
          leaderboard. The only thing a game leaves behind is that its four
          players have now shared a court, which feeds back into who they get
          matched with next.
        </p>
        <p className="odl-body max-w-md text-white/70">
          We&apos;re building On Deck with TO Pickleball Club for their
          Saturday socials, and making it work for any club that runs one. If
          that sounds like yours, we&apos;d love to hear how your night goes.
        </p>
        <div className="odl-cta-glow mt-5">
          <Button
            size="lg"
            nativeButton={false}
            className="odl-key odl-key--go h-12 rounded-[11px] border-transparent bg-(--odl-live) px-8 text-base text-white hover:bg-[color-mix(in_oklch,var(--odl-live),white_7%)]"
            render={<Link href="/contact" />}
          >
            Talk to us about your club
          </Button>
        </div>
      </Reveal>
      <style>{`
        .odl-cta-glow { filter: drop-shadow(0 0 32px oklch(0.68 0.19 40 / 0.4)); }
      `}</style>
    </section>
  );
}
