import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FloorModeConsoles } from "./floor-mode-consoles";

export function Hero() {
  return (
    <section className="odl-section w-full overflow-x-clip px-4 pt-28 pb-16 sm:px-6 sm:pt-40 sm:pb-24 lg:pt-44">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center">
        <h1 className="odl-display jb-in text-4xl sm:text-6xl">
          Run your pickleball social.
          <br />
          Skip the paddle stack.
        </h1>
        <p className="odl-body jb-in jb-in-2 max-w-xl text-lg text-balance">
          Players scan a sign to join the Queue. On Deck calls the next
          Foursome as courts open up, so court time stays fair and people stop
          getting stuck with the same three players all night.
        </p>
        <div className="jb-in jb-in-3 mt-3 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            className="odl-key odl-key--go h-12 rounded-[11px] border-transparent bg-(--odl-live) px-7 text-base text-white hover:bg-[color-mix(in_oklch,var(--odl-live),white_7%)]"
            render={<a href="#how-it-runs" />}
          >
            See how a night runs
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="odl-key odl-key--ghost h-12 rounded-[11px] border-(--odl-line) bg-transparent px-6 text-base text-(--odl-dim) hover:bg-[oklch(1_0_0/0.04)] hover:text-(--odl-fg)"
            render={<Link href="/contact" />}
          >
            Talk to us about your club
          </Button>
        </div>
      </div>

      <div className="jb-in jb-in-4 mx-auto mt-16 w-full max-w-5xl sm:mt-20">
        <FloorModeConsoles />
      </div>
    </section>
  );
}
