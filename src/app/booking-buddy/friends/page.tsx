import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import { FriendSearch } from "@/components/booking-buddy/friend-search";
import { ConnectionList } from "@/components/booking-buddy/connection-list";
import { ConnectionActionButton } from "@/components/booking-buddy/connection-action-button";
import { FriendCalendarDialog } from "@/components/booking-buddy/friend-calendar-dialog";
import { FriendVisibilityRow } from "@/components/booking-buddy/friend-visibility";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { personLabel } from "@/lib/booking-buddy/connections";
import { getFriendsPageData } from "@/lib/booking-buddy/actions/connections";
import { getFriendVisibilityList } from "@/lib/booking-buddy/actions/friend-groups";
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

  // `calendarVisibleFriendIds` gates the "View calendar" action below — a
  // friend whose resolved Visibility doesn't include open_time gets no entry
  // point at all (issue #61's own acceptance criterion), not a link that
  // leads to an empty page.
  const [{ friends, received, sent, calendarVisibleFriendIds }, friendVisibility] =
    await Promise.all([getFriendsPageData(), getFriendVisibilityList()]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title="Friends"
                description="Connections are mutual — once you're both in, you can see each other's open time."
              />
            </div>

            <BookingBuddyNav current="friends" />
          </div>

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
                <>
                  {person.username &&
                    calendarVisibleFriendIds.has(person.userId) && (
                      <FriendCalendarDialog
                        username={person.username}
                        displayName={person.displayName}
                      />
                    )}
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
                </>
              )}
            />

            {friendVisibility.length > 0 && (
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Each friend
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What everyone actually sees. Setting someone here pins them —
                  it beats every group they&apos;re in, either way.
                </p>
                <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                  {friendVisibility.map((friend) => (
                    <FriendVisibilityRow
                      key={friend.person.connectionId}
                      friend={friend}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <FooterNav>
            <FooterLink href={GROUPS_PATH}>Friend groups</FooterLink>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
