import type { ReactNode } from "react";
import Link from "next/link";

import type { Appearance } from "@/lib/appearances";
import { describePlayers, formatAppearanceDates } from "@/lib/appearances";
import { AppearanceArt } from "./appearance-art";
import { DivisionsList } from "./divisions-list";

type Target = { href: string; external: boolean };

function rowTarget(appearance: Appearance, isPast: boolean): Target | null {
  if (isPast) {
    if (appearance.recapUrl) return { href: appearance.recapUrl, external: true };
    if (appearance.recapSlug) return { href: `/appearances/${appearance.recapSlug}`, external: false };
  }
  if (appearance.url) return { href: appearance.url, external: true };
  return null;
}

/**
 * A row is a `.bx-panel` when it links somewhere and a plain bordered block
 * when it doesn't, rather than a link-shaped thing that isn't a link. The
 * panel's own hover (fill and ring both step up) is the whole affordance -
 * no separate lift, because a panel is not a tile.
 */
function RowShell({
  target,
  children,
}: {
  target: Target | null;
  children: ReactNode;
}) {
  const className = "bx-panel group flex w-full flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-6";

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
  const divisions = isPast ? [] : (appearance.divisions ?? []);
  const showRecap = isPast && Boolean(appearance.recapUrl || appearance.recapSlug);

  return (
    <li>
      <RowShell target={target}>
        <AppearanceArt
          image={appearance.image}
          className="aspect-[16/10] w-full shrink-0 sm:w-40"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h3 className="bx-h2 max-w-[34ch] text-base transition-colors duration-200 group-hover:text-[var(--bx-muted)] sm:text-lg">
              {appearance.name}
            </h3>
            {appearance.status === "tentative" && (
              <span className="bx-chip" title="Not locked in yet">
                Tentative
              </span>
            )}
          </div>

          <p className="bx-meta mt-2.5">
            {formatAppearanceDates(appearance)}
            <span aria-hidden> &middot; </span>
            {describePlayers(appearance.players)}
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
            {appearance.location}
          </p>

          {/* Past rows drop their divisions: which bracket somebody played in
              four months ago is trivia, and printing it made every finished
              tournament as tall as an upcoming one in a list where the point
              is to scan back through them quickly. */}
          {divisions.length > 0 && (
            <div className="mt-5">
              <DivisionsList divisions={divisions} />
            </div>
          )}

          {(target?.external || showRecap) && (
            <p className="bx-actionlink mt-5">
              {showRecap ? "Read our recap" : "Tournament details"}
              <span aria-hidden className="bx-arrow">
                &rarr;
              </span>
            </p>
          )}
        </div>
      </RowShell>
    </li>
  );
}
