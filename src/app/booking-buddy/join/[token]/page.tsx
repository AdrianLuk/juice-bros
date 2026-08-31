import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { Button } from "@/components/ui/button";
import { InviteRequestButton } from "@/components/booking-buddy/invite-request-button";
import { getOptionalSession } from "@/lib/booking-buddy/dal";
import { personLabel } from "@/lib/booking-buddy/connections";
import {
  getInviteLinkOwner,
  getInviteRelation,
  startInviteSignIn,
} from "@/lib/booking-buddy/actions/invite-links";
import { inviteRelationMessage } from "@/lib/booking-buddy/invite-links";
import { BOOKING_BUDDY_ROOT, FRIENDS_PATH } from "@/lib/booking-buddy/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  return {
    ...pageMetadata({
      title: "You're invited to Booking Buddy",
      description: "A friend invited you to plan pickleball together on Booking Buddy.",
      path: `/booking-buddy/join/${token}`,
    }),
    // A personal link, meant for whoever holds it — not a page to crawl.
    robots: { index: false, follow: false },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">{children}</div>
      </section>
    </div>
  );
}

/**
 * A personal invite link (issue #175): `/booking-buddy/join/<token>`.
 *
 * Reachable signed out — the friend it's shared with usually isn't on Booking
 * Buddy yet. A signed-out visitor gets a lightweight "<Name> invited you"
 * landing that carries the token into the normal sign-in flow; a signed-in
 * one either sends the owner a friend request or sees a friendly no-op line
 * (already connected, own link, request already in flight).
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const owner = await getInviteLinkOwner(token);

  if (!owner) {
    return (
      <Shell>
        <PageHeading
          eyebrow="Booking Buddy"
          title="This invite isn't valid"
          description="The link may be mistyped, or the person who shared it may have reset it. Ask them for a new one."
        />
        <div className="mt-8">
          <Button nativeButton={false} render={<Link href={BOOKING_BUDDY_ROOT} />}>
            Go to Booking Buddy
          </Button>
        </div>
      </Shell>
    );
  }

  const ownerName = personLabel(owner);
  const session = await getOptionalSession();

  if (!session) {
    return (
      <Shell>
        <PageHeading
          eyebrow="Booking Buddy"
          title={`${ownerName} invited you to Booking Buddy`}
          description="Post open times, see who's in, and keep your court bookings in one place. Free, and built by two rec players."
        />

        <div className="bb-card mt-8 flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            Sign in or create an account and we&apos;ll send {ownerName} a
            friend request from you. They&apos;ll need to accept it. An invite
            link never connects you automatically.
          </p>
          <form action={startInviteSignIn}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Sign in or create an account</Button>
          </form>
          <Link
            href={BOOKING_BUDDY_ROOT}
            className="text-sm underline underline-offset-4"
          >
            Just looking? Take me to Booking Buddy
          </Link>
        </div>
      </Shell>
    );
  }

  const relation =
    session.userId === owner.id ? "self" : await getInviteRelation(owner.id);

  return (
    <Shell>
      <PageHeading
        eyebrow="Booking Buddy"
        title={
          relation === "self"
            ? "Your invite link"
            : `Connect with ${ownerName}`
        }
        description={
          relation === "self"
            ? "This is the link friends use to connect with you."
            : `${ownerName} shared their invite link with you.`
        }
      />

      <div className="bb-card mt-8 flex flex-col items-start gap-4 p-6">
        {relation === "none" ? (
          <>
            <p className="text-sm text-muted-foreground">
              We&apos;ll send {ownerName} a friend request. Once they accept,
              you can see each other&apos;s availability and invite each other to
              games.
            </p>
            <InviteRequestButton ownerId={owner.id} ownerName={ownerName} />
          </>
        ) : (
          <>
            <p className="text-sm">{inviteRelationMessage(relation, ownerName)}</p>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={FRIENDS_PATH} />}
            >
              Go to your friends
            </Button>
          </>
        )}
      </div>
    </Shell>
  );
}
