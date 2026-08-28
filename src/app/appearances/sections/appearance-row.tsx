import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import type { Appearance } from "@/lib/appearances";
import { describePlayers, formatAppearanceDates, formatShortDay } from "@/lib/appearances";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/brand/JB_Logo_White.svg";

function RowShell({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function AppearanceRow({ appearance }: { appearance: Appearance }) {
  const href = appearance.url ?? null;
  const hasImage = Boolean(appearance.image);

  return (
    <li>
      <RowShell
        href={href}
        className={cn(
          "group flex items-start gap-4 rounded-2xl border border-border p-3 transition-colors duration-300 sm:gap-5 sm:p-4",
          href && "hover:border-brand-orange/40 hover:bg-brand-orange/3",
        )}
      >
        <div
          className={cn(
            "flex aspect-16/10 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:w-32",
            hasImage ? "bg-muted p-1.5" : "bg-brand-orange",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local asset, no next/image optimization needed */}
          <img
            src={appearance.image ?? FALLBACK_IMAGE}
            alt=""
            loading="lazy"
            className={cn("object-contain", hasImage ? "h-full w-full" : "w-12 sm:w-16")}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3
              className={cn(
                "font-heading text-lg font-semibold text-foreground",
                href && "group-hover:text-brand-orange",
              )}
            >
              {appearance.name}
            </h3>
            {appearance.status === "tentative" && (
              <span
                className="inline-flex items-center rounded-full border border-brand-orange/40 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-orange uppercase"
                title="Not locked in yet"
              >
                Tentative
              </span>
            )}
            {href && (
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>

          <p className="mt-1 text-sm">
            {formatAppearanceDates(appearance)}
            <span aria-hidden> &middot; </span>
            {appearance.location}
          </p>
          <p className="mt-0.5 text-sm">Playing: {describePlayers(appearance.players)}</p>

          {appearance.divisions && appearance.divisions.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Divisions
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {appearance.divisions.map((division) => (
                  <li key={division.name}>
                    {division.name}
                    {division.date && (
                      <span aria-hidden> &middot; {formatShortDay(division.date)}</span>
                    )}
                    <span aria-hidden> &middot; </span>
                    {describePlayers(division.players)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </RowShell>
    </li>
  );
}
