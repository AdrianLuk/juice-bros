import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Appearance } from "@/lib/appearances";
import { describePlayers, formatAppearanceDates, formatShortDay } from "@/lib/appearances";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/brand/JB_Logo_White.svg";

type Target = { href: string; external: boolean };

function rowTarget(appearance: Appearance, isPast: boolean): Target | null {
  if (isPast) {
    if (appearance.recapUrl) return { href: appearance.recapUrl, external: true };
    if (appearance.recapSlug) return { href: `/appearances/${appearance.recapSlug}`, external: false };
  }
  if (appearance.url) return { href: appearance.url, external: true };
  return null;
}

function RowShell({
  target,
  className,
  children,
}: {
  target: Target | null;
  className: string;
  children: ReactNode;
}) {
  if (!target) return <div className={className}>{children}</div>;
  if (target.external) {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={target.href} className={className}>
      {children}
    </Link>
  );
}

export function AppearanceRow({
  appearance,
  tone = "upcoming",
}: {
  appearance: Appearance;
  tone?: "upcoming" | "past";
}) {
  const isPast = tone === "past";
  const target = rowTarget(appearance, isPast);
  const hasImage = Boolean(appearance.image);
  const showRecap = isPast && Boolean(appearance.recapUrl || appearance.recapSlug);

  return (
    <li>
      <RowShell
        target={target}
        className={cn(
          "group flex items-start gap-4 rounded-2xl border border-border p-3 outline-none transition-colors duration-300 sm:gap-5 sm:p-4",
          target &&
            "hover:border-brand-orange/40 hover:bg-brand-orange/3 focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isPast && "text-muted-foreground",
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
            className={cn(
              "object-contain transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              hasImage ? "h-full w-full" : "w-12 sm:w-16",
              target && "group-hover:scale-[1.04]",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3
              className={cn(
                "font-heading text-lg font-semibold text-foreground transition-colors duration-300",
                isPast && "font-medium text-muted-foreground",
                target && "group-hover:text-brand-orange",
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
            {target?.external && (
              <ArrowUpRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-orange motion-reduce:transition-none"
              />
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

          {showRecap && (
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-orange group-hover:underline">
              Read our recap
              <ArrowUpRight
                aria-hidden
                className="size-3.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              />
            </span>
          )}
        </div>
      </RowShell>
    </li>
  );
}
