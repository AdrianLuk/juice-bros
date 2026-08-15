import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import {
  CreateGroupForm,
  FriendVisibilityRow,
  GroupCard,
} from "@/components/booking-buddy/friend-groups";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getGroupsPageData } from "@/lib/booking-buddy/actions/friend-groups";
import { BOOKING_BUDDY_ROOT, FRIENDS_PATH } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Friend groups",
  description:
    "Group the people you play with, and decide how much of your calendar each of them sees.",
  path: "/booking-buddy/groups",
});

export default async function GroupsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { groups, friends } = await getGroupsPageData();
  const people = friends.map((friend) => friend.person);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Friend groups"
            description="Groups are yours alone — nobody is told which one they're in, or what they can see."
          />

          {people.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Groups need friends first.{" "}
              <Link
                href={FRIENDS_PATH}
                className="underline underline-offset-4"
              >
                Find someone you play with
              </Link>
              , then come back.
            </p>
          ) : (
            <div className="mt-10 flex flex-col gap-12">
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  New group
                </h2>
                <div className="mt-4">
                  <CreateGroupForm />
                </div>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Your groups
                  {groups.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {groups.length}
                    </span>
                  )}
                </h2>

                {groups.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No groups yet. Groups grant visibility to several friends
                    at once — set it per friend instead below if you&apos;d
                    rather do that.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-6">
                    {groups.map((group) => (
                      <GroupCard key={group.id} group={group} friends={people} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Each friend
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What everyone actually sees. Setting someone here pins them —
                  it beats every group they&apos;re in, either way.
                </p>
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {friends.map((friend) => (
                    <FriendVisibilityRow
                      key={friend.person.connectionId}
                      friend={friend}
                    />
                  ))}
                </ul>
              </section>
            </div>
          )}

          <p className="mt-14 flex gap-4 text-sm">
            <Link
              href={FRIENDS_PATH}
              className="underline underline-offset-4"
            >
              Your friends
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
