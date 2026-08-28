import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

export function NextAppearance() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <section className="w-full bg-brand-orange text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase">
            In The Wild
          </span>
          <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            Catch us on court
          </h2>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="max-w-2xl text-lg text-white/90 text-balance">
            <span className="text-white/70">Next up &middot; </span>
            <span className="font-semibold text-white">{next.name}</span>
          </p>
          <p className="text-white/75">
            {formatAppearanceDates(next)}
            <span aria-hidden> &middot; </span>
            {next.location}
          </p>
        </div>

        <Button
          size="lg"
          nativeButton={false}
          className="group mt-1 h-12 rounded-full bg-white pr-2 pl-6 text-base text-brand-orange hover:bg-white/90"
          render={<Link href="/appearances" />}
        >
          View all appearances
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-orange/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </Button>
      </div>
    </section>
  );
}
