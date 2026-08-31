import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/typography/eyebrow";

export function Hero() {
  return (
    <section className="w-full overflow-x-clip bg-brand-orange px-4 pt-12 pb-16 text-white sm:px-6 sm:pt-28 sm:pb-20 lg:pt-32">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Eyebrow color="yellow" className="jb-in">
          On Deck
        </Eyebrow>
        <h1 className="jb-in jb-in-2 font-heading text-4xl font-black tracking-[-0.03em] text-balance sm:text-6xl">
          Live court rotation for your pickleball social
        </h1>
        <p className="jb-in jb-in-3 max-w-xl text-lg text-white/80 text-balance">
          Players scan a sign to join the Queue. On Deck calls the next Foursome
          as courts open up, so court time stays fair and people stop getting
          stuck with the same three players all night. You get to actually play
          at your own event.
        </p>
        <div className="jb-in jb-in-4 mt-3 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            className="h-12 rounded-full bg-white px-7 text-base font-semibold text-brand-orange shadow-brand hover:bg-white/90"
            render={<a href="#how-it-runs" />}
          >
            See how a night runs
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="h-12 rounded-full border-white/25 bg-white/10 px-6 text-base text-white hover:bg-white/20 hover:text-white"
            render={<Link href="/contact" />}
          >
            Talk to us about your club
          </Button>
        </div>
      </div>
    </section>
  );
}
