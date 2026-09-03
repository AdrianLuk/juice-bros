import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { FriendSearch } from "@/components/booking-buddy/friend-search";
import { InviteLinkPanel } from "@/components/booking-buddy/invite-link-panel";
import { ConnectionList } from "@/components/booking-buddy/connection-list";
import { ConnectionActionButton } from "@/components/booking-buddy/connection-action-button";
import { FriendCalendarDialog } from "@/components/booking-buddy/friend-calendar-dialog";
import { FriendVisibilityRow } from "@/components/booking-buddy/friend-visibility";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { personLabel } from "@/lib/booking-buddy/connections";
import { getFriendsPageData } from "@/lib/booking-buddy/actions/connections";
import { getFriendVisibilityList } from "@/lib/booking-buddy/actions/friend-groups";
import { getOwnInviteUrl } from "@/lib/booking-buddy/actions/invite-links";
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
  const { friends, received, sent, calendarVisibleFriendIds } =
    await getFriendsPageData();
  const friendVisibility = await getFriendVisibilityList(friends);
  const inviteUrl = await getOwnInviteUrl();
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Friends"
            description="Connections are mutual. Once you're both in, you can see each other's availability."
          />
          <BbSectionNav />
          <div className="mt-10 flex flex-col gap-12">
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
            <section>
              <h2 className="bb-h text-[1.05rem]">
                Your friends
                {friendVisibility.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {friendVisibility.length}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What everyone actually sees. Setting someone here pins them: it
                beats every group they&apos;re in, either way.
              </p>
              {friendVisibility.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  No friends yet. Search above to find someone you play with.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                  {friendVisibility.map((friend) => (
                    <FriendVisibilityRow
                      key={friend.person.connectionId}
                      friend={friend}
                      actions={
                        <>
                          {friend.person.username &&
                            calendarVisibleFriendIds.has(
                              friend.person.userId,
                            ) && (
                              <FriendCalendarDialog
                                username={friend.person.username}
                                displayName={friend.person.displayName}
                              />
                            )}
                          <ConnectionActionButton
                            connectionId={friend.person.connectionId}
                            action="remove"
                            label="Remove"
                            pendingLabel="Removing…"
                            variant="destructive"
                            confirm={{
                              title: `Remove ${personLabel(friend.person)}?`,
                              description:
                                "You'll both stop seeing each other's availability, and they aren't told. You can send a new request later, but they'd have to accept it again.",
                            }}
                          />
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
            <FriendSearch />
            {inviteUrl && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Invite a friend</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Not on Booking Buddy yet? Send them your link. It connects
                  them to you when they sign up.
                </p>
                <div className="mt-4">
                  <InviteLinkPanel url={inviteUrl} />
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
