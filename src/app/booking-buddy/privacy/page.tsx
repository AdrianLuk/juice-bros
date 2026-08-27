import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { getOptionalSession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { isEmailSyncAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist } from "@/lib/booking-buddy/env";
import { BOOKING_BUDDY_ROOT } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What Booking Buddy collects, why, and what the optional Gmail sync feature does with your inbox.",
  path: "/booking-buddy/privacy",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * Public even to a signed-out visitor (see routes.ts's PUBLIC_SUBPATHS) — the
 * sign-in page links here before there's a session. `getOptionalSession`
 * rather than `verifySession` so it renders instead of redirecting when
 * signed out; the Gmail section below simply stays hidden in that case,
 * consistent with `isEmailSyncAllowed`'s own fail-closed default.
 */
export default async function BookingBuddyPrivacyPage() {
  const session = await getOptionalSession();
  const profile = session ? await getOwnProfile() : null;
  const emailSyncAllowed =
    profile && session
      ? isEmailSyncAllowed(profile.username, session.email, readEmailSyncAllowlist())
      : false;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Privacy Policy"
            description="What this app collects, why, and who it's shared with. This covers Booking Buddy specifically — the podcast and marketing site collect nothing and have no accounts."
          />

          <Section title="The short version">
            <p>
              Booking Buddy is a small tool for planning pickleball with friends. We
              collect the account and scheduling info the app needs to work,
              we don&apos;t sell or share it with advertisers, and the one feature that
              touches your email (&quot;Sync from Email&quot;) only ever reads booking
              notifications from CourtReserve, only when you ask it to, and only after
              you&apos;ve reviewed and approved what it found.
            </p>
          </Section>

          <Section title="Account information">
            <p>
              Signing in creates an account via Supabase Auth, which stores your email
              address and handles authentication. Your profile also holds a username
              (shown to friends instead of your email), an optional display name, and
              an optional self-reported gender used only to compute Slot capacity for
              gendered formats.
            </p>
          </Section>

          <Section title="Bookings, Slots, and friends">
            <p>
              Facilities, bookings, open time Slots, availability windows, and friend
              connections/groups you create are stored so the app can show your
              calendar and let you coordinate with the people you&apos;ve connected
              with. This data is visible only to you and to the friends you&apos;ve
              explicitly connected with or shared a Slot Link with &mdash; it is never
              public and never shared outside Booking Buddy.
            </p>
            <p>
              Your personal invite link carries a random token tied to your
              account. Anyone who has the link can see your name and username on
              its landing page and, once they sign up, sends you a friend
              request you still have to accept. Resetting the link from your
              Friends page makes the old one stop working.
            </p>
          </Section>

          <Section title="Push notifications">
            <p>
              If you turn on push notifications, your browser registers a
              subscription we use solely to send you the booking-window and
              reminder notifications you&apos;ve opted into. Turning them off removes
              that subscription.
            </p>
          </Section>

          {emailSyncAllowed && (
            <Section title="Sync from Email (Gmail)">
              <p>
                Your account currently has access to &quot;Sync from Email&quot; &mdash;
                an invite-only feature, still being built out, that reads your Gmail
                inbox for CourtReserve booking emails so you don&apos;t have to type
                bookings in by hand. Here&apos;s exactly what that means:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <span className="text-foreground">What we ask permission for.</span>{" "}
                  Connecting Gmail grants a read-only Google OAuth scope
                  (<code className="text-xs">gmail.readonly</code>) plus your Google
                  account email. Google requires that scope to be requested at the
                  account level &mdash; there&apos;s no narrower &quot;just this
                  sender&quot; permission Google offers &mdash; but what we actually do
                  with it is much narrower than the permission itself, as below.
                </li>
                <li>
                  <span className="text-foreground">What we actually search for.</span>{" "}
                  Every sync searches only for mail from{" "}
                  <code className="text-xs">notifications@courtreserve.com</code> sent
                  in the last 90 days &mdash; never a whole-inbox search, and never
                  anything other than that one sender. We never read the rest of your
                  inbox.
                </li>
                <li>
                  <span className="text-foreground">When it runs.</span> Only when you
                  click &quot;Sync from Email&quot; yourself, in Settings. There is no
                  background or scheduled scan of your inbox.
                </li>
                <li>
                  <span className="text-foreground">What we extract.</span> From each
                  matching CourtReserve email we parse the booking details it already
                  contains &mdash; facility name, date, time, court, format, and the
                  player names listed on the reservation. We don&apos;t store the
                  email itself, its subject line, or any other content from it &mdash;
                  only these parsed fields, and only for the emails you go on to
                  confirm below.
                </li>
                <li>
                  <span className="text-foreground">Nothing happens automatically.</span>{" "}
                  Every match is shown to you as a candidate to review. Nothing becomes
                  (or removes) a real booking unless you confirm it. We do keep a
                  record of which Gmail messages you&apos;ve already reviewed &mdash;
                  just the message ID and whether you confirmed, dismissed, or it
                  resulted in a cancellation &mdash; so the same email isn&apos;t shown
                  to you twice.
                </li>
                <li>
                  <span className="text-foreground">How the connection is stored.</span>{" "}
                  We store a refresh token for your Gmail connection, encrypted at
                  rest, so we can search your inbox on demand without asking you to
                  sign in to Google every time. We never store a long-lived access
                  token. Google&apos;s own Testing-mode status (this integration
                  isn&apos;t yet through Google&apos;s full app-verification review)
                  expires that connection roughly every 7 days, at which point
                  you&apos;ll be prompted to reconnect.
                </li>
                <li>
                  <span className="text-foreground">Disconnecting.</span> You can
                  disconnect Gmail at any time from Settings. This immediately and
                  permanently deletes the stored refresh token, so the connection can
                  no longer read anything from your inbox.
                </li>
              </ul>
            </Section>
          )}

          <Section title="Who we share data with">
            <p>
              We don&apos;t sell your data or share it with advertisers. Supabase
              hosts our database and handles authentication on our behalf, under its
              own security practices. If you use Sync from Email, Google is
              necessarily involved as the mailbox provider for that one feature;
              nobody else is.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Every table is scoped with Row Level Security so you can only ever read
              or write your own data (and whatever friends have explicitly shared with
              you). Sensitive credentials, including the Gmail refresh token above,
              are encrypted at rest. All traffic to the app is served over HTTPS.
            </p>
          </Section>

          <Section title="Keeping and deleting your data">
            <p>
              We keep your account and scheduling data for as long as your account
              exists. There&apos;s no self-serve &quot;delete my account&quot; button
              yet &mdash; if you&apos;d like your data deleted, or have any question
              about this policy, reach out from the{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-2">
                Contact page
              </Link>{" "}
              and we&apos;ll take care of it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If how Booking Buddy handles your data changes in a meaningful way,
              we&apos;ll update this page. Since this app is still actively being
              built for a small group of friends, check back occasionally rather than
              expecting a change-notification email.
            </p>
          </Section>

          <FooterNav>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
