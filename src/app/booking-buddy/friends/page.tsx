import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { FriendSearch } from "@/components/booking-buddy/friend-search";
import { ConnectionList } from "@/components/booking-buddy/connection-list";
import { ConnectionActionButton } from "@/components/booking-buddy/connection-action-button";
import { verifySession } from "@/lib/booking-buddy/dal";
import { personLabel } from "@/lib/booking-buddy/connections";
import { listConnections } from "@/lib/booking-buddy/actions/connections";
import { BOOKING_BUDDY_ROOT, GROUPS_PATH } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Friends",
  description:
    "Find the people you play with, send friend requests, and see who's connected.",
  path: "/booking-buddy/friends",
});

export default async function FriendsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { friends, received, sent } = await listConnections();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Friends"
            description="Connections are mutual — once you're both in, you can see each other's open time."
          />

          <div className="mt-10 flex flex-col gap-12">
            <FriendSearch />

            <ConnectionList
              title="Requests for you"
              people={received}
              renderActions={(person) => (
                <>
                  <ConnectionActionButton
                    connectionId={person.connectionId}
                    action="accept"
                    label="Accept"
                    pendingLabel="Accepting…"
                    variant="default"
                  />
                  <ConnectionActionButton
                    connectionId={person.connectionId}
                    action="remove"
                    label="Decline"
                    pendingLabel="Declining…"
                    variant="ghost"
                  />
                </>
              )}
            />

            <ConnectionList
              title="Requests you've sent"
              description="Waiting on them to accept."
              people={sent}
              renderActions={(person) => (
                <ConnectionActionButton
                  connectionId={person.connectionId}
                  action="remove"
                  label="Cancel"
                  pendingLabel="Cancelling…"
                  variant="ghost"
                />
              )}
            />

            <ConnectionList
              title="Your friends"
              people={friends}
              emptyMessage="No friends yet. Search above to find someone you play with."
              renderActions={(person) => (
                <ConnectionActionButton
                  connectionId={person.connectionId}
                  action="remove"
                  label="Remove"
                  pendingLabel="Removing…"
                  variant="destructive"
                  confirm={{
                    title: `Remove ${personLabel(person)}?`,
                    description:
                      "You'll both stop seeing each other's open time, and they aren't told. You can send a new request later, but they'd have to accept it again.",
                  }}
                />
              )}
            />
          </div>

          <p className="mt-14 flex gap-4 text-sm">
            <Link
              href={GROUPS_PATH}
              className="underline underline-offset-4"
            >
              Friend groups
            </Link>
            <Link
              href={BOOKING_BUDDY_ROOT}
              className="underline underline-offset-4"
            >
              Back to Booking Buddy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
