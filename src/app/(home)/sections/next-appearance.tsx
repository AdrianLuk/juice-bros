import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

export function NextAppearance() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <Link
        href="/appearances"
        className="group flex w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border border-brand-orange/20 bg-brand-orange/5 px-5 py-4 text-sm transition-colors duration-300 hover:bg-brand-orange/10"
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-brand-orange" />
        <span className="text-balance text-center">
          Catch us next at <span className="font-semibold">{next.name}</span>,{" "}
          {formatAppearanceDates(next)}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-brand-orange transition-transform duration-300 group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </Link>
    </section>
  );
}
