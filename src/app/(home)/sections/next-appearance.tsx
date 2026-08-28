import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

export function NextAppearance() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <Link
      href="/appearances"
      className="group block w-full border-y border-brand-orange/15 bg-brand-orange/5 transition-colors duration-300 hover:bg-brand-orange/10"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-4 text-sm sm:px-6 lg:px-8">
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
      </div>
    </Link>
  );
}
