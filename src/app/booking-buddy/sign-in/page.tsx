import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { SignInForm } from "@/components/booking-buddy/sign-in-form";
import { getOptionalSession } from "@/lib/booking-buddy/dal";
import { safeRedirectTarget } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Sign in to Booking Buddy",
  description: "Sign in to plan pickleball with your friends.",
  path: "/booking-buddy/sign-in",
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeRedirectTarget(next);

  // Already signed in? Don't make them sign in again.
  const session = await getOptionalSession();
  if (session) {
    redirect(target);
  }

  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Booking Buddy"
        title="Sign in"
        description="Plan pickleball with your friends — open a time, see who's in."
      />

      <SignInForm next={target} error={error} />
    </div>
  );
}
