import { ArrowUpRight } from "lucide-react";

import type { Appearance } from "@/lib/appearances";
import { describePlayers, formatAppearanceDates } from "@/lib/appearances";
import { cn } from "@/lib/utils";

function recapHref(appearance: Appearance): string | null {
  if (appearance.recapUrl) return appearance.recapUrl;
  if (appearance.recapSlug) return `/appearances/${appearance.recapSlug}`;
  return null;
}

export function AppearanceRow({
  appearance,
  tone = "upcoming",
}: {
  appearance: Appearance;
  tone?: "upcoming" | "past";
}) {
  const isPast = tone === "past";
  const recap = recapHref(appearance);

  return (
    <li className={cn("py-5", isPast && "text-muted-foreground")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className={cn("font-heading text-lg font-semibold", isPast && "font-medium")}>
          {appearance.url ? (
            <a
              href={appearance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-brand-orange"
            >
              {appearance.name}
              <ArrowUpRight aria-hidden className="size-4 shrink-0 opacity-60" />
            </a>
          ) : (
            appearance.name
          )}
        </h3>
        {appearance.status === "tentative" && (
          <span
            className="inline-flex items-center rounded-full border border-brand-orange/40 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-orange uppercase"
            title="Not locked in yet"
          >
            Tentative
          </span>
        )}
      </div>

      <p className="mt-1 text-sm">
        {formatAppearanceDates(appearance)}
        <span aria-hidden> &middot; </span>
        {appearance.location}
      </p>
      <p className="mt-0.5 text-sm">Playing: {describePlayers(appearance.players)}</p>

      {isPast && recap && (
        <a
          href={recap}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline"
          {...(appearance.recapUrl
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          Read our recap
          <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
        </a>
      )}
    </li>
  );
}
