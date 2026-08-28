"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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
    <section className="mt-14 border-t border-border pt-8">
      <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left outline-none transition-colors duration-300 hover:text-brand-orange focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-brand-orange motion-reduce:transition-none",
              open && "rotate-90",
            )}
          />
          Past
          <span className="text-base font-medium text-muted-foreground">({count})</span>
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
