import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";

export const metadata: Metadata = pageMetadata({
  title: "Sign in to Booking Buddy",
  description: "Sign in to plan pickleball with your friends.",
  path: "/booking-buddy/sign-in",
});

/**
 * Placeholder. The actual magic-link / Google OAuth / email-password flows are
 * built in the "Sign in" ticket; this exists so the proxy's redirect target
 * resolves rather than 404-ing.
 */
export default function SignInPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Booking Buddy"
        title="Sign in"
        description="Sign-in is being built. Check back shortly."
      />
    </div>
  );
}
