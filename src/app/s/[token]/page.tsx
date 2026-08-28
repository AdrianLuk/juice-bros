import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { GuestResponseList, GuestRsvpForm } from "@/components/booking-buddy/guest-rsvp";
import { SpotsMeter } from "@/components/booking-buddy/spots-meter";
import { getSlotByToken } from "@/lib/booking-buddy/actions/guest-rsvp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  return {
    ...pageMetadata({
      title: "You're invited",
      description: "RSVP to a pickleball slot on Booking Buddy.",
      path: `/s/${token}`,
    }),
    // A Slot Link is meant for whoever holds it, not for search engines.
    robots: { index: false, follow: false },
  };
}

function courtsLabel(courtCount: number): string {
  return courtCount === 1 ? "1 court" : `${courtCount} courts`;
}

/**
 * A Guest's own view of one Slot (issue #10) — reachable with no account and
 * no Connection to the organizer, the low-friction path CONTEXT.md's Slot
 * Link entry describes. Deliberately outside `/booking-buddy`: `routes.ts`'s
 * `requiresSession` never gates this path, so there is nothing to sign in
 * for.
 */
export default async function GuestSlotPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getSlotByToken(token);

  if (!preview) {
    return (
      <div className="flex w-full flex-1 flex-col">
        <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <PageHeading
              eyebrow="Booking Buddy"
              title="This invite isn't valid"
              description="The link may be mistyped, or it may not exist anymore. Ask the organizer for a new one."
            />
          </div>
        </section>
      </div>
    );
  }

  const { when, ownerName, capacity, responses } = preview;
  const yesCount = responses.filter((response) => response.answer === "yes").length;
  // A Guest has no organizer context to act on an overflow, so the readout
  // stops at "full" rather than showing a bare "5 of 4" — the owner's own
  // page keeps the exact over-capacity signal.
  const spotsFull = capacity.capacity !== null && yesCount >= capacity.capacity;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title={when}
            description={`Proposed by ${ownerName}`}
          />

          <div className="mt-8 flex flex-col gap-8">
            <section>
              <div className="bb-card p-6">
                {capacity.capacity !== null && (
                  <div className="mb-5 flex flex-col gap-2">
                    <SpotsMeter
                      filled={Math.min(yesCount, capacity.capacity)}
                      capacity={capacity.capacity}
                    />
                    <p className="text-sm font-medium">
                      {spotsFull
                        ? `Full · ${capacity.capacity} spots`
                        : `${yesCount} of ${capacity.capacity} spots taken`}
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {courtsLabel(capacity.courtCount)}
                        {capacity.rotationBuffer > 0 &&
                          ` plus ${capacity.rotationBuffer} rotating`}
                      </span>
                    </p>
                  </div>
                )}
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Are you in?
                </h2>
                <div className="mt-4">
                  <GuestRsvpForm token={token} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Who&apos;s in
              </h2>
              <div className="mt-4">
                <GuestResponseList responses={responses} />
              </div>
            </section>

            {capacity.capacity === null && (
              <p className="text-sm text-muted-foreground">
                No court attached yet — this is still a proposal.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
