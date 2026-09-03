import { cn } from "@/lib/utils";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
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
 * The route-level loading fallback for the signed-in Booking Buddy section
 * pages — one thin `loading.tsx` per authed segment renders it. Those pages
 * read per-request Supabase data behind `verifySession()`, none of it cached
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
 * The dashboard (`/booking-buddy`) deliberately has no skeleton — its
 * full-viewport calendar makes for too heavy a placeholder. See that page.
 *
 * `title` omitted (the slot detail page, whose heading is data-derived) falls
 * back to a placeholder bar for the `<h1>`.
 */
export function BbPageSkeleton({
  title,
  description,
  sectionNav = true,
}: {
  title?: string;
  description?: string;
  sectionNav?: boolean;
}) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {title ? (
            <BbPageHeading title={title} description={description} />
          ) : (
            <Bar className="h-9 w-64 rounded-sm sm:h-11" />
          )}
          {sectionNav && <BbSectionNav />}

          <div
            className="bb-skeleton-body mt-10 flex flex-col gap-6"
            aria-hidden
          >
            <Bar className="h-28 w-full rounded-sm" />
            <Bar className="h-48 w-full rounded-sm" />
          </div>
        </div>
      </section>
    </div>
  );
}
