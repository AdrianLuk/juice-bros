import { StatusKey } from "@/components/booking-buddy/bb/status-key";
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
 * The route-loading fallback for the dashboard (`/booking-buddy/loading.tsx`).
 *
 * The dashboard reads a fan-out of per-request Supabase data (bookings, slots,
 * every slot's responses, availability) behind `verifySession()` — none of it
 * cached or prefetchable. Without a fallback the App Router holds the previous
 * page fully rendered until all of that resolves, so tapping "Dashboard" looks
 * frozen and then hard-cuts with no route transition. This gives the directional
 * transition (`booking-buddy/template.tsx`) something to bring in immediately.
 *
 * It's the board, not a stack of grey slabs: the same `px` / `max-w-6xl` rhythm
 * and the same `order-*` flex reshuffle as `page.tsx` (sheet above the board on
 * mobile, below it on desktop), the taped region and pinned sign-up sheet drawn
 * as dashed outlines ("where the first thing goes"), and the real `StatusKey` —
 * which is static — so the shell holds still on the swap. The greeting box
 * paints at once; everything below sits in `.bb-skeleton-body`, held hidden for
 * a beat so a quick load never flashes it and a slow one fades it in.
 */
export function BbDashboardSkeleton() {
  return (
    <div className="flex w-full flex-1 flex-col" aria-hidden>
      <section className="w-full px-2.5 pt-8 pb-10 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col">
          {/* Greeting — mirrors DashboardGreeting's h1 + status line. */}
          <div className="order-1 flex flex-col gap-3">
            <Bar className="h-10 w-72 rounded-sm sm:h-14 sm:w-96" />
            <Bar className="h-4 w-full max-w-xl rounded-sm" />
          </div>

          {/* The board: "This week" region + right column. `order` mirrors
              page.tsx so the sheet leads on mobile and the board leads on lg. */}
          <div className="order-3 mt-8 flex flex-col gap-x-8 gap-y-9 rounded-lg p-3 sm:p-6 lg:order-2 lg:flex-row lg:items-start">
            <div className="bb-region relative px-3 pt-8 pb-4 sm:px-4 lg:w-[37.5rem] lg:shrink-0">
              <span className="bb-tape absolute -top-3.5 left-4 text-xs leading-none">
                This week
              </span>
              <div className="bb-skeleton-body flex flex-wrap items-start gap-5 sm:gap-6">
                <div className="bb-outline h-44 w-full rounded-sm sm:w-[15.5rem]" />
                <div className="bb-outline h-44 w-full rounded-sm sm:w-[15.5rem]" />
              </div>
            </div>

            <div className="relative w-full shrink-0 pt-6 lg:w-[20rem]">
              <span className="bb-tape absolute -top-3.5 left-3 text-xs leading-none">
                Your court + time
              </span>
              <div className="bb-skeleton-body flex flex-col gap-7">
                <div className="bb-outline h-32 w-full rounded-sm" />
                <div className="bb-outline h-32 w-full rounded-sm" />
              </div>
            </div>
          </div>

          <StatusKey className="order-4 mt-7 lg:order-3" />

          {/* The sign-up sheet: masthead is real, the grid is a placeholder. */}
          <div className="order-2 mt-8 lg:order-4 lg:mt-12">
            <span className="bb-tape text-xs">The week, ruled out</span>
            <div className="bb-sheet mt-3 px-2 pt-4 pb-3 sm:px-6 sm:pt-6">
              <div className="mb-4 border-b-[3px] border-double border-[var(--bb-rule)] pb-2.5">
                <span className="bb-h text-[0.95rem]">Court sign-up</span>
              </div>
              <div className="bb-skeleton-body">
                <Bar className="h-72 w-full rounded-sm sm:h-96" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
