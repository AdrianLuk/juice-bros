import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import {
  CreateGroupForm,
  GroupCard,
} from "@/components/booking-buddy/friend-groups";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getGroupsPageData } from "@/lib/booking-buddy/actions/friend-groups";
import { FRIENDS_PATH } from "@/lib/booking-buddy/routes";
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
  const { groups, friends: people } = await getGroupsPageData();
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Friend groups"
            description="Groups are yours alone. Nobody is told which one they're in, or what they can see."
          />
          <BbSectionNav />
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
                <h2 className="bb-h text-[1.05rem]">New group</h2>
                <div className="mt-4">
                  <CreateGroupForm />
                </div>
              </section>
              <section>
                <h2 className="bb-h text-[1.05rem]">
                  Your groups
                  {groups.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {groups.length}
                    </span>
                  )}
                </h2>
                {groups.length === 0 ? (
                  <p className="mt-4 bb-outline p-4 text-sm text-muted-foreground">
                    No groups yet. Groups grant visibility to several friends at
                    once. Set it per friend instead on the{" "}
                    <Link
                      href={FRIENDS_PATH}
                      className="underline underline-offset-4"
                    >
                      Friends
                    </Link>{" "}
                    page if you&apos;d rather do that.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-6">
                    {groups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        friends={people}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
