import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { GuestResponseList } from "@/components/booking-buddy/guest-rsvp";
import { SpotsMeter } from "@/components/booking-buddy/spots-meter";
import { buttonVariants } from "@/components/ui/button";
import { BOOKING_BUDDY_ROOT } from "@/lib/booking-buddy/routes";
import type { ResponseAnswer } from "@/lib/booking-buddy/responses";
import { preselectedInviteAnswer } from "@/lib/booking-buddy/weekly-invites";
import { getWeeklyInviteByToken } from "@/lib/booking-buddy/weekly-invite-answers";
import { answerWeeklyInvite } from "@/lib/booking-buddy/actions/weekly-invite-answers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  return {
    ...pageMetadata({
      title: "This week's game",
      description: "Answer your weekly pickleball game on Booking Buddy.",
      path: `/answer/${token}`,
    }),
    // Meant for the Regular who holds the link, not for search engines, and
    // the token in the URL never rides along as a Referer.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const ANSWERS: readonly { value: ResponseAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

const ANSWER_LABEL: Record<ResponseAnswer, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

const SAVED_COPY: Record<ResponseAnswer, string> = {
  yes: "You're in. See you on the court.",
  maybe: "Marked as a maybe. The organizer will see it.",
  no: "Got it. Thanks for letting them know.",
};

function courtsLabel(courtCount: number): string {
  return courtCount === 1 ? "1 court" : `${courtCount} courts`;
}

/**
 * The cork ground and Booking Buddy's tokens, carried by the page itself:
 * like `/s/<token>` and `/connect/<token>`, this route sits outside
 * `/booking-buddy` so it opens with no session.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bb-theme bb-board flex w-full flex-1 flex-col text-foreground">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </section>
    </div>
  );
}

function AppLink() {
  return (
    <div className="mt-8">
      <Link
        href={BOOKING_BUDDY_ROOT}
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
      >
        Open Booking Buddy
      </Link>
    </div>
  );
}

/**
 * Where a Weekly Invite's Yes / Maybe / No links land (issue #580, ADR
 * 0022). Rendering only reads: the link's answer is preselected and nothing
 * is recorded until the Regular presses Confirm, so a mail scanner that
 * follows the link answers nothing. Shows the one game the token is for, the
 * same fields a Slot Link preview shows, whatever the Regular's Visibility
 * of the organizer.
 */
export default async function WeeklyInviteAnswerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string | string[]; saved?: string; failed?: string }>;
}) {
  const { token } = await params;
  const { a, saved, failed } = await searchParams;
  const invite = await getWeeklyInviteByToken(token);

  if (!invite) {
    return (
      <Shell>
        <BbPageHeading
          title="This link isn't working"
          description="The game may have been called off, or the link may be mistyped. Your weekly games are all in Booking Buddy."
        />
        <AppLink />
      </Shell>
    );
  }

  if (invite.state === "started") {
    return (
      <Shell>
        <BbPageHeading
          title="This game has started"
          description={`${invite.when}. Answers close once a game starts, so this link is done. Next week's invite brings a new one.`}
        />
        <AppLink />
      </Shell>
    );
  }

  const { preview, regularLabel, currentAnswer } = invite;
  const { when, facilityLabel, ownerName, capacity, responses } = preview;
  const chosen = preselectedInviteAnswer(saved ? undefined : a, currentAnswer);
  const yesCount = responses.filter((response) => response.answer === "yes").length;
  const spotsFull = capacity.capacity !== null && yesCount >= capacity.capacity;

  return (
    <Shell>
      <BbPageHeading
        title={facilityLabel ? `${when} · ${facilityLabel}` : when}
        description={`${ownerName}'s weekly game`}
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
                    {capacity.rotationBuffer > 0 && ` plus ${capacity.rotationBuffer} rotating`}
                  </span>
                </p>
              </div>
            )}

            {saved && currentAnswer && (
              <p className="mb-5 rounded-sm border border-(--bb-rule) px-4 py-3 text-sm" role="status">
                {SAVED_COPY[currentAnswer]}
              </p>
            )}
            {failed && (
              <p className="mb-5 text-sm text-destructive" role="alert">
                That didn&apos;t go through, and nothing changed. Try again.
              </p>
            )}

            <form action={answerWeeklyInvite} className="flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <fieldset className="flex flex-col gap-3">
                <legend className="font-heading text-lg font-semibold tracking-tight">
                  Are you in?
                </legend>
                {currentAnswer && (
                  <p className="text-sm text-muted-foreground">
                    Your answer now: {ANSWER_LABEL[currentAnswer]}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-2">
                  {ANSWERS.map(({ value, label }, index) => (
                    <label
                      key={value}
                      className="inline-flex h-11 min-w-20 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-medium transition-colors select-none hover:bg-muted has-[:checked]:border-[var(--foreground)] has-[:checked]:bg-[var(--foreground)] has-[:checked]:text-[var(--background)] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-[var(--ring)]"
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={value}
                        defaultChecked={chosen === value}
                        required={index === 0}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <button
                  type="submit"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-11 px-6")}
                >
                  Confirm
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Answering as {regularLabel}. You can change it here until the game starts.
              </p>
            </form>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold tracking-tight">Who&apos;s in</h2>
          <div className="mt-4">
            <GuestResponseList responses={responses} />
          </div>
        </section>

        {capacity.capacity === null && (
          <p className="text-sm text-muted-foreground">
            No court attached yet, so this game is still a proposal.
          </p>
        )}
      </div>
    </Shell>
  );
}
