import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/typography/eyebrow";
import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

export function NextAppearance() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <section className="relative overflow-hidden bg-brand-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand-orange),transparent_86%)_0%,transparent_60%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3">
          <Eyebrow color="yellow">In The Wild</Eyebrow>
          <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            Catch us on court
          </h2>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="max-w-2xl text-lg text-balance">
            <span className="text-white/60">Next up &middot; </span>
            <span className="font-semibold">{next.name}</span>
          </p>
          <p className="text-white/70">
            {formatAppearanceDates(next)}
            <span aria-hidden> &middot; </span>
            {next.location}
          </p>
        </div>

        <Button
          size="lg"
          nativeButton={false}
          className="group mt-1 h-12 rounded-full bg-brand-orange pr-2 pl-6 text-base font-semibold text-white hover:bg-brand-orange/90"
          render={<Link href="/appearances" />}
        >
          View all appearances
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </Button>
      </div>
    </section>
  );
}
