import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import {
  EndStandingGameButton,
  PostedGamesList,
  StandingGameEditForm,
} from "@/components/booking-buddy/standing-games";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getStandingGame } from "@/lib/booking-buddy/actions/standing-games";
import { SLOTS_PATH } from "@/lib/booking-buddy/routes";
import {
  everyWeekdayLabel,
  standingGameTimeLabel,
} from "@/lib/booking-buddy/standing-games";

export const metadata: Metadata = pageMetadata({
  title: "Weekly game",
  description: "Edit or end a game that repeats every week.",
  path: "/booking-buddy/slots",
});

/**
 * A Standing Game's own page (issue #577): what it posts, the games it has
 * posted that are still to come, an edit form for every field, and End.
 * Owner-only like the table behind it; anyone else gets the same not-found a
 * missing row does.
 */
export default async function StandingGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();
  const detail = await getStandingGame(id);
  if (!detail) {
    notFound();
  }
  const { game, upcoming, ownedOrgs } = detail;
  const ended = game.endedAt !== null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-2.5 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title={everyWeekdayLabel(game.weekday)}
            description={[standingGameTimeLabel(game), game.facilityName]
              .filter(Boolean)
              .join(" · ")}
          />
          <p className="mt-3 text-sm">
            <Link href={SLOTS_PATH} className="underline underline-offset-4">
              Back to games
            </Link>
          </p>
          <div className="mt-10 flex flex-col gap-8">
            {ended && (
              <p className="bb-card p-4 text-sm sm:p-6" role="status">
                This weekly game has ended. It won&apos;t post any more games.
              </p>
            )}
            <section>
              <h2 className="bb-h text-[1.05rem]">Posted games</h2>
              <div className="bb-card mt-4 p-4 sm:p-6">
                <PostedGamesList games={upcoming} />
              </div>
            </section>
            {!ended && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Edit weekly game</h2>
                <div className="bb-card mt-4 p-4 sm:p-6">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Changes apply from the next game it posts. A game already
                    posted keeps its day and time, and you edit it on its own
                    page.
                  </p>
                  <StandingGameEditForm game={game} orgs={ownedOrgs} />
                </div>
              </section>
            )}
            {!ended && (
              <section>
                <h2 className="bb-h text-[1.05rem]">End weekly game</h2>
                <div className="bb-card mt-4 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Stop posting new games for good. Games already posted stay
                    on.
                  </p>
                  <EndStandingGameButton game={game} />
                </div>
              </section>
            )}
          </div>
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
