import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SignInForm } from "@/components/booking-buddy/sign-in-form";
import { getOptionalSession } from "@/lib/booking-buddy/dal";
import { readGoogleSignInClientId } from "@/lib/booking-buddy/env";
import { PRIVACY_PATH, safeRedirectTarget } from "@/lib/booking-buddy/routes";

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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        {/* Narrower than the other Booking Buddy pages: a sign-in form reads
            better as a single centred column than stretched across one. */}
        <div className="mx-auto max-w-md">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Sign in"
            description="Plan pickleball with your friends: open a time, see who's in."
          />

          <div className="bb-card mt-8 p-6 sm:p-8">
            <SignInForm
              next={target}
              error={error}
              googleClientId={readGoogleSignInClientId()}
            />
          </div>

          <nav className="mt-14 flex flex-wrap items-center gap-2">
            <Link
              href={PRIVACY_PATH}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Privacy
            </Link>
          </nav>
        </div>
      </section>
    </div>
  );
}
