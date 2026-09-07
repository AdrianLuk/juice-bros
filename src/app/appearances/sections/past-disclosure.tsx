"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "Past" section's expand/collapse. A controlled disclosure rather than a
 * native <details> so the open/close animates: the panel's height eases via
 * grid-template-rows (0fr -> 1fr), the rows fade and rise slightly, and the
 * chevron rotates on the same curve. The list stays in the DOM when collapsed
 * (good for crawlers) but is `inert`, so its links leave the tab order and the
 * a11y tree. `prefers-reduced-motion` drops every transition to an instant
 * toggle. The rows themselves are still server-rendered and passed in as
 * `children`.
 *
 * The chevron is drawn here rather than imported from an icon set, like every
 * other mark in this look, so its weight matches the play glyph and the arrows.
 */
export function PastDisclosure({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="bx-hair py-14 sm:py-20">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors duration-200 hover:text-[var(--bx-muted)]"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "size-[0.875em] shrink-0 text-[var(--bx-muted)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              open && "rotate-90",
            )}
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
          Already played
          {/* Not `.bx-meta`: at 11px beside a 30px heading the count read as a
              footnote marker rather than as part of the label. */}
          <span className="text-base font-medium text-[var(--bx-muted)]">
            ({count})
          </span>
        </button>
      </h2>

      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          className={cn(
            "overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
