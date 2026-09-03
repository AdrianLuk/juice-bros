import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { CreateSlotForm, SlotRow } from "@/components/booking-buddy/slots";
import { ScrollToPostAGame } from "@/components/booking-buddy/scroll-to-post-a-game";
import { FriendsLookingToPlay } from "@/components/booking-buddy/friends-looking-to-play";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listSlots } from "@/lib/booking-buddy/actions/slots";
import { listFriendsLookingToPlay } from "@/lib/booking-buddy/actions/looking";
import { listOrgs } from "@/lib/booking-buddy/actions/orgs";
import { slotPath } from "@/lib/booking-buddy/routes";
import { isHourTime, isRealDate } from "@/lib/booking-buddy/datetime";
export const metadata: Metadata = pageMetadata({
  title: "Games",
  description:
    "Post open time and gauge interest before you reserve a court, or see what your friends have proposed.",
  path: "/booking-buddy/slots",
});
export default async function SlotsPage({
  searchParams,
}: {
  // "Find a time" (#195) and "Friends looking to play" (#230) deep-link here
  // with a free window to prefill.
  searchParams: Promise<{ date?: string; start?: string; end?: string }>;
}) {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();
  const [{ own, friends }, lookingWindows, orgs, { date, start, end }] =
    await Promise.all([
      listSlots(),
      listFriendsLookingToPlay(),
      listOrgs(),
      searchParams,
    ]);
  // Just a shape check — a genuinely past date is caught by the form's own
  // submit validation and the `slots_not_in_the_past` trigger, and the tighter
  // "is it past" check here would need a time zone the deep-link doesn't carry.
  const prefillDate = date && isRealDate(date) ? date : undefined;
  const prefillStart = start && isHourTime(start) ? start : undefined;
  // An end without a usable start has nothing to measure a duration against.
  const prefillEnd =
    prefillStart && end && isHourTime(end) && end !== prefillStart
      ? end
      : undefined;
  // Empty on a plain visit; a stable signature of the deep link otherwise —
  // re-seeds the form and re-runs the scroll whenever a "Propose a game" click
  // changes the target, even when it only changes the query string.
  const prefillKey = prefillDate
    ? `${prefillDate}|${prefillStart ?? ""}|${prefillEnd ?? ""}`
    : "";
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-2.5 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Games"
            description="Propose a time before you've reserved a court. Friends respond yes, no, or maybe."
          />
          <BbSectionNav />
          <div className="bb-sheet mt-8 flex flex-col gap-11 p-3.5 sm:p-8">
            <section>
              <h2 className="bb-h text-[1.05rem]">Your games</h2>
              {own.length === 0 ? (
                <p className="mt-4 bb-outline p-4 text-sm text-muted-foreground">
                  Proposed times live here. Post one below and friends reply
                  yes, no, or maybe, before anyone books a court.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--bb-rule)] overflow-hidden rounded-sm border border-[var(--bb-rule)]">
                  {own.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      href={slotPath(slot.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="bb-h text-[1.05rem]">From your friends</h2>
              {friends.length === 0 ? (
                <p className="mt-4 bb-outline p-4 text-sm text-muted-foreground">
                  Nothing here yet. This fills up once a friend with{" "}
                  <Link
                    href="/booking-buddy/groups"
                    className="underline underline-offset-4"
                  >
                    Slot Visibility into you
                  </Link>{" "}
                  posts one, or once you have that into them.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--bb-rule)] overflow-hidden rounded-sm border border-[var(--bb-rule)]">
                  {friends.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      href={slotPath(slot.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="bb-h text-[1.05rem]">Friends looking to play</h2>
              <FriendsLookingToPlay windows={lookingWindows} />
            </section>
            <section id="post-a-game" className="scroll-mt-24">
              <h2 className="bb-h text-[1.05rem]">Post a game</h2>
              <div className="mt-4">
                {/* Keyed on the prefill so a "Propose a game" click that only
                    changes the query string (from the "Friends looking to
                    play" list right above, same route) still re-seeds the
                    form — its Start/Duration live in mount-time state that a
                    prop change alone wouldn't reach. */}
                <CreateSlotForm
                  key={prefillKey}
                  orgs={orgs}
                  defaultDate={prefillDate}
                  defaultStartTime={prefillStart}
                  defaultEndTime={prefillEnd}
                />
              </div>
            </section>
            <ScrollToPostAGame prefillKey={prefillKey} />
          </div>
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
