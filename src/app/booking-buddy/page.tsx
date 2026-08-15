import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { Button } from "@/components/ui/button";
import { verifySession } from "@/lib/booking-buddy/dal";
import { createClient } from "@/lib/booking-buddy/supabase/server";
import { signOut } from "@/lib/booking-buddy/actions/auth";
import {
  BOOKINGS_PATH,
  FRIENDS_PATH,
  GROUPS_PATH,
  ORGS_PATH,
  SETTINGS_PATH,
  SLOTS_PATH,
} from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Booking Buddy",
  description:
    "Plan pickleball with your friends — open a time, see who's in, and keep your court bookings in one place.",
  path: "/booking-buddy",
});

export default async function BookingBuddyPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();

  const supabase = await createClient();
  // RLS limits this to the caller's own profile, so no user filter is needed
  // here for correctness — but one is passed anyway so the intent is legible.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();

  const greeting = profile?.display_name ?? session.email ?? "there";

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title={`Hi, ${greeting}`}
            description="Post open time, see who's in, and keep your court bookings in one place."
          />

          <p className="mt-8 text-sm text-muted-foreground">
            You&apos;re signed in.
          </p>

          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link
              href={SLOTS_PATH}
              className="underline underline-offset-4"
            >
              Slots
            </Link>
            <Link
              href={FRIENDS_PATH}
              className="underline underline-offset-4"
            >
              Manage your friends
            </Link>
            <Link
              href={GROUPS_PATH}
              className="underline underline-offset-4"
            >
              Friend groups
            </Link>
            <Link
              href={ORGS_PATH}
              className="underline underline-offset-4"
            >
              Where you play
            </Link>
            <Link
              href={BOOKINGS_PATH}
              className="underline underline-offset-4"
            >
              Your bookings
            </Link>
            <Link
              href={SETTINGS_PATH}
              className="underline underline-offset-4"
            >
              Settings
            </Link>
          </p>

          <form action={signOut} className="mt-8">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
