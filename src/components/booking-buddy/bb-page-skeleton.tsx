import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/typography/eyebrow";
import { PageHeading } from "@/components/typography/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";

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
 * transition in `booking-buddy/template.tsx` can't start until then.
 *
 * The shell is *real*, not skeletoned: the `PageHeading` copy is static per
 * page and the `BbSectionNav` pills are pathname-driven, so both paint at once
 * and don't shift when content arrives. Only the content area below is a
 * placeholder, and it's wrapped in `.bb-skeleton-body` (globals.css) which
 * holds it hidden for a beat — a quick navigation swaps straight to real
 * content and never flashes a stack of grey blocks; a slow read fades them in.
 *
 * - `dashboard` — the wider calendar + sidebar layout of `/booking-buddy`.
 * - `section` (default) — the narrower stack every other page uses, with the
 *   `BbSectionNav` pill row where that page has one (`sectionNav`).
 *
 * `title` omitted (the slot detail page, whose heading is data-derived) falls
 * back to a placeholder bar for the `<h1>`.
 */
export function BbPageSkeleton({
  variant = "section",
  title,
  description,
  sectionNav = true,
}: {
  variant?: "section" | "dashboard";
  title?: string;
  description?: string;
  sectionNav?: boolean;
}) {
  const heading = title ? (
    <PageHeading eyebrow="Booking Buddy" title={title} description={description} />
  ) : (
    <>
      <Eyebrow>Booking Buddy</Eyebrow>
      <Bar className="mt-3 h-9 w-64 sm:h-11" />
    </>
  );

  if (variant === "dashboard") {
    return (
      <div className="flex w-full flex-1 flex-col">
        <section className="w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {heading}

            <div
              className="bb-skeleton-body mt-8 flex flex-col gap-6 lg:flex-row lg:items-start"
              aria-hidden
            >
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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {heading}
          {sectionNav && <BbSectionNav />}

          <div
            className="bb-skeleton-body mt-10 flex flex-col gap-6"
            aria-hidden
          >
            <Bar className="h-28 w-full rounded-2xl" />
            <Bar className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
