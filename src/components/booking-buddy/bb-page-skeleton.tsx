import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/**
 * The route-level loading fallback for the signed-in Booking Buddy pages — one
 * thin `loading.tsx` per authed segment renders it. Every one of those pages
 * reads per-request Supabase data behind `verifySession()`, none of it cached
 * or prefetchable, so without a fallback the App Router holds the previous page
 * fully rendered until the next one's data resolves — and the directional route
 * transition in `booking-buddy/template.tsx` can't start until then. This gives
 * it something to swap to at once: the shell blocked out, the content area a
 * couple of pulsing cards. `loading.tsx` sits inside the template's
 * `<ViewTransition>`, so the skeleton is what slides in; the real content then
 * swaps in place once it streams.
 *
 * Mirrors the real pages' shell classes (`section` padding, `mx-auto` width,
 * heading rhythm) so the skeleton-to-content swap doesn't shift the layout.
 *
 * - `dashboard` — the wider calendar + sidebar layout of `/booking-buddy`.
 * - `section` (default) — the narrower stack every other page uses, with the
 *   `BbSectionNav` pill row where that page has one (`sectionNav`).
 */
export function BbPageSkeleton({
  variant = "section",
  sectionNav = true,
}: {
  variant?: "section" | "dashboard";
  sectionNav?: boolean;
}) {
  if (variant === "dashboard") {
    return (
      <div className="flex w-full flex-1 flex-col" aria-hidden>
        <section className="w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Bar className="h-4 w-24" />
            <Bar className="mt-3 h-9 w-56 sm:h-11" />
            <Bar className="mt-3 h-6 w-full max-w-xs" />

            <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Bar className="h-9 w-48" />
                <Bar className="h-150 w-full rounded-xl" />
              </div>
              <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-72">
                <Bar className="h-44 w-full rounded-2xl" />
                <Bar className="h-44 w-full rounded-2xl" />
              </aside>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col" aria-hidden>
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Bar className="h-4 w-24" />
          <Bar className="mt-3 h-9 w-56 sm:h-11" />
          <Bar className="mt-3 h-6 w-full max-w-md" />

          {sectionNav && (
            <div className="mt-5 flex gap-1.5">
              <Bar className="h-7 w-20 rounded-full" />
              <Bar className="h-7 w-20 rounded-full" />
            </div>
          )}

          <div className="mt-10 flex flex-col gap-6">
            <Bar className="h-28 w-full rounded-2xl" />
            <Bar className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
