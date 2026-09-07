import type { ReactNode } from "react";

/**
 * The opening of an interior page.
 *
 * The home page's h1 is its positioning line, because a visitor landing there
 * has asked nothing yet. A visitor who clicked "Gear" has already asked, so
 * these h1s answer the question that was asked - and they are sentences, not
 * the one-word nav labels the incumbent printed under an eyebrow ("What We
 * Play With" / "Gear"). The nav item and the browser tab already carry the
 * label; spending the largest type on the page repeating it wastes the one
 * line a visitor is guaranteed to read.
 *
 * Order is title, metadata, standfirst, actions - the same order Now Playing,
 * the archive cards and the tournament panel use. A tracked label above a
 * heading is an eyebrow whatever data it carries, and it costs the page its
 * own title as the first thing read.
 */
export function PageHead({
  title,
  meta,
  lead,
  actions,
  note,
}: {
  title: ReactNode;
  meta?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <header className="bx-measure pt-12 pb-10 sm:pt-16 sm:pb-14">
      <h1 className="bx-display max-w-[18ch] text-[clamp(2.25rem,5.4vw,3.5rem)]">
        {title}
      </h1>
      {meta && <p className="bx-meta mt-4">{meta}</p>}
      {lead && <p className="bx-lead mt-5">{lead}</p>}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      {note && <p className="mt-8 max-w-[52ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">{note}</p>}
    </header>
  );
}

/**
 * A section's own opening row: its title, and the "all of them" link that
 * belongs to it. Kept together because a section label beside an unrelated
 * link is how a zone stops reading as a set of peers.
 */
export function SectionHead({
  title,
  link,
  size = "major",
  className = "",
}: {
  title: ReactNode;
  link?: ReactNode;
  size?: "major" | "minor";
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${className}`}>
      <h2
        className={
          size === "major"
            ? "bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]"
            : "bx-h2 text-lg sm:text-xl"
        }
      >
        {title}
      </h2>
      {link}
    </div>
  );
}
